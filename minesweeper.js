/**
 * Mentalplayer - Minesweeper Game Module
 * 
 * Implements the classic Minesweeper game with multiplayer features.
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
        setupEventListeners();
        reset();
    }
    
    /**
     * Set up event listeners specific to Minesweeper
     */
    function setupEventListeners() {
        // Reset button
        resetButton.addEventListener('click', () => {
            if (AppState.isRoomCreator) {
                reset();
            } else {
                alert('Only the room creator can start a new game.');
            }
        });
        
        // New game button in modal
        newGameButton.addEventListener('click', () => {
            gameOverModal.style.display = 'none';
            if (AppState.isRoomCreator) {
                reset();
            }
        });
        
        // Difficulty select
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
                } else {
                    // Reset to current difficulty
                    const currentDifficulty = 
                        rows === 9 && cols === 9 ? 'beginner' :
                        rows === 16 && cols === 16 ? 'intermediate' : 'expert';
                    difficultySelect.value = currentDifficulty;
                }
            } else if (AppState.isRoomCreator) {
                reset();
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
    
    /**
     * Reset the game
     */
    function reset() {
        // Reset game state
        gameStarted = false;
        gameOver = false;
        revealedCount = 0;
        resetButton.textContent = '😊';
        
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
        
        // If room creator, broadcast new game to all peers
        if (AppState.isRoomCreator) {
            broadcastToPeers({
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
        broadcastToPeers({
            type: 'minesweeper_cell_click',
            row: row,
            col: col,
            isRightClick: false
        });
        
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
        broadcastToPeers({
            type: 'minesweeper_cell_click',
            row: row,
            col: col,
            isRightClick: true
        });
        
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
        
        broadcastToPeers({
            type: 'minesweeper_cursor',
            row: row,
            col: col
        });
    }
    
    /**
     * Process cell click (both local and remote)
     */
    function processCellClick(row, col, isRightClick) {
        const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        
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
                        revealCell(neighborCell, r, c, false);
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
        gameStarted = true;
        
        // Place mines (avoiding first click)
        placeMines(firstRow, firstCol);
        
        // Start timer
        startTimer();
    }
    
    /**
     * Start timer
     */
    function startTimer() {
        timerInterval = setInterval(() => {
            timerValue++;
            updateTimerDisplay();
        }, 1000);
    }
    
    /**
     * Update timer display
     */
    function updateTimerDisplay() {
        timerDisplay.textContent = timerValue.toString().padStart(3, '0');
    }
    
    /**
     * Update mine count display
     */
    function updateMineCount() {
        mineCountDisplay.textContent = remainingMines.toString().padStart(3, '0');
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
        resetButton.textContent = isWin ? '😎' : '😵';
        
        // Reveal all mines
        if (!isWin) {
            revealAllMines();
        }
        
        // Show game over modal
        showGameOverModal(isWin);
        
        // Send game over message to chat
        addChatMessage('system', isWin ? 
            `Game over! The team cleared all mines in ${timerValue} seconds! 🎉` :
            `Game over! The team hit a mine. Better luck next time! 💣`
        );
    }
    
    /**
     * Reveal all mines when game is lost
     */
    function revealAllMines() {
        mineLocations.forEach(loc => {
            const cell = document.querySelector(`.cell[data-row="${loc.row}"][data-col="${loc.col}"]`);
            
            if (!boardState[loc.row][loc.col].isRevealed) {
                cell.classList.add('revealed');
                cell.classList.add('mine');
                cell.textContent = '💣';
            }
            
            // Mark incorrectly flagged cells
            if (boardState[loc.row][loc.col].isFlagged) {
                cell.classList.remove('flagged');
            }
        });
        
        // Mark incorrectly flagged cells
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (boardState[r][c].isFlagged && !boardState[r][c].isMine) {
                    const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
                    cell.classList.add('revealed');
                    cell.textContent = '❌';
                }
            }
        }
    }
    
    /**
     * Show game over modal
     */
    function showGameOverModal(isWin) {
        gameResultTitle.textContent = isWin ? 'You Win!' : 'Game Over';
        gameMessage.textContent = isWin ? 
            `Congratulations! You cleared all mines in ${timerValue} seconds.` : 
            'You hit a mine! Better luck next time.';
        
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
            if (AppState.players[peerId]) {
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
    
    // Store received board chunks for assembly
    let receivedBoardChunks = {};
    let receivedMineLocations = null;
    let pendingGameState = null;
    
    /**
     * Handle messages from peers specific to Minesweeper
     */
    function handlePeerMessage(peerId, data) {
        try {
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
                        difficultySelect.value = difficulty;
                    }
                    break;
                    
                case 'minesweeper_cursor':
                    updateRemoteCursor(peerId, data.row, data.col);
                    break;
                    
                case 'minesweeper_game_state':
                    if (!AppState.isRoomCreator) {
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
                        difficultySelect.value = data.difficulty;
                    }
                    break;
                    
                case 'minesweeper_board_chunk':
                    if (!AppState.isRoomCreator && pendingGameState) {
                        // Store this chunk
                        receivedBoardChunks[data.chunkIndex] = data.boardChunk;
                        
                        // Check if we have all chunks and the mine locations
                        if (Object.keys(receivedBoardChunks).length === data.totalChunks && receivedMineLocations) {
                            assembleAndApplyGameState();
                        }
                    }
                    break;
                    
                case 'minesweeper_mine_locations':
                    if (!AppState.isRoomCreator && pendingGameState) {
                        receivedMineLocations = data.mineLocations;
                        
                        // Check if we have all board chunks
                        if (Object.keys(receivedBoardChunks).length > 0 && 
                            receivedBoardChunks[0].length > 0 && 
                            receivedMineLocations) {
                            assembleAndApplyGameState();
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error('Error handling peer message:', error, data);
        }
    }
    
    /**
     * Assemble and apply the complete game state from chunks
     */
    function assembleAndApplyGameState() {
        if (!pendingGameState || !receivedMineLocations) return;
        
        try {
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
            const chunkIndices = Object.keys(receivedBoardChunks).sort((a, b) => a - b);
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
                resetButton.textContent = revealedCount === (rows * cols - mineCount) ? '😎' : '😵';
            }
            
            // Clear temporary storage
            pendingGameState = null;
            receivedBoardChunks = {};
            receivedMineLocations = null;
            
            console.log('Game state successfully assembled and applied');
        } catch (error) {
            console.error('Error assembling game state:', error);
            alert('There was an error synchronizing the game state. You may need to rejoin the room.');
        }
    }
    
    /**
     * Send complete game state to a peer
     */
    function sendGameState(conn) {
        try {
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
                difficulty: difficultySelect.value
            });
            
            // Send a small delay to prevent overwhelming the connection
            setTimeout(() => {
                // Then send board state in chunks to prevent message size issues
                const chunkSize = 50; // Number of cells to send in each chunk
                const totalCells = rows * cols;
                const totalChunks = Math.ceil(totalCells / chunkSize);
                
                for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                    const chunkBoardState = [];
                    const startCell = chunkIndex * chunkSize;
                    const endCell = Math.min(startCell + chunkSize, totalCells);
                    
                    for (let cellIndex = startCell; cellIndex < endCell; cellIndex++) {
                        const row = Math.floor(cellIndex / cols);
                        const col = cellIndex % cols;
                        chunkBoardState.push({
                            row: row,
                            col: col,
                            state: boardState[row][col]
                        });
                    }
                    
                    conn.send({
                        type: 'minesweeper_board_chunk',
                        chunkIndex: chunkIndex,
                        totalChunks: totalChunks,
                        boardChunk: chunkBoardState
                    });
                }
                
                // Finally send mine locations
                conn.send({
                    type: 'minesweeper_mine_locations',
                    mineLocations: mineLocations
                });
            }, 300);
        } catch (error) {
            console.error('Error sending game state:', error);
        }
    }
    
    /**
     * Handle when a player leaves the game
     */
    function handlePlayerLeave(playerId) {
        // This method could be called from app.js when a player disconnects
        // We could add visual indicators or gameplay adjustments here
        console.log('Player left the game:', playerId);
    }
    
    // Return public API
    return {
        init,
        reset,
        handlePeerMessage,
        sendGameState
    };
})();