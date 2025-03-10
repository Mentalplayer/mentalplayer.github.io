/**
 * Mentalplayer - Minesweeper Game Module
 * Simplified and improved version
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
                // Only the room creator can reset
                if (!AppState || AppState.isRoomCreator) {
                    reset();
                    
                    // Broadcast reset to other players
                    if (typeof ConnectionManager !== 'undefined' && ConnectionManager.state.connected) {
                        ConnectionManager.sendData({
                            type: 'minesweeper_reset',
                            difficulty: difficultySelect ? difficultySelect.value : 'intermediate'
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
                if (!AppState || AppState.isRoomCreator) {
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
                
                if (!AppState || AppState.isRoomCreator) {
                    // Only change difficulty if we're the room creator
                    reset();
                    
                    // Broadcast difficulty change
                    if (typeof ConnectionManager !== 'undefined' && ConnectionManager.state.connected) {
                        ConnectionManager.sendData({
                            type: 'minesweeper_difficulty',
                            difficulty: difficulty
                        });
                    }
                } else {
                    // Reset to current difficulty
                    const currentDifficulty = 
                        rows === 9 && cols === 9 ? 'beginner' :
                        rows === 16 && cols === 16 ? 'intermediate' : 'expert';
                    difficultySelect.value = currentDifficulty;
                    
                    alert('Only the room creator can change difficulty.');
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
        if (AppState && AppState.isRoomCreator && typeof ConnectionManager !== 'undefined') {
            ConnectionManager.sendData({
                type: 'minesweeper_mines',
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
        if (typeof ConnectionManager !== 'undefined' && ConnectionManager.state.connected) {
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
        if (typeof ConnectionManager !== 'undefined' && ConnectionManager.state.connected) {
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
            if (!AppState || AppState.isRoomCreator) {
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
        if (typeof ConnectionManager !== 'undefined' && ConnectionManager.state.connected) {
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
            if (timerValue % 5 === 0 && AppState && AppState.isRoomCreator && 
                typeof ConnectionManager !== 'undefined' && ConnectionManager.state.connected) {
                ConnectionManager.sendData({
                    type: 'minesweeper_timer',
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
        if (typeof ConnectionManager !== 'undefined' && ConnectionManager.state.connected) {
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
     * Send full game state to a peer
     */
    function sendGameState(connManager) {
        console.log('[MinesweeperGame] Sending game state to peer...');
        
        if (!connManager || typeof connManager.sendData !== 'function') {
            console.error('[MinesweeperGame] Connection manager not available for sending game state');
            return;
        }

        // Send game configuration
        connManager.sendData({
            type: 'minesweeper_state',
            rows: rows,
            cols: cols,
            mineCount: mineCount,
            remainingMines: remainingMines,
            gameStarted: gameStarted,
            gameOver: gameOver,
            timerValue: timerValue,
            mineLocations: mineLocations
        });

        // Send board state in a single message to simplify
        const serializedBoard = [];
        
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (boardState[r][c].isRevealed || boardState[r][c].isFlagged) {
                    serializedBoard.push({
                        row: r,
                        col: c,
                        isRevealed: boardState[r][c].isRevealed,
                        isFlagged: boardState[r][c].isFlagged
                    });
                }
            }
        }
        
        connManager.sendData({
            type: 'minesweeper_board_state',
            boardState: serializedBoard
        });
    }
    
    /**
     * Handle messages from peers specific to Minesweeper
     */
    function handlePeerMessage(peerId, data) {
        if (!data || !data.type) return;
        
        switch (data.type) {
            case 'minesweeper_cell_click':
                processCellClick(data.row, data.col, data.isRightClick);
                break;
                
            case 'minesweeper_game_started':
                gameStarted = true;
                // Start timer for non-creators
                if (AppState && !AppState.isRoomCreator && !timerInterval) {
                    startTimer();
                }
                break;
                
            case 'minesweeper_mines':
                if (AppState && !AppState.isRoomCreator) {
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
                
            case 'minesweeper_timer':
                // Update timer if not room creator
                if (AppState && !AppState.isRoomCreator) {
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
                
            case 'minesweeper_reset':
                // Update difficulty if provided
                if (data.difficulty && difficultySelect) {
                    difficultySelect.value = data.difficulty;
                    
                    // Update board size based on difficulty
                    switch (data.difficulty) {
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
                
            case 'minesweeper_difficulty':
                if (data.difficulty && difficultySelect) {
                    difficultySelect.value = data.difficulty;
                    
                    // Update board size based on difficulty
                    switch (data.difficulty) {
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
                
            case 'minesweeper_state':
                // Apply game configuration
                rows = data.rows;
                cols = data.cols;
                mineCount = data.mineCount;
                remainingMines = data.remainingMines;
                gameStarted = data.gameStarted;
                gameOver = data.gameOver;
                timerValue = data.timerValue;
                mineLocations = data.mineLocations;
                
                // Update difficulty selector
                if (difficultySelect) {
                    const difficulty = 
                        rows === 9 && cols === 9 ? 'beginner' :
                        rows === 16 && cols === 16 ? 'intermediate' : 'expert';
                    difficultySelect.value = difficulty;
                }
                
                // Create a fresh board that will be populated next
                createBoard();
                
                // Update mine locations
                mineLocations.forEach(mine => {
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
                
                // Update displays
                updateMineCount();
                updateTimerDisplay();
                
                // Update game face
                if (resetButton) {
                    resetButton.textContent = gameOver ? 
                        (revealedCount === (rows * cols - mineCount) ? '😎' : '😵') : '😊';
                }
                
                // Start timer if game is in progress
                if (gameStarted && !gameOver && !timerInterval) {
                    startTimer();
                }
                break;
                
            case 'minesweeper_board_state':
                // Apply board state
                if (data.boardState && Array.isArray(data.boardState)) {
                    data.boardState.forEach(cellData => {
                        const { row, col, isRevealed, isFlagged } = cellData;
                        
                        // Skip if out of bounds
                        if (row >= rows || col >= cols) return;
                        
                        const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
                        if (!cell) return;
                        
                        // Update board state
                        boardState[row][col].isRevealed = isRevealed;
                        boardState[row][col].isFlagged = isFlagged;
                        
                        // Update UI
                        if (isRevealed) {
                            cell.classList.add('revealed');
                            
                            if (boardState[row][col].isMine) {
                                cell.classList.add('mine');
                                cell.textContent = '💣';
                            } else if (boardState[row][col].adjacentMines > 0) {
                                cell.textContent = boardState[row][col].adjacentMines;
                                cell.classList.add(`number-${boardState[row][col].adjacentMines}`);
                            }
                            
                            // Count revealed cells
                            if (!boardState[row][col].isMine) {
                                revealedCount++;
                            }
                        }
                        
                        if (isFlagged) {
                            cell.classList.add('flagged');
                        }
                    });
                }
                break;
        }
    }
    
    // Expose public API
    return {
        init,
        reset,
        handlePeerMessage,
        sendGameState,
        type: 'minesweeper'
    };
})();

// Make sure MinesweeperGame is globally available
window.MinesweeperGame = MinesweeperGame;