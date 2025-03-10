/**
 * Mentalplayer - Minesweeper Game Module
 * 
 * Implements the classic Minesweeper game with multiplayer features.
 * Includes improved game state transmission for reliable synchronization.
 */

const MinesweeperGame = (function() {
    // Game state
    let boardState = [];
    let mineLocations = [];
    let revealedCount = 0;
    let gameStarted = false;
    let gameOver = false;
    let mineCount = 40;
    let remainingMines = mineCount;
    let rows = 16;
    let cols = 16;
    let timerInterval;
    let timerValue = 0;
    let lastClickedCell = null;
    
    // Storage for game state synchronization
    let pendingGameState = null;
    let receivedBoardChunks = {};
    let receivedMineLocations = null;
    
    // DOM elements
    const board = document.getElementById('minesweeper-board');
    const mineCountDisplay = document.querySelector('.mine-count');
    const timerDisplay = document.querySelector('.timer');
    const resetButton = document.querySelector('.reset-button');
    const difficultySelect = document.getElementById('difficulty');
    const gameOverModal = document.getElementById('game-over-modal');
    const gameResultTitle = document.getElementById('game-result');
    const gameMessage = document.getElementById('game-message');
    const newGameButton = document.getElementById('new-game-button');
    const closeGameOverButton = document.getElementById('close-game-over-modal');

    /**
     * Initialize the Minesweeper game
     */
    function init() {
        console.log('[MinesweeperGame] Initializing game...');
        
        setupEventListeners();
        reset();
    }
    
    /**
     * Set up event listeners specific to Minesweeper
     */
    function setupEventListeners() {
        // Reset button
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                if (AppState.isRoomCreator) {
                    reset();
                    
                    // Broadcast reset to other players
                    if (typeof ConnectionManager !== 'undefined') {
                        ConnectionManager.sendData({
                            type: 'game_data',
                            data: {
                                action: 'reset',
                                difficulty: difficultySelect ? difficultySelect.value : 'intermediate'
                            }
                        });
                    }
                } else {
                    alert('Only the room creator can start a new game.');
                }
            });
        }
        
        // New game button in modal
        if (newGameButton) {
            newGameButton.addEventListener('click', () => {
                if (gameOverModal) gameOverModal.style.display = 'none';
                if (AppState.isRoomCreator) {
                    reset();
                }
            });
        }
        
        // Difficulty select
        if (difficultySelect) {
            difficultySelect.addEventListener('change', () => {
                const difficulty = difficultySelect.value;
                
                switch (difficulty) {
                    case 'beginner':
                        rows = 9;
                        cols = 9;
                        mineCount = 10;
                        break;
                    case 'intermediate':
                        rows = 16;
                        cols = 16;
                        mineCount = 40;
                        break;
                    case 'expert':
                        rows = 16;
                        cols = 30;
                        mineCount = 99;
                        break;
                }
                
                if (AppState.isRoomCreator && gameStarted) {
                    // Ask for confirmation if game is in progress
                    if (confirm('Changing difficulty will start a new game. Continue?')) {
                        reset();
                        
                        // Broadcast difficulty change
                        if (typeof ConnectionManager !== 'undefined') {
                            ConnectionManager.sendData({
                                type: 'game_data',
                                data: {
                                    action: 'difficulty_change',
                                    difficulty: difficulty
                                }
                            });
                        }
                    } else {
                        // Reset to current difficulty
                        const currentDifficulty = 
                            rows === 9 && cols === 9 ? 'beginner' :
                            rows === 16 && cols === 16 ? 'intermediate' : 'expert';
                        difficultySelect.value = currentDifficulty;
                    }
                } else if (AppState.isRoomCreator) {
                    reset();
                    
                    // Broadcast difficulty change
                    if (typeof ConnectionManager !== 'undefined') {
                        ConnectionManager.sendData({
                            type: 'game_data',
                            data: {
                                action: 'difficulty_change',
                                difficulty: difficulty
                            }
                        });
                    }
                } else {
                    alert('Only the room creator can change difficulty.');
                    
                    // Reset to current difficulty
                    const currentDifficulty = 
                        rows === 9 && cols === 9 ? 'beginner' :
                        rows === 16 && cols === 16 ? 'intermediate' : 'expert';
                    difficultySelect.value = currentDifficulty;
                }
            });
        }
    }
    
    /**
     * Reset the game
     */
    function reset() {
        console.log('[MinesweeperGame] Resetting game');
        
        // Reset game state
        gameStarted = false;
        gameOver = false;
        revealedCount = 0;
        if (resetButton) resetButton.textContent = '😊';
        
        // Stop timer if running
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        
        // Reset timer display
        timerValue = 0;
        updateTimerDisplay();
        
        // Reset remaining mines
        remainingMines = mineCount;
        updateMineCount();
        
        // Create the board
        createBoard();
        
        // Initialize mines (will be placed on first click)
        mineLocations = [];
        
        // Reset sync storage
        pendingGameState = null;
        receivedBoardChunks = {};
        receivedMineLocations = null;
        
        // If room creator, broadcast new game to all peers
        if (AppState.isRoomCreator && typeof ConnectionManager !== 'undefined') {
            ConnectionManager.sendData({
                type: 'minesweeper_new_game',
                rows: rows,
                cols: cols,
                mineCount: mineCount
            });
        }
    }
    
    /**
     * Create the game board
     */
    function createBoard() {
        if (!board) {
            console.warn('[MinesweeperGame] Board element not found');
            return;
        }
        
        // Clear the board
        board.innerHTML = '';
        
        // Set CSS variables for board size
        document.documentElement.style.setProperty('--rows', rows);
        document.documentElement.style.setProperty('--cols', cols);
        
        // Initialize board state
        boardState = Array(rows).fill().map(() => 
            Array(cols).fill().map(() => ({
                isMine: false,
                isRevealed: false,
                isFlagged: false,
                adjacentMines: 0
            }))
        );
        
        // Create cells
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = r;
                cell.dataset.col = c;
                
                // Add event listeners
                cell.addEventListener('click', handleCellClick);
                cell.addEventListener('contextmenu', handleRightClick);
                cell.addEventListener('mouseover', handleCellHover);
                
                board.appendChild(cell);
            }
        }
    }
    
    /**
     * Place mines randomly, avoiding the first clicked cell and its neighbors
     */
    function placeMines(firstRow, firstCol) {
        // Mark positions to avoid (first click and neighbors)
        const avoid = [];
        for (let r = Math.max(0, firstRow - 1); r <= Math.min(rows - 1, firstRow + 1); r++) {
            for (let c = Math.max(0, firstCol - 1); c <= Math.min(cols - 1, firstCol + 1); c++) {
                avoid.push(`${r},${c}`);
            }
        }
        
        // Place mines
        let minesPlaced = 0;
        while (minesPlaced < mineCount) {
            const row = Math.floor(Math.random() * rows);
            const col = Math.floor(Math.random() * cols);
            const key = `${row},${col}`;
            
            if (!avoid.includes(key) && !mineLocations.some(m => m.row === row && m.col === col)) {
                mineLocations.push({ row, col });
                boardState[row][col].isMine = true;
                minesPlaced++;
            }
        }
        
        // Calculate adjacent mines for each cell
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!boardState[r][c].isMine) {
                    boardState[r][c].adjacentMines = countAdjacentMines(r, c);
                }
            }
        }
        
        // Send mine locations to other players if room creator
        if (AppState.isRoomCreator && typeof ConnectionManager !== 'undefined') {
            ConnectionManager.sendData({
                type: 'minesweeper_mines_placed',
                mineLocations: mineLocations,
                firstCell: { row: firstRow, col: firstCol }
            });
        }
    }
    
    /**
     * Count adjacent mines for a cell
     */
    function countAdjacentMines(row, col) {
        let count = 0;
        for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
            for (let c = Math.max(0, col - 1); c <= Math.min(cols - 1, col + 1); c++) {
                if (r === row && c === col) continue;
                if (boardState[r][c].isMine) count++;
            }
        }
        return count;
    }
    
    /**
     * Handle cell click
     */
    function handleCellClick(event) {
        if (gameOver) return;
        
        const cell = event.target;
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        
        // Send click to peers
        if (typeof ConnectionManager !== 'undefined') {
            ConnectionManager.sendData({
                type: 'minesweeper_cell_click',
                row: row,
                col: col,
                isRightClick: false
            });
        }
        
        // Process click
        processCellClick(row, col, false);
    }
    
    /**
     * Handle right click (flag placement)
     */
    function handleRightClick(event) {
        event.preventDefault();
        if (gameOver) return;
        
        const cell = event.target;
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        
        // Send right click to peers
        if (typeof ConnectionManager !== 'undefined') {
            ConnectionManager.sendData({
                type: 'minesweeper_cell_click',
                row: row,
                col: col,
                isRightClick: true
            });
        }
        
        // Process right click
        processCellClick(row, col, true);
    }
    
    /**
     * Handle cell hover for cursor position sharing
     */
    function handleCellHover(event) {
        const cell = event.target;
        
        // Remove previous highlight
        if (lastClickedCell && lastClickedCell !== cell) {
            lastClickedCell.classList.remove('highlighted');
        }
        
        // Add highlight to current cell
        cell.classList.add('highlighted');
        lastClickedCell = cell;
        
        // Share cursor position
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        
        if (typeof ConnectionManager !== 'undefined') {
            ConnectionManager.sendData({
                type: 'minesweeper_cursor',
                row: row,
                col: col
            });
        }
    }
    
    /**
     * Process cell click (both local and remote)
     */
    function processCellClick(row, col, isRightClick) {
        if (gameOver) return;
        
        // Validate row and column
        if (row < 0 || row >= rows || col < 0 || col >= cols) {
            console.warn('[MinesweeperGame] Invalid cell coordinates:', row, col);
            return;
        }
        
        const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        if (!cell) {
            console.warn('[MinesweeperGame] Cell element not found:', row, col);
            return;
        }
        
        // Start game on first click
        if (!gameStarted) {
            // Only start game once (by room creator)
            if (AppState.isRoomCreator) {
                startGame(row, col);
            }
            
            // Don't process right-clicks if game hasn't started
            if (isRightClick) return;
        }
        
        if (isRightClick) {
            // Toggle flag
            if (!boardState[row][col].isRevealed) {
                toggleFlag(cell, row, col);
            }
        } else {
            // Reveal cell
            if (!boardState[row][col].isFlagged) {
                revealCell(cell, row, col, true);
            }
        }
    }
    
    /**
     * Toggle flag on/off for a cell
     */
    function toggleFlag(cell, row, col) {
        if (boardState[row][col].isFlagged) {
            // Remove flag
            cell.classList.remove('flagged');
            boardState[row][col].isFlagged = false;
            remainingMines++;
        } else {
            // Add flag
            cell.classList.add('flagged');
            boardState[row][col].isFlagged = true;
            remainingMines--;
        }
        
        // Update mine count display
        updateMineCount();
    }
    
    /**
     * Reveal a cell
     */
    function revealCell(cell, row, col, checkWin) {
        if (boardState[row][col].isRevealed) return;
        
        // Mark as revealed
        boardState[row][col].isRevealed = true;
        cell.classList.add('revealed');
        
        // Remove any flag
        if (boardState[row][col].isFlagged) {
            cell.classList.remove('flagged');
            boardState[row][col].isFlagged = false;
            remainingMines++;
            updateMineCount();
        }
        
        // Check if mine
        if (boardState[row][col].isMine) {
            cell.classList.add('mine');
            cell.textContent = '💣';
            gameOver = true;
            endGame(false);
            return;
        }
        
        // Count of non-mine cells revealed
        revealedCount++;
        
        // Check adjacent mines
        const adjacentMines = boardState[row][col].adjacentMines;
        if (adjacentMines > 0) {
            cell.textContent = adjacentMines;
            cell.classList.add(`number-${adjacentMines}`);
        } else {
            // Auto-reveal neighbors for cells with no adjacent mines
            for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
                for (let c = Math.max(0, col - 1); c <= Math.min(cols - 1, col + 1); c++) {
                    if (r === row && c === col) continue;
                    if (!boardState[r][c].isRevealed && !boardState[r][c].isFlagged) {
                        const neighborCell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
                        if (neighborCell) {
                            revealCell(neighborCell, r, c, false);
                        }
                    }
                }
            }
        }
        
        // Check win condition
        if (checkWin && revealedCount === (rows * cols - mineCount)) {
            gameOver = true;
            endGame(true);
        }
    }
    
    /**
     * Start game on first click
     */
    function startGame(firstRow, firstCol) {
        console.log('[MinesweeperGame] Starting game...');
        gameStarted = true;
        
        // Place mines (avoiding first click)
        placeMines(firstRow, firstCol);
        
        // Start timer
        startTimer();
        
        // Notify other players that game has started
        if (typeof ConnectionManager !== 'undefined') {
            ConnectionManager.sendData({
                type: 'minesweeper_game_started'
            });
        }
    }
    
    /**
     * Start timer
     */
    function startTimer() {
        timerInterval = setInterval(() => {
            timerValue++;
            updateTimerDisplay();
            
            // Sync timer with other players every 5 seconds
            if (timerValue % 5 === 0 && AppState.isRoomCreator && typeof ConnectionManager !== 'undefined') {
                ConnectionManager.sendData({
                    type: 'minesweeper_timer_sync',
                    timerValue: timerValue
                });
            }
        }, 1000);
    }
    
    /**
     * Update timer display
     */
    function updateTimerDisplay() {
        if (timerDisplay) {
            timerDisplay.textContent = timerValue.toString().padStart(3, '0');
        }
    }
    
    /**
     * Update mine count display
     */
    function updateMineCount() {
        if (mineCountDisplay) {
            mineCountDisplay.textContent = remainingMines.toString().padStart(3, '0');
        }
    }
    
    /**
     * End game (win or lose)
     */
    function endGame(isWin) {
        // Stop timer
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        
        // Update reset button face
        if (resetButton) {
            resetButton.textContent = isWin ? '😎' : '😵';
        }
        
        // Reveal all mines
        if (!isWin) {
            revealAllMines();
        }
        
        // Show game over modal
        showGameOverModal(isWin);
        
        // Send game over message
        if (typeof ConnectionManager !== 'undefined') {
            ConnectionManager.sendData({
                type: 'minesweeper_game_over',
                isWin: isWin,
                timerValue: timerValue
            });
            
            // Add message to chat
            ConnectionManager.addChatMessage('system', isWin ? 
                `Game over! The team cleared all mines in ${timerValue} seconds! 🎉` :
                `Game over! The team hit a mine. Better luck next time! 💣`
            );
        }
    }
    
    /**
     * Reveal all mines when game is lost
     */
    function revealAllMines() {
        mineLocations.forEach(loc => {
            const cell = document.querySelector(`.cell[data-row="${loc.row}"][data-col="${loc.col}"]`);
            
            if (cell && !boardState[loc.row][loc.col].isRevealed) {
                cell.classList.add('revealed');
                cell.classList.add('mine');
                cell.textContent = '💣';
                
                // Remove flag if present
                if (boardState[loc.row][loc.col].isFlagged) {
                    cell.classList.remove('flagged');
                }
            }
        });
        
        // Mark incorrectly flagged cells
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (boardState[r][c].isFlagged && !boardState[r][c].isMine) {
                    const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
                    if (cell) {
                        cell.classList.add('revealed');
                        cell.textContent = '❌';
                    }
                }
            }
        }
    }
    
    /**
     * Show game over modal
     */
    function showGameOverModal(isWin) {
        if (!gameOverModal || !gameResultTitle || !gameMessage) return;
        
        gameResultTitle.textContent = isWin ? 'You Win!' : 'Game Over';
        gameMessage.textContent = isWin ? 
            `Congratulations! The team cleared all mines in ${timerValue} seconds.` : 
            'The team hit a mine! Better luck next time.';
        
        gameOverModal.style.display = 'flex';
    }
    
    /**
     * Update remote player's cursor position
     */
    function updateRemoteCursor(peerId, row, col) {
        // Remove previous cursor highlight for this peer
        const prevCursor = document.querySelector(`.remote-cursor-${peerId}`);
        if (prevCursor) {
            prevCursor.classList.remove(`remote-cursor-${peerId}`);
            prevCursor.style.outline = "";
        }
        
        // Add highlight to the cell
        const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        if (cell) {
            cell.classList.add(`remote-cursor-${peerId}`);
            
            // Apply player color as outline
            if (typeof AppState !== 'undefined' && AppState.players[peerId]) {
                cell.style.outline = `2px solid ${AppState.players[peerId].color}`;
                cell.style.outlineOffset = "-2px";
            }
            
            // Remove highlight after a delay
            setTimeout(() => {
                if (cell.classList.contains(`remote-cursor-${peerId}`)) {
                    cell.style.outline = "";
                    cell.classList.remove(`remote-cursor-${peerId}`);
                }
            }, 1000);
        }
    }
    
    /**
     * Send complete game state to a peer with improved chunking
     */
    function sendGameState(conn) {
        try {
            console.log('[MinesweeperGame] Sending game state to peer...');
            
            // First send basic game configuration
            conn.send({
                type: 'minesweeper_game_state',
                rows: rows,
                cols: cols,
                mineCount: mineCount,
                remainingMines: remainingMines,
                gameStarted: gameStarted,
                gameOver: gameOver,
                timerValue: timerValue,
                difficulty: difficultySelect ? difficultySelect.value : 'intermediate',
                timestamp: Date.now(),  // Add timestamp for ordering
                sequence: 0,  // Start of sequence
                totalChunks: Math.ceil((rows * cols) / 50) // Indicate how many chunks to expect
            });
            
            // Then send board state in chunks with sequence numbers
            const chunkSize = 50; // Number of cells to send in each chunk
            const totalCells = rows * cols;
            const totalChunks = Math.ceil(totalCells / chunkSize);
            
            // Use a queue system to send chunks with controlled timing
            let chunkIndex = 0;
            
            const sendNextChunk = () => {
                if (chunkIndex >= totalChunks) {
                    // All chunks sent, now send mine locations
                    setTimeout(() => {
                        conn.send({
                            type: 'minesweeper_mine_locations',
                            mineLocations: mineLocations,
                            timestamp: Date.now(),
                            sequence: totalChunks + 1  // End of sequence
                        });
                        
                        console.log('[MinesweeperGame] Game state transmission complete');
                    }, 100);
                    return;
                }
                
                const chunkBoardState = [];
                const startCell = chunkIndex * chunkSize;
                const endCell = Math.min(startCell + chunkSize, totalCells);
                
                for (let cellIndex = startCell; cellIndex < endCell; cellIndex++) {
                    const row = Math.floor(cellIndex / cols);
                    const col = cellIndex % cols;
                    chunkBoardState.push({
                        row: row,
                        col: col,
                        state: {
                            isRevealed: boardState[row][col].isRevealed,
                            isFlagged: boardState[row][col].isFlagged
                            // Don't send isMine or adjacentMines - these will be calculated from mineLocations
                        }
                    });
                }
                
                conn.send({
                    type: 'minesweeper_board_chunk',
                    chunkIndex: chunkIndex,
                    totalChunks: totalChunks,
                    boardChunk: chunkBoardState,
                    timestamp: Date.now(),
                    sequence: chunkIndex + 1  // Add sequence number
                });
                
                console.log(`[MinesweeperGame] Sent chunk ${chunkIndex + 1}/${totalChunks}`);
                
                // Move to next chunk
                chunkIndex++;
                
                // Schedule next chunk with a small delay to prevent overwhelming the connection
                setTimeout(sendNextChunk, 50);
            };
            
            // Start sending chunks after a short delay
            setTimeout(sendNextChunk, 200);
            
        } catch (error) {
            console.error('[MinesweeperGame] Error sending game state:', error);
        }
    }
    
    /**
     * Assemble and apply the complete game state from chunks with validation
     */
    function assembleAndApplyGameState() {
        if (!pendingGameState || !receivedMineLocations) return;
        
        try {
            console.log('[MinesweeperGame] Assembling game state from chunks...');
            
            // Validate that we have all chunks and they match the expected total
            const expectedTotalChunks = pendingGameState.totalChunks || 0;
            const receivedChunks = Object.keys(receivedBoardChunks).map(Number);
            
            // Check for missing chunks
            const missingChunks = [];
            for (let i = 0; i < expectedTotalChunks; i++) {
                if (!receivedChunks.includes(i)) {
                    missingChunks.push(i);
                }
            }
            
            if (missingChunks.length > 0) {
                console.warn('[MinesweeperGame] Missing chunks:', missingChunks);
                // Request missing chunks
                if (typeof ConnectionManager !== 'undefined' && ConnectionManager.sendData) {
                    ConnectionManager.sendData({
                        type: 'minesweeper_request_chunks',
                        missingChunks: missingChunks
                    });
                    
                    // Show notification to user
                    if (ConnectionManager.showNotification) {
                        ConnectionManager.showNotification(
                            'Syncing Game', 
                            'Requesting missing game data...', 
                            'info'
                        );
                    }
                }
                
                // Set a timeout to retry assembly after a delay
                setTimeout(() => {
                    if (pendingGameState) {
                        assembleAndApplyGameState();
                    }
                }, 1000);
                
                return; // Wait for missing chunks
            }
            
            // Create the board first
            createBoard();
            
            // Set mine locations
            mineLocations = [...receivedMineLocations];
            
            // Set mine locations in board state
            for (const mine of mineLocations) {
                if (mine.row < rows && mine.col < cols) {
                    boardState[mine.row][mine.col].isMine = true;
                }
            }
            
            // Calculate adjacent mines
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (!boardState[r][c].isMine) {
                        boardState[r][c].adjacentMines = countAdjacentMines(r, c);
                    }
                }
            }
            
            // Apply all board chunks
            const chunkIndices = Object.keys(receivedBoardChunks).sort((a, b) => Number(a) - Number(b));
            for (const chunkIndex of chunkIndices) {
                const chunk = receivedBoardChunks[chunkIndex];
                for (const cell of chunk) {
                    const { row, col, state } = cell;
                    
                    // Skip if out of bounds (safeguard)
                    if (row >= rows || col >= cols) continue;
                    
                    boardState[row][col].isRevealed = state.isRevealed;
                    boardState[row][col].isFlagged = state.isFlagged;
                    
                    const cellElement = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
                    if (!cellElement) continue;
                    
                    if (state.isRevealed) {
                        cellElement.classList.add('revealed');
                        
                        if (boardState[row][col].isMine) {
                            cellElement.classList.add('mine');
                            cellElement.textContent = '💣';
                        } else if (boardState[row][col].adjacentMines > 0) {
                            cellElement.textContent = boardState[row][col].adjacentMines;
                            cellElement.classList.add(`number-${boardState[row][col].adjacentMines}`);
                        }
                        
                        if (!boardState[row][col].isMine) {
                            revealedCount++;
                        }
                    }
                    
                    if (state.isFlagged) {
                        cellElement.classList.add('flagged');
                    }
                }
            }
            
            // Stop current timer if running
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            
            // Start timer if game is in progress
            if (gameStarted && !gameOver) {
                startTimer();
            }
            
            // Update displays
            updateMineCount();
            updateTimerDisplay();
            
            if (gameOver) {
                // Update reset button to show game over state
                if (resetButton) {
                    resetButton.textContent = revealedCount === (rows * cols - mineCount) ? '😎' : '😵';
                }
            }
            
            // Clear temporary storage
            pendingGameState = null;
            receivedBoardChunks = {};
            receivedMineLocations = null;
            
            console.log('[MinesweeperGame] Game state successfully assembled and applied');
            
            // Show success notification
            if (typeof ConnectionManager !== 'undefined' && ConnectionManager.showNotification) {
                ConnectionManager.showNotification(
                    'Game Synchronized', 
                    'Game state successfully loaded.', 
                    'success'
                );
            }
        } catch (error) {
            console.error('[MinesweeperGame] Error assembling game state:', error);
            // More user-friendly error handling
            if (typeof ConnectionManager !== 'undefined' && ConnectionManager.showNotification) {
                ConnectionManager.showNotification('Sync Error', 'Error synchronizing game state. Attempting to recover...', 'warning');
            } else {
                alert('There was an error synchronizing the game state. You may need to rejoin the room.');
            }
        }
    }
    
    /**
     * Handle requests for missing chunks
     */
    function handleMissingChunksRequest(peerId, data) {
        if (!data.missingChunks || !Array.isArray(data.missingChunks)) return;
        
        console.log('[MinesweeperGame] Received request for missing chunks:', data.missingChunks);
        
        // Only the room creator should respond to chunk requests
        if (!AppState.isRoomCreator) return;
        
        if (!ConnectionManager || typeof ConnectionManager.sendData !== 'function') {
            console.error('[MinesweeperGame] ConnectionManager not available for sending chunks');
            return;
        }
        
        // Re-send the requested chunks
        for (const chunkIndex of data.missingChunks) {
            const startCell = chunkIndex * 50; // Use same chunk size as in sendGameState
            const endCell = Math.min(startCell + 50, rows * cols);
            const chunkBoardState = [];
            
            for (let cellIndex = startCell; cellIndex < endCell; cellIndex++) {
                const row = Math.floor(cellIndex / cols);
                const col = cellIndex % cols;
                chunkBoardState.push({
                    row: row,
                    col: col,
                    state: {
                        isRevealed: boardState[row][col].isRevealed,
                        isFlagged: boardState[row][col].isFlagged
                    }
                });
            }
            
            // Add a small delay between sending chunks to prevent overwhelming the connection
            setTimeout(() => {
                ConnectionManager.sendData({
                    type: 'minesweeper_board_chunk',
                    chunkIndex: chunkIndex,
                    totalChunks: Math.ceil(rows * cols / 50),
                    boardChunk: chunkBoardState,
                    timestamp: Date.now(),
                    sequence: chunkIndex + 1,
                    isResend: true // Mark as a resend
                });
                console.log(`[MinesweeperGame] Resent missing chunk ${chunkIndex}`);
            }, chunkIndex * 50); // Stagger the resends
        }
    }
    
    /**
     * Handle messages from peers specific to Minesweeper
     */
    function handlePeerMessage(peerId, data) {
        try {
            // Handle chunk request messages
            if (data.type === 'minesweeper_request_chunks') {
                handleMissingChunksRequest(peerId, data);
                return;
            }
            
            switch (data.type) {
                case 'minesweeper_cell_click':
                    processCellClick(data.row, data.col, data.isRightClick);
                    break;
                    
                case 'minesweeper_new_game':
                    if (!AppState.isRoomCreator) {
                        rows = data.rows;
                        cols = data.cols;
                        mineCount = data.mineCount;
                        reset();
                        
                        // Update difficulty selector
                        const difficulty = 
                            rows === 9 && cols === 9 ? 'beginner' :
                            rows === 16 && cols === 16 ? 'intermediate' : 'expert';
                        if (difficultySelect) difficultySelect.value = difficulty;
                    }
                    break;
                    
                case 'minesweeper_cursor':
                    updateRemoteCursor(peerId, data.row, data.col);
                    break;
                    
                case 'minesweeper_game_started':
                    gameStarted = true;
                    // Start timer for non-creators
                    if (!AppState.isRoomCreator && !timerInterval) {
                        startTimer();
                    }
                    break;
                    
                case 'minesweeper_mines_placed':
                    if (!AppState.isRoomCreator) {
                        // Set mine locations
                        mineLocations = data.mineLocations;
                        
                        // Update board state with mines
                        data.mineLocations.forEach(mine => {
                            if (mine.row < rows && mine.col < cols) {
                                boardState[mine.row][mine.col].isMine = true;
                            }
                        });
                        
                        // Calculate adjacent mines
                        for (let r = 0; r < rows; r++) {
                            for (let c = 0; c < cols; c++) {
                                if (!boardState[r][c].isMine) {
                                    boardState[r][c].adjacentMines = countAdjacentMines(r, c);
                                }
                            }
                        }
                    }
                    break;
                    
                case 'minesweeper_timer_sync':
                    // Update timer if not room creator
                    if (!AppState.isRoomCreator) {
                        timerValue = data.timerValue;
                        updateTimerDisplay();
                    }
                    break;
                    
                case 'minesweeper_game_over':
                    gameOver = true;
                    
                    // Stop timer
                    if (timerInterval) {
                        clearInterval(timerInterval);
                        timerInterval = null;
                    }
                    
                    // Update timer value
                    timerValue = data.timerValue;
                    updateTimerDisplay();
                    
                    // Update reset button face
                    if (resetButton) {
                        resetButton.textContent = data.isWin ? '😎' : '😵';
                    }
                    
                    // Show game over modal
                    showGameOverModal(data.isWin);
                    break;
                    
                case 'minesweeper_game_state':
                    if (!AppState.isRoomCreator) {
                        console.log('[MinesweeperGame] Received game state, preparing for chunks...');
                        
                        // Store the game state settings and prepare for board chunks
                        pendingGameState = data;
                        receivedBoardChunks = {};
                        receivedMineLocations = null;
                        
                        // Set basic game parameters immediately
                        rows = data.rows;
                        cols = data.cols;
                        mineCount = data.mineCount;
                        remainingMines = data.remainingMines;
                        gameStarted = data.gameStarted;
                        gameOver = data.gameOver;
                        timerValue = data.timerValue;
                        
                        // Update difficulty selector
                        if (difficultySelect) difficultySelect.value = data.difficulty;
                        
                        // Show notification
                        if (typeof ConnectionManager !== 'undefined' && ConnectionManager.showNotification) {
                            ConnectionManager.showNotification(
                                'Syncing Game', 
                                'Receiving game state...', 
                                'info'
                            );
                        }
                    }
                    break;
                    
                case 'minesweeper_board_chunk':
                    if (!AppState.isRoomCreator && pendingGameState) {
                        // Store this chunk
                        receivedBoardChunks[data.chunkIndex] = data.boardChunk;
                        console.log(`[MinesweeperGame] Received chunk ${data.chunkIndex + 1}/${data.totalChunks}`);
                        
                        // Check if we have all chunks and the mine locations
                        if (Object.keys(receivedBoardChunks).length === data.totalChunks && receivedMineLocations) {
                            assembleAndApplyGameState();
                        }
                    }
                    break;
                    
                case 'minesweeper_mine_locations':
                    if (!AppState.isRoomCreator && pendingGameState) {
                        receivedMineLocations = data.mineLocations;
                        console.log('[MinesweeperGame] Received mine locations');
                        
                        // Check if we have all board chunks
                        const receivedChunks = Object.keys(receivedBoardChunks).map(Number);
                        const expectedTotalChunks = pendingGameState.totalChunks || 0;
                        
                        if (receivedChunks.length === expectedTotalChunks) {
                            assembleAndApplyGameState();
                        }
                    }
                    break;
                    
                case 'game_data':
                    if (data.data && data.data.action) {
                        switch (data.data.action) {
                            case 'reset':
                                // Update difficulty if provided
                                if (data.data.difficulty && difficultySelect) {
                                    difficultySelect.value = data.data.difficulty;
                                    
                                    // Update board size based on difficulty
                                    switch (data.data.difficulty) {
                                        case 'beginner':
                                            rows = 9;
                                            cols = 9;
                                            mineCount = 10;
                                            break;
                                        case 'intermediate':
                                            rows = 16;
                                            cols = 16;
                                            mineCount = 40;
                                            break;
                                        case 'expert':
                                            rows = 16;
                                            cols = 30;
                                            mineCount = 99;
                                            break;
                                    }
                                }
                                
                                // Reset the game
                                reset();
                                break;
                                
                            case 'difficulty_change':
                                if (data.data.difficulty && difficultySelect) {
                                    difficultySelect.value = data.data.difficulty;
                                    
                                    // Update board size based on difficulty
                                    switch (data.data.difficulty) {
                                        case 'beginner':
                                            rows = 9;
                                            cols = 9;
                                            mineCount = 10;
                                            break;
                                        case 'intermediate':
                                            rows = 16;
                                            cols = 16;
                                            mineCount = 40;
                                            break;
                                        case 'expert':
                                            rows = 16;
                                            cols = 30;
                                            mineCount = 99;
                                            break;
                                    }
                                    
                                    // Reset game
                                    reset();
                                }
                                break;
                        }
                    }
                    break;
                    
                default:
                    console.log('[MinesweeperGame] Unhandled message type:', data.type);
                    break;
            }
        } catch (error) {
            console.error('[MinesweeperGame] Error handling peer message:', error, data);
        }
    }
    
    // Expose public API
    return {
        init,
        reset,
        handlePeerMessage,
        sendGameState,
        state: {
            get boardState() { return boardState; },
            get mineLocations() { return mineLocations; },
            get revealedCount() { return revealedCount; },
            get gameStarted() { return gameStarted; },
            get gameOver() { return gameOver; },
            get mineCount() { return mineCount; },
            get remainingMines() { return remainingMines; },
            get rows() { return rows; },
            get cols() { return cols; },
            get timerValue() { return timerValue; }
        },
        type: 'minesweeper'
    };
})();