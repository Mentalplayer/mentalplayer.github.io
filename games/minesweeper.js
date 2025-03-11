/**
 * Minesweeper Game Module for MentalPlayer
 * Multiplayer implementation of the classic Minesweeper game
 * 
 * @version 2.0.0
 */

// Create Minesweeper module using IIFE pattern
const MinesweeperGame = (() => {
    // Emergency direct handlers
    window.emergencyMinesweeperHandlers = {
        handleCellClick: function(row, col, playerId) {
            console.log(`[EMERGENCY] Handling cell click at ${row},${col} from ${playerId}`);
            
            // Get the appropriate cell directly
            const board = document.querySelector('.game-board');
            if (!board) {
                console.error("[EMERGENCY] Game board not found!");
                return false;
            }
            
            const cell = board.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
            if (!cell) {
                console.error(`[EMERGENCY] Cell ${row},${col} not found!`);
                return false;
            }
            
            // Simulate a click on this cell
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            cell.dispatchEvent(clickEvent);
            return true;
        },
        
        toggleFlag: function(row, col, playerId) {
            console.log(`[EMERGENCY] Toggling flag at ${row},${col} from ${playerId}`);
            
            // Get the appropriate cell directly
            const board = document.querySelector('.game-board');
            if (!board) {
                console.error("[EMERGENCY] Game board not found!");
                return false;
            }
            
            const cell = board.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
            if (!cell) {
                console.error(`[EMERGENCY] Cell ${row},${col} not found!`);
                return false;
            }
            
            // Simulate a right click
            const contextMenuEvent = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            cell.dispatchEvent(contextMenuEvent);
            return true;
        }
    };


    // Game metadata
    const metadata = {
        id: 'minesweeper',
        name: 'Minesweeper',
        description: 'Classic puzzle game with multiplayer collaboration',
        icon: '💣'
    };
    
    // Game state
    let state = {
        board: [],
        mines: [],
        revealed: 0,
        flagged: [],
        gameStarted: false,
        gameOver: false,
        gameWon: false,
        difficulty: 'intermediate',
        rows: 16,
        cols: 16,
        mineCount: 40,
        remainingMines: 40,
        timer: 0,
        timerInterval: null,
        playerActions: {}, // Track actions by player ID
        container: null,
        context: null
    };
    
    // Difficulty presets
    const difficultyPresets = {
        beginner: {
            rows: 9,
            cols: 9,
            mineCount: 10
        },
        intermediate: {
            rows: 16,
            cols: 16,
            mineCount: 40
        },
        expert: {
            rows: 16,
            cols: 30,
            mineCount: 99
        }
    };
    
    // Element references
    let elements = {
        board: null,
        statusBar: null,
        mineCounter: null,
        timer: null,
        resetButton: null,
        difficultySelect: null
    };
    
    /**
     * Initialize the game
     * @param {HTMLElement} container Element to render the game in
     * @param {Object} context Game context with connection and state info
     */
    function init(container, context) {
        console.log('[Minesweeper] Initializing game');
        
        // Store container and context for later use
        state.container = container;
        state.context = context;
        
        // Create game HTML structure
        createGameUI(container);
        
        // Set up event listeners for game controls
        setupEventListeners();
        
        // Initialize game based on current difficulty
        applyDifficulty(state.difficulty);
        resetGame();
        
        console.log('[Minesweeper] Game initialized');
        
        return true;
    }
    
    function sendGameAction(action, data = {}) {
        console.log(`[Minesweeper] Sending game action: ${action}`, data);
    
        if (state.context && state.context.sendMessage) {
            state.context.sendMessage('game_data', {
                game: 'minesweeper',
                action,
                ...data
            });
        }
    }

    /**
     * Create game UI structure
     * @param {HTMLElement} container Container to render in
     */
    function createGameUI(container) {
        if (!container) return;
        
        container.innerHTML = `
            <div class="minesweeper-game">
                <div class="game-controls">
                    <select id="minesweeper-difficulty">
                        <option value="beginner">Beginner (9x9, 10 mines)</option>
                        <option value="intermediate" selected>Intermediate (16x16, 40 mines)</option>
                        <option value="expert">Expert (16x30, 99 mines)</option>
                    </select>
                </div>
                
                <div class="status-bar">
                    <div class="mine-counter">000</div>
                    <button class="reset-button">😊</button>
                    <div class="timer">000</div>
                </div>
                
                <div class="game-board"></div>
                
                <div class="game-info">
                    <div class="controls-help">
                        <p><strong>Controls:</strong> Left-click to reveal a cell, right-click to flag/unflag</p>
                    </div>
                    <div class="collaboration-info">
                        <p>All players can reveal and flag cells. Be careful not to reveal mines!</p>
                    </div>
                </div>
            </div>
        `;
        
        // Store element references
        elements.board = container.querySelector('.game-board');
        elements.statusBar = container.querySelector('.status-bar');
        elements.mineCounter = container.querySelector('.mine-counter');
        elements.timer = container.querySelector('.timer');
        elements.resetButton = container.querySelector('.reset-button');
        elements.difficultySelect = container.querySelector('#minesweeper-difficulty');
    }
    
    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Reset button
        if (elements.resetButton) {
            elements.resetButton.addEventListener('click', () => {
                // Only host can reset game
                if (state.context && state.context.connection && !state.context.connection.state.isHost) {
                    showHostOnlyMessage();
                    return;
                }
                
                resetGame();
                
                // Notify peers
                sendGameAction('reset', {
                    difficulty: state.difficulty
                });
            });
        }
        
        // Difficulty select
        if (elements.difficultySelect) {
            elements.difficultySelect.addEventListener('change', () => {
                // Only host can change difficulty
                if (state.context && state.context.connection && !state.context.connection.state.isHost) {
                    // Reset selection
                    elements.difficultySelect.value = state.difficulty;
                    showHostOnlyMessage();
                    return;
                }
                
                const newDifficulty = elements.difficultySelect.value;
                applyDifficulty(newDifficulty);
                resetGame();
                
                // Notify peers
                sendGameAction('difficulty_changed', {
                    difficulty: newDifficulty
                });
            });
        }
    }
    
    /**
     * Show message for host-only actions
     */
    function showHostOnlyMessage() {
        if (state.context && state.context.state) {
            state.context.state.showNotification(
                'Host Only Action',
                'Only the room host can perform this action',
                'warning'
            );
        } else {
            alert('Only the room host can perform this action');
        }
    }
    
    /**
     * Apply difficulty settings
     * @param {string} difficulty Difficulty preset name
     */
    function applyDifficulty(difficulty) {
        if (!difficultyPresets[difficulty]) {
            console.warn(`[Minesweeper] Unknown difficulty: ${difficulty}`);
            difficulty = 'intermediate';
        }
        
        // Update select element if needed
        if (elements.difficultySelect && elements.difficultySelect.value !== difficulty) {
            elements.difficultySelect.value = difficulty;
        }
        
        // Apply settings
        const preset = difficultyPresets[difficulty];
        state.difficulty = difficulty;
        state.rows = preset.rows;
        state.cols = preset.cols;
        state.mineCount = preset.mineCount;
        state.remainingMines = preset.mineCount;
        
        // Update CSS variables for board size
        if (elements.board) {
            elements.board.style.setProperty('--rows', state.rows);
            elements.board.style.setProperty('--cols', state.cols);
        }
        
        console.log(`[Minesweeper] Applied difficulty: ${difficulty}`);
    }
    
    /**
     * Reset/restart the game
     */
    function resetGame() {
        console.log('[Minesweeper] Resetting game');
        
        // Reset game state
        state.board = [];
        state.mines = [];
        state.revealed = 0;
        state.flagged = [];
        state.gameStarted = false;
        state.gameOver = false;
        state.gameWon = false;
        state.playerActions = {};
        state.remainingMines = state.mineCount;
        
        // Reset timer
        stopTimer();
        state.timer = 0;
        updateTimerDisplay();
        
        // Reset mine counter
        updateMineCounter();
        
        // Reset face
        if (elements.resetButton) {
            elements.resetButton.textContent = '😊';
        }
        
        // Create new board
        createBoard();
        
        console.log('[Minesweeper] Game reset complete');
    }
    
    /**
     * Create the game board
     */
    function createBoard() {
        if (!elements.board) return;
        
        // Clear board
        elements.board.innerHTML = '';
        
        // Initialize board array
        state.board = Array(state.rows).fill().map(() => 
            Array(state.cols).fill().map(() => ({
                hasMine: false,
                revealed: false,
                flagged: false,
                neighborMines: 0
            }))
        );
        
        // Create cells
        for (let row = 0; row < state.rows; row++) {
            for (let col = 0; col < state.cols; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                // Add event listeners
                cell.addEventListener('click', handleCellClick);
                cell.addEventListener('contextmenu', handleCellRightClick);
                
                elements.board.appendChild(cell);
            }
        }
        
        console.log(`[Minesweeper] Created board: ${state.rows}x${state.cols}`);
    }
    
    /**
     * Place mines on the board (excluding first clicked cell)
     * @param {number} firstRow Row of first click
     * @param {number} firstCol Column of first click
     */
    function placeMines(firstRow, firstCol) {
        // Create list of safe cells around first click
        const safePositions = new Set();
        for (let r = Math.max(0, firstRow - 1); r <= Math.min(state.rows - 1, firstRow + 1); r++) {
            for (let c = Math.max(0, firstCol - 1); c <= Math.min(state.cols - 1, firstCol + 1); c++) {
                safePositions.add(`${r},${c}`);
            }
        }
        
        // Place mines
        let minesPlaced = 0;
        state.mines = [];
        
        while (minesPlaced < state.mineCount) {
            const row = Math.floor(Math.random() * state.rows);
            const col = Math.floor(Math.random() * state.cols);
            const posKey = `${row},${col}`;
            
            // Skip safe positions and already placed mines
            if (safePositions.has(posKey) || state.board[row][col].hasMine) {
                continue;
            }
            
            // Place mine
            state.board[row][col].hasMine = true;
            state.mines.push({ row, col });
            minesPlaced++;
        }
        
        // Calculate neighbor mine counts
        for (let row = 0; row < state.rows; row++) {
            for (let col = 0; col < state.cols; col++) {
                if (!state.board[row][col].hasMine) {
                    state.board[row][col].neighborMines = countNeighborMines(row, col);
                }
            }
        }
        
        console.log(`[Minesweeper] Placed ${minesPlaced} mines`);
        
        // Notify peers about mine positions if we're the host
        if (state.context && state.context.connection && state.context.connection.state.isHost) {
            sendGameAction('mines_placed', {
                mines: state.mines,
                firstClick: { row: firstRow, col: firstCol }
            });
        }
    }
    
    /**
     * Count neighboring mines for a cell
     * @param {number} row Row index
     * @param {number} col Column index
     * @returns {number} Number of neighboring mines
     */
    function countNeighborMines(row, col) {
        let count = 0;
        
        for (let r = Math.max(0, row - 1); r <= Math.min(state.rows - 1, row + 1); r++) {
            for (let c = Math.max(0, col - 1); c <= Math.min(state.cols - 1, col + 1); c++) {
                if (r === row && c === col) continue; // Skip the cell itself
                if (state.board[r][c].hasMine) count++;
            }
        }
        
        return count;
    }
    
    /**
     * Handle cell click (reveal)
     * @param {Event} event Click event
     */
    function handleCellClick(event) {
        const cell = event.target;
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        
        // Ignore clicks if game is over or cell is flagged
        if (state.gameOver || state.board[row][col].flagged) {
            return;
        }
        
        // Perform action
        revealCell(row, col);
        
        // Notify peers
        sendGameAction('cell_click', {
            row,
            col
        });
    }
    
    /**
     * Handle right click on cell (flag)
     * @param {Event} event Right click event
     */
    function handleCellRightClick(event) {
        event.preventDefault(); // Prevent context menu
        
        const cell = event.target;
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        
        // Ignore clicks if game is over or cell is revealed
        if (state.gameOver || state.board[row][col].revealed) {
            return;
        }
        
        // Toggle flag
        toggleFlag(row, col);
        
        // Notify peers
        sendGameAction('cell_flag', {
            row,
            col,
            flagged: state.board[row][col].flagged
        });
    }
    
    /**
     * Reveal a cell
     * @param {number} row Row index
     * @param {number} col Column index
     * @param {string} [playerId] ID of player who revealed (for sync)
     */
    function revealCell(row, col, playerId = null) {
        // Validate row/col
        if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) {
            return;
        }
        
        // Ignore if already revealed or flagged
        if (state.board[row][col].revealed || state.board[row][col].flagged) {
            return;
        }
        
        // Start game on first click
        if (!state.gameStarted) {
            startGame(row, col);
        }
        
        // Mark as revealed
        state.board[row][col].revealed = true;
        state.revealed++;
        
        // Track player action if playerId provided
        if (playerId) {
            if (!state.playerActions[playerId]) {
                state.playerActions[playerId] = { reveals: 0, flags: 0 };
            }
            state.playerActions[playerId].reveals++;
        }
        
        // Update UI
        const cellElement = getCellElement(row, col);
        if (cellElement) {
            cellElement.classList.add('revealed');
            
            // If it's a mine, game over
            if (state.board[row][col].hasMine) {
                cellElement.classList.add('mine');
                cellElement.textContent = '💣';
                endGame(false, playerId);
                return;
            }
            
            // Show number of neighboring mines
            const neighborMines = state.board[row][col].neighborMines;
            if (neighborMines > 0) {
                cellElement.textContent = neighborMines;
                cellElement.classList.add(`neighbors-${neighborMines}`);
            } else {
                // Auto-reveal empty neighbors
                revealEmptyNeighbors(row, col, playerId);
            }
            
            // Check win condition
            checkWinCondition(playerId);
        }
    }
    
    /**
     * Reveal empty neighboring cells
     * @param {number} row Row index
     * @param {number} col Column index
     * @param {string} [playerId] ID of player who revealed (for sync)
     */
    function revealEmptyNeighbors(row, col, playerId = null) {
        for (let r = Math.max(0, row - 1); r <= Math.min(state.rows - 1, row + 1); r++) {
            for (let c = Math.max(0, col - 1); c <= Math.min(state.cols - 1, col + 1); c++) {
                if (r === row && c === col) continue; // Skip the cell itself
                if (!state.board[r][c].revealed && !state.board[r][c].flagged) {
                    revealCell(r, c, playerId);
                }
            }
        }
    }
    
    /**
     * Toggle flag on a cell
     * @param {number} row Row index
     * @param {number} col Column index
     * @param {string} [playerId] ID of player who flagged (for sync)
     */
    function toggleFlag(row, col, playerId = null) {
        // Validate row/col
        if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) {
            return;
        }
        
        // Ignore if revealed
        if (state.board[row][col].revealed) {
            return;
        }
        
        // Make sure game has started
        if (!state.gameStarted) {
            startGame(row, col);
        }
        
        // Toggle flag
        state.board[row][col].flagged = !state.board[row][col].flagged;
        
        // Update remaining mines count
        if (state.board[row][col].flagged) {
            state.remainingMines--;
            // Keep track of flagged positions
            state.flagged.push({ row, col });
        } else {
            state.remainingMines++;
            // Remove from flagged positions
            state.flagged = state.flagged.filter(pos => !(pos.row === row && pos.col === col));
        }
        
        // Track player action if playerId provided
        if (playerId) {
            if (!state.playerActions[playerId]) {
                state.playerActions[playerId] = { reveals: 0, flags: 0 };
            }
            
            if (state.board[row][col].flagged) {
                state.playerActions[playerId].flags++;
            } else {
                state.playerActions[playerId].flags--;
            }
        }
        
        // Update UI
        updateMineCounter();
        const cellElement = getCellElement(row, col);
        if (cellElement) {
            if (state.board[row][col].flagged) {
                cellElement.classList.add('flagged');
                cellElement.textContent = '🚩';
            } else {
                cellElement.classList.remove('flagged');
                cellElement.textContent = '';
            }
        }
    }
    
    /**
     * Start the game
     * @param {number} firstRow Row of first click
     * @param {number} firstCol Column of first click
     */
    function startGame(firstRow, firstCol) {
        // Only place mines if we're the host or this is the first action
        if ((state.context && state.context.connection && state.context.connection.state.isHost) || state.mines.length === 0) {
            placeMines(firstRow, firstCol);
        }
        
        state.gameStarted = true;
        startTimer();
        
        // Notify peers that game has started
        sendGameAction('game_started');
        
        console.log('[Minesweeper] Game started');
    }
    
    /**
     * Start game timer
     */
    function startTimer() {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
        }
        
        state.timerInterval = setInterval(() => {
            state.timer++;
            updateTimerDisplay();
            
            // Sync timer with peers occasionally (host only)
            if (state.timer % 5 === 0 && state.context && state.context.connection && state.context.connection.state.isHost) {
                sendGameAction('timer_sync', { timer: state.timer });
            }
        }, 1000);
    }
    
    /**
     * Stop game timer
     */
    function stopTimer() {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
    }
    
    /**
     * Update timer display
     */
    function updateTimerDisplay() {
        if (elements.timer) {
            elements.timer.textContent = state.timer.toString().padStart(3, '0');
        }
    }
    
    /**
     * Update mine counter display
     */
    function updateMineCounter() {
        if (elements.mineCounter) {
            // Ensure non-negative display
            const displayValue = Math.max(0, state.remainingMines);
            elements.mineCounter.textContent = displayValue.toString().padStart(3, '0');
        }
    }
    
    /**
     * Check win condition
     * @param {string} [playerId] ID of player who made the last move
     */
    function checkWinCondition(playerId = null) {
        // Win if all non-mine cells are revealed
        const totalCells = state.rows * state.cols;
        const nonMineCells = totalCells - state.mineCount;
        
        if (state.revealed === nonMineCells && !state.gameOver) {
            endGame(true, playerId);
        }
    }
    
    /**
     * End the game
     * @param {boolean} won Whether the game was won
     * @param {string} [playerId] ID of player who ended the game
     */
    function endGame(won, playerId = null) {
        if (state.gameOver) return;
        
        state.gameOver = true;
        state.gameWon = won;
        stopTimer();
        
        // Update UI
        if (elements.resetButton) {
            elements.resetButton.textContent = won ? '😎' : '😵';
        }
        
        if (won) {
            // Flag all mines
            state.mines.forEach(mine => {
                if (!state.board[mine.row][mine.col].flagged) {
                    const cellElement = getCellElement(mine.row, mine.col);
                    if (cellElement) {
                        cellElement.classList.add('flagged');
                        cellElement.textContent = '🚩';
                    }
                    
                    state.board[mine.row][mine.col].flagged = true;
                }
            });
        } else {
            // Reveal all mines
            revealAllMines();
        }
        
        // Show game over message
        showGameResult(won, playerId);
        
        // Notify peers
        sendGameAction('game_over', {
            won,
            timer: state.timer,
            playerId
        });
        
        console.log(`[Minesweeper] Game over: ${won ? 'win' : 'loss'}`);
    }
    
    /**
     * Reveal all mines
     */
    function revealAllMines() {
        state.mines.forEach(mine => {
            const { row, col } = mine;
            const cellElement = getCellElement(row, col);
            
            if (cellElement) {
                if (!state.board[row][col].revealed) {
                    cellElement.classList.add('revealed');
                    cellElement.classList.add('mine');
                    cellElement.textContent = '💣';
                }
            }
        });
        
        // Mark incorrect flags
        for (let row = 0; row < state.rows; row++) {
            for (let col = 0; col < state.cols; col++) {
                if (state.board[row][col].flagged && !state.board[row][col].hasMine) {
                    const cellElement = getCellElement(row, col);
                    if (cellElement) {
                        cellElement.classList.add('wrong-flag');
                        cellElement.textContent = '❌';
                    }
                }
            }
        }
    }
    
    /**
     * Show game result message
     * @param {boolean} won Whether the game was won
     * @param {string} [playerId] ID of player who ended the game
     */
    function showGameResult(won, playerId = null) {
        let playerName = 'Someone';
        
        if (playerId && state.context && state.context.connection) {
            // Get player name from connection manager
            const peers = state.context.connection.state.peers;
            if (peers && peers[playerId]) {
                playerName = peers[playerId].name;
            } else if (playerId === state.context.connection.state.userId) {
                playerName = 'You';
            }
        }
        
        // Build message
        let title = won ? 'Game Won!' : 'Game Over';
        let message = won ?
            `${playerName} cleared all mines in ${state.timer} seconds!` :
            `${playerName} hit a mine! Better luck next time.`;
        
        // Show notification
        if (state.context && state.context.showNotification) {
            state.context.showNotification(title, message, won ? 'success' : 'error');
        } else {
            alert(`${title}: ${message}`);
        }
        
        // Add system message to chat
        if (state.context && state.context.addChatMessage) {
            state.context.addChatMessage('system', '', message);
        }
    }
    
    /**
     * Get cell element for a grid position
     * @param {number} row Row index
     * @param {number} col Column index
     * @returns {HTMLElement|null} Cell element or null if not found
     */
    function getCellElement(row, col) {
        if (!elements.board) return null;
        return elements.board.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    }
    
    /**
     * Send game action to peers
     * @param {string} action Action name
     * @param {Object} [data={}] Action data
     */
    function sendGameAction(action, data = {}) {
        if (state.context && state.context.sendMessage) {
            state.context.sendMessage('game_data', {
                game: 'minesweeper',
                action,
                ...data
            });
        }
    }
    
    /**
     * Handle incoming message from peers
     * @param {string} peerId ID of the sending peer
     * @param {Object} message Message data
     */
    function handleMessage(peerId, message) {
        // Log full message
        console.log(`[Minesweeper] Message received from ${peerId}:`, message);
    
        // Extract game data from different possible message structures
        let gameData = null;
    
        if (message.data && message.data.game === 'minesweeper') {
            // Standard structure: { data: { game: 'minesweeper', action: '...' } }
            gameData = message.data;
        } else if (message.gameId === 'minesweeper' && message.data) {
            // Alternate structure: { gameId: 'minesweeper', data: { ... } }
            gameData = message.data;
        }
    
        if (!gameData || !gameData.action) {
            console.warn('[Minesweeper] Invalid message format or missing action:', message);
            return;
        }
    
        console.log(`[Minesweeper] Processing action: ${gameData.action} with data:`, gameData);
    
        // Handle specific actions
        switch (gameData.action) {
            case 'cell_click':
                console.log(`[Minesweeper] Cell click at row:${gameData.row}, col:${gameData.col}`);
            
                // Try emergency handler first
                if (window.emergencyMinesweeperHandlers && 
                    window.emergencyMinesweeperHandlers.handleCellClick) {
                    const success = window.emergencyMinesweeperHandlers.handleCellClick(
                        gameData.row, gameData.col, peerId
                    );
                    console.log(`[Minesweeper] Emergency cell click handler ${success ? 'succeeded' : 'failed'}`);
                }
            
                // Also try normal handler
                revealCell(gameData.row, gameData.col, peerId);
                break;
            
            case 'cell_flag':
                console.log(`[Minesweeper] Cell flag at row:${gameData.row}, col:${gameData.col}`);
            
                // Try emergency handler first
                if (window.emergencyMinesweeperHandlers && 
                    window.emergencyMinesweeperHandlers.toggleFlag) {
                    const success = window.emergencyMinesweeperHandlers.toggleFlag(
                        gameData.row, gameData.col, peerId
                    );
                    console.log(`[Minesweeper] Emergency flag handler ${success ? 'succeeded' : 'failed'}`);
                }
            
                // Also try normal handler
                // Set flag directly to specified state
                if (gameData.flagged !== state.board[gameData.row][gameData.col].flagged) {
                    toggleFlag(gameData.row, gameData.col, peerId);
                }
                break;
            
            // Keep the rest of the cases the same...
            case 'game_started':
                state.gameStarted = true;
                // Start timer if not host
                if (state.context && state.context.connection && !state.context.connection.state.isHost) {
                    startTimer();
                }
                break;
            
            case 'mines_placed':
                // Only apply if we're not the host
                if (state.context && state.context.connection && !state.context.connection.state.isHost) {
                    // Set mines
                    state.mines = data.mines;
                
                    // Update board
                    state.mines.forEach(mine => {
                        if (mine.row < state.rows && mine.col < state.cols) {
                            state.board[mine.row][mine.col].hasMine = true;
                        }
                    });
                
                    // Calculate neighbor counts
                    for (let row = 0; row < state.rows; row++) {
                        for (let col = 0; col < state.cols; col++) {
                            if (!state.board[row][col].hasMine) {
                                state.board[row][col].neighborMines = countNeighborMines(row, col);
                            }
                        }
                    }
                }
                break;
            
            case 'timer_sync':
                // Update timer if we're not the host
                if (state.context && state.context.connection && !state.context.connection.state.isHost) {
                    state.timer = data.timer;
                    updateTimerDisplay();
                }
                break;
            
            case 'game_over':
                // Only handle if game not already over
                if (!state.gameOver) {
                    state.gameOver = true;
                    state.gameWon = data.won;
                    stopTimer();
                
                    // Update timer
                    state.timer = data.timer;
                    updateTimerDisplay();
                
                    // Update UI
                    if (elements.resetButton) {
                        elements.resetButton.textContent = data.won ? '😎' : '😵';
                    }
                
                    // Show result
                    if (data.won) {
                        // Flag all mines
                        state.mines.forEach(mine => {
                            if (!state.board[mine.row][mine.col].flagged) {
                                const cellElement = getCellElement(mine.row, mine.col);
                                if (cellElement) {
                                    cellElement.classList.add('flagged');
                                    cellElement.textContent = '🚩';
                                }
                            }
                        });
                    } else {
                        // Reveal all mines
                        revealAllMines();
                    }
                
                    // Show game result
                    showGameResult(data.won, data.playerId);
                }
                break;
            
            case 'reset':
                // Apply new difficulty if provided
                if (data.difficulty && data.difficulty !== state.difficulty) {
                    applyDifficulty(data.difficulty);
                }
            
                // Reset game
                resetGame();
                break;
            
            case 'difficulty_changed':
                // Apply new difficulty
                if (data.difficulty) {
                    applyDifficulty(data.difficulty);
                    resetGame();
                }
                break;
        }
    }
    
    /**
     * Handle connection state changes
     * @param {Object} connectionState Updated connection state
     */
    function onConnectionStateChanged(connectionState) {
        console.log(`[Minesweeper] Connection state changed: ${connectionState.status}`);
        
        // If we just connected and we're the host, send game state to peers
        if (connectionState.status === 'connected' && connectionState.isHost && state.gameStarted) {
            // Send current game state after a short delay to ensure peer is ready
            setTimeout(() => {
                sendGameState();
            }, 1000);
        }
    }
    
    /**
     * Send full game state to peers (for late joiners)
     */
    function sendGameState() {
        if (!state.context || !state.context.connection || !state.context.connection.state.isHost) {
            return;
        }
        
        // Send game configuration
        sendGameAction('game_state', {
            difficulty: state.difficulty,
            rows: state.rows,
            cols: state.cols,
            mineCount: state.mineCount,
            remainingMines: state.remainingMines,
            timer: state.timer,
            gameStarted: state.gameStarted,
            gameOver: state.gameOver,
            gameWon: state.gameWon,
            mines: state.mines,
            flagged: state.flagged,
            revealedCells: getRevealedCells()
        });
    }
    
    /**
     * Get list of revealed cells for state sync
     * @returns {Array<Object>} Array of revealed cell positions
     */
    function getRevealedCells() {
        const revealed = [];
        
        for (let row = 0; row < state.rows; row++) {
            for (let col = 0; col < state.cols; col++) {
                if (state.board[row][col].revealed) {
                    revealed.push({ row, col });
                }
            }
        }
        
        return revealed;
    }
    
    /**
     * Get current game state
     * @returns {Object} Game state object
     */
    function getState() {
        return {
            difficulty: state.difficulty,
            rows: state.rows,
            cols: state.cols,
            mineCount: state.mineCount,
            remainingMines: state.remainingMines,
            timer: state.timer,
            gameStarted: state.gameStarted,
            gameOver: state.gameOver,
            gameWon: state.gameWon,
            mines: state.mines,
            flagged: state.flagged,
            revealedCells: getRevealedCells(),
            playerActions: state.playerActions
        };
    }
    
    /**
     * Set game state from received data
     * @param {Object} gameState Game state data
     */
    function setState(gameState) {
        if (!gameState) return;
        
        // Apply game state
        if (gameState.difficulty) {
            applyDifficulty(gameState.difficulty);
        }
        
        state.mineCount = gameState.mineCount || state.mineCount;
        state.remainingMines = gameState.remainingMines || state.remainingMines;
        state.timer = gameState.timer || 0;
        state.gameStarted = gameState.gameStarted || false;
        state.gameOver = gameState.gameOver || false;
        state.gameWon = gameState.gameWon || false;
        state.mines = gameState.mines || [];
        state.flagged = gameState.flagged || [];
        state.playerActions = gameState.playerActions || {};
        
        // Reset board
        resetGame();
        
        // Process mines
        state.mines.forEach(mine => {
            if (mine.row < state.rows && mine.col < state.cols) {
                state.board[mine.row][mine.col].hasMine = true;
            }
        });
        
        // Calculate neighbor counts
        for (let row = 0; row < state.rows; row++) {
            for (let col = 0; col < state.cols; col++) {
                if (!state.board[row][col].hasMine) {
                    state.board[row][col].neighborMines = countNeighborMines(row, col);
                }
            }
        }
        
        // Apply flagged cells
        state.flagged.forEach(pos => {
            const { row, col } = pos;
            if (row < state.rows && col < state.cols) {
                state.board[row][col].flagged = true;
                const cellElement = getCellElement(row, col);
                if (cellElement) {
                    cellElement.classList.add('flagged');
                    cellElement.textContent = '🚩';
                }
            }
        });
        
        // Apply revealed cells
        if (gameState.revealedCells && Array.isArray(gameState.revealedCells)) {
            gameState.revealedCells.forEach(pos => {
                const { row, col } = pos;
                if (row < state.rows && col < state.cols) {
                    state.board[row][col].revealed = true;
                    state.revealed++;
                    
                    const cellElement = getCellElement(row, col);
                    if (cellElement) {
                        cellElement.classList.add('revealed');
                        
                        if (state.board[row][col].hasMine) {
                            cellElement.classList.add('mine');
                            cellElement.textContent = '💣';
                        } else if (state.board[row][col].neighborMines > 0) {
                            cellElement.textContent = state.board[row][col].neighborMines;
                            cellElement.classList.add(`neighbors-${state.board[row][col].neighborMines}`);
                        }
                    }
                }
            });
        }
        
        // Update displays
        updateMineCounter();
        updateTimerDisplay();
        
        // Update reset button
        if (elements.resetButton) {
            if (state.gameOver) {
                elements.resetButton.textContent = state.gameWon ? '😎' : '😵';
            } else {
                elements.resetButton.textContent = '😊';
            }
        }
        
        // Start timer if game is in progress
        if (state.gameStarted && !state.gameOver) {
            startTimer();
        }
    }
    
    /**
     * Clean up game resources
     */
    function cleanup() {
        console.log('[Minesweeper] Cleaning up resources');
        
        // Stop timer if running
        stopTimer();
        
        // Clear event listeners by removing elements
        if (elements.board) {
            elements.board.innerHTML = '';
        }
        
        // Clear state
        state = {
            board: [],
            mines: [],
            revealed: 0,
            flagged: [],
            gameStarted: false,
            gameOver: false,
            gameWon: false,
            difficulty: 'intermediate',
            rows: 16,
            cols: 16,
            mineCount: 40,
            remainingMines: 40,
            timer: 0,
            timerInterval: null,
            playerActions: {},
            container: null,
            context: null
        };
        
        // Clear element references
        elements = {
            board: null,
            statusBar: null,
            mineCounter: null,
            timer: null,
            resetButton: null,
            difficultySelect: null
        };
    }
    
    // Return public API
    return {
        // Metadata
        ...metadata,
        
        // Required methods
        init,
        reset: resetGame,
        handleMessage,
        
        // Optional methods
        onConnectionStateChanged,
        getState,
        setState,
        cleanup,
        
        // Optional game-specific controls HTML
        controls: `
            <div class="minesweeper-controls">
                <select id="minesweeper-difficulty-select">
                    <option value="beginner">Beginner</option>
                    <option value="intermediate" selected>Intermediate</option>
                    <option value="expert">Expert</option>
                </select>
                <button id="minesweeper-reset" class="button secondary-button">
                    <i class="fas fa-redo"></i> Reset Game
                </button>
            </div>
        `,
        
        // Optional method to set up external controls
        setupControls: (controlsContainer) => {
            if (!controlsContainer) return;
            
            const difficultySelect = controlsContainer.querySelector('#minesweeper-difficulty-select');
            const resetButton = controlsContainer.querySelector('#minesweeper-reset');
            
            if (difficultySelect) {
                difficultySelect.value = state.difficulty;
                difficultySelect.addEventListener('change', () => {
                    // Only host can change difficulty
                    if (state.context && state.context.connection && !state.context.connection.state.isHost) {
                        // Reset selection
                        difficultySelect.value = state.difficulty;
                        showHostOnlyMessage();
                        return;
                    }
                    
                    const newDifficulty = difficultySelect.value;
                    applyDifficulty(newDifficulty);
                    resetGame();
                    
                    // Notify peers
                    sendGameAction('difficulty_changed', {
                        difficulty: newDifficulty
                    });
                });
            }
            
            if (resetButton) {
                resetButton.addEventListener('click', () => {
                    // Only host can reset game
                    if (state.context && state.context.connection && !state.context.connection.state.isHost) {
                        showHostOnlyMessage();
                        return;
                    }
                    
                    resetGame();
                    
                    // Notify peers
                    sendGameAction('reset', {
                        difficulty: state.difficulty
                    });
                });
            }
        }
    };
})();

// Register with GameRegistry if available
if (window.GameRegistry) {
    GameRegistry.registerGame(MinesweeperGame.id, MinesweeperGame);
    console.log('[Minesweeper] Registered with GameRegistry');
} else {
    console.warn('[Minesweeper] GameRegistry not available, game not registered');
    
    // Make globally available for direct access
    window.MinesweeperGame = MinesweeperGame;
}