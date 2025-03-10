/**
 * Game Modules for Mentalplayer
 * Contains implementations for each game type
 */

const GameModules = {
    // Minesweeper implementation
    minesweeper: {
        type: 'minesweeper',
        
        // Game state
        state: {
            boardState: [],
            mineLocations: [],
            revealedCount: 0,
            gameStarted: false,
            gameOver: false,
            mineCount: 40,
            remainingMines: 40,
            rows: 16,
            cols: 16,
            timerInterval: null,
            timerValue: 0
        },
        
        // DOM elements
        elements: {
            board: document.getElementById('minesweeper-board'),
            mineCountDisplay: document.querySelector('.mine-count'),
            timerDisplay: document.querySelector('.timer'),
            resetButton: document.querySelector('.reset-button'),
            difficultySelect: document.getElementById('difficulty')
        },
        
        /**
         * Initialize the game
         */
        init() {
            console.log('Initializing Minesweeper game...');
            
            // Update elements
            this.updateElements();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Create board
            this.reset();
        },
        
        /**
         * Update element references
         */
        updateElements() {
            this.elements.board = document.getElementById('minesweeper-board') || this.elements.board;
            this.elements.mineCountDisplay = document.querySelector('.mine-count') || this.elements.mineCountDisplay;
            this.elements.timerDisplay = document.querySelector('.timer') || this.elements.timerDisplay;
            this.elements.resetButton = document.querySelector('.reset-button') || this.elements.resetButton;
            this.elements.difficultySelect = document.getElementById('difficulty') || this.elements.difficultySelect;
        },
        
        /**
         * Set up event listeners
         */
        setupEventListeners() {
            // Reset button
            if (this.elements.resetButton) {
                this.elements.resetButton.addEventListener('click', () => {
                    if (ConnectionManager.isRoomCreator) {
                        this.reset();
                        
                        // Broadcast reset to other players
                        ConnectionManager.sendData({
                            type: 'game_data',
                            data: {
                                action: 'reset',
                                difficulty: this.elements.difficultySelect ? this.elements.difficultySelect.value : 'intermediate'
                            }
                        });
                    } else {
                        alert('Only the room creator can reset the game.');
                    }
                });
            }
            
            // Difficulty select
            if (this.elements.difficultySelect) {
                this.elements.difficultySelect.addEventListener('change', () => {
                    if (ConnectionManager.isRoomCreator) {
                        const difficulty = this.elements.difficultySelect.value;
                        
                        switch (difficulty) {
                            case 'beginner':
                                this.state.rows = 9;
                                this.state.cols = 9;
                                this.state.mineCount = 10;
                                break;
                            case 'intermediate':
                                this.state.rows = 16;
                                this.state.cols = 16;
                                this.state.mineCount = 40;
                                break;
                            case 'expert':
                                this.state.rows = 16;
                                this.state.cols = 30;
                                this.state.mineCount = 99;
                                break;
                        }
                        
                        this.reset();
                        
                        // Broadcast difficulty change
                        ConnectionManager.sendData({
                            type: 'game_data',
                            data: {
                                action: 'difficulty_change',
                                difficulty: difficulty
                            }
                        });
                    } else {
                        // Reset to current difficulty
                        const currentDifficulty = 
                            this.state.rows === 9 && this.state.cols === 9 ? 'beginner' :
                            this.state.rows === 16 && this.state.cols === 16 ? 'intermediate' : 'expert';
                        this.elements.difficultySelect.value = currentDifficulty;
                        
                        alert('Only the room creator can change difficulty.');
                    }
                });
            }
        },
        
        /**
         * Reset the game
         */
        reset() {
            // Reset game state
            this.state.gameStarted = false;
            this.state.gameOver = false;
            this.state.revealedCount = 0;
            
            if (this.elements.resetButton) {
                this.elements.resetButton.textContent = '😊';
            }
            
            // Stop timer if running
            if (this.state.timerInterval) {
                clearInterval(this.state.timerInterval);
                this.state.timerInterval = null;
            }
            
            // Reset timer display
            this.state.timerValue = 0;
            this.updateTimerDisplay();
            
            // Reset remaining mines
            this.state.remainingMines = this.state.mineCount;
            this.updateMineCount();
            
            // Create the board
            this.createBoard();
            
            // Initialize mines (will be placed on first click)
            this.state.mineLocations = [];
        },
        
        /**
         * Create the game board
         */
        createBoard() {
            if (!this.elements.board) return;
            
            // Clear the board
            this.elements.board.innerHTML = '';
            
            // Set CSS variables for board size
            document.documentElement.style.setProperty('--rows', this.state.rows);
            document.documentElement.style.setProperty('--cols', this.state.cols);
            
            // Initialize board state
            this.state.boardState = Array(this.state.rows).fill().map(() => 
                Array(this.state.cols).fill().map(() => ({
                    isMine: false,
                    isRevealed: false,
                    isFlagged: false,
                    adjacentMines: 0
                }))
            );
            
            // Create cells
            for (let r = 0; r < this.state.rows; r++) {
                for (let c = 0; c < this.state.cols; c++) {
                    const cell = document.createElement('div');
                    cell.classList.add('cell');
                    cell.dataset.row = r;
                    cell.dataset.col = c;
                    
                    // Add event listeners
                    cell.addEventListener('click', (e) => this.handleCellClick(e));
                    cell.addEventListener('contextmenu', (e) => this.handleRightClick(e));
                    
                    this.elements.board.appendChild(cell);
                }
            }
        },
        
        /**
         * Place mines randomly, avoiding the first clicked cell and its neighbors
         */
        placeMines(firstRow, firstCol) {
            // Mark positions to avoid (first click and neighbors)
            const avoid = [];
            for (let r = Math.max(0, firstRow - 1); r <= Math.min(this.state.rows - 1, firstRow + 1); r++) {
                for (let c = Math.max(0, firstCol - 1); c <= Math.min(this.state.cols - 1, firstCol + 1); c++) {
                    avoid.push(`${r},${c}`);
                }
            }
            
            // Place mines
            let minesPlaced = 0;
            while (minesPlaced < this.state.mineCount) {
                const row = Math.floor(Math.random() * this.state.rows);
                const col = Math.floor(Math.random() * this.state.cols);
                const key = `${row},${col}`;
                
                if (!avoid.includes(key) && !this.state.mineLocations.some(m => m.row === row && m.col === col)) {
                    this.state.mineLocations.push({ row, col });
                    this.state.boardState[row][col].isMine = true;
                    minesPlaced++;
                }
            }
            
            // Calculate adjacent mines for each cell
            for (let r = 0; r < this.state.rows; r++) {
                for (let c = 0; c < this.state.cols; c++) {
                    if (!this.state.boardState[r][c].isMine) {
                        this.state.boardState[r][c].adjacentMines = this.countAdjacentMines(r, c);
                    }
                }
            }
            
            // Send mine locations to other players if room creator
            if (ConnectionManager.isRoomCreator) {
                ConnectionManager.sendData({
                    type: 'game_data',
                    data: {
                        action: 'mines_placed',
                        mineLocations: this.state.mineLocations,
                        firstCell: { row: firstRow, col: firstCol }
                    }
                });
            }
        },
        
        /**
         * Count adjacent mines for a cell
         */
        countAdjacentMines(row, col) {
            let count = 0;
            for (let r = Math.max(0, row - 1); r <= Math.min(this.state.rows - 1, row + 1); r++) {
                for (let c = Math.max(0, col - 1); c <= Math.min(this.state.cols - 1, col + 1); c++) {
                    if (r === row && c === col) continue;
                    if (this.state.boardState[r][c].isMine) count++;
                }
            }
            return count;
        },
        
        /**
         * Handle cell click
         */
        handleCellClick(event) {
            if (this.state.gameOver) return;
            
            const cell = event.target;
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            
            // Start game on first click
            if (!this.state.gameStarted) {
                // Only start game once (by room creator)
                if (ConnectionManager.isRoomCreator) {
                    this.startGame(row, col);
                }
                
                // Send the click to other players
                ConnectionManager.sendData({
                    type: 'game_data',
                    data: {
                        action: 'cell_click',
                        row: row,
                        col: col,
                        isRightClick: false
                    }
                });
                
                // Don't process right-clicks if game hasn't started yet
                return;
            }
            
            // Reveal cell
            if (!this.state.boardState[row][col].isFlagged) {
                this.revealCell(cell, row, col, true);
                
                // Send the click to other players
                ConnectionManager.sendData({
                    type: 'game_data',
                    data: {
                        action: 'cell_click',
                        row: row,
                        col: col,
                        isRightClick: false
                    }
                });
            }
        },
        
        /**
         * Handle right click (flag placement)
         */
        handleRightClick(event) {
            event.preventDefault();
            if (this.state.gameOver) return;
            
            const cell = event.target;
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            
            // Don't allow flagging if game hasn't started
            if (!this.state.gameStarted) return;
            
            // Toggle flag
            if (!this.state.boardState[row][col].isRevealed) {
                this.toggleFlag(cell, row, col);
                
                // Send the right click to other players
                ConnectionManager.sendData({
                    type: 'game_data',
                    data: {
                        action: 'cell_click',
                        row: row,
                        col: col,
                        isRightClick: true
                    }
                });
            }
        },
        
        /**
         * Process cell click (both local and remote)
         */
        processCellClick(row, col, isRightClick) {
            if (this.state.gameOver) return;
            
            const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
            if (!cell) return;
            
            // Start game on first click
            if (!this.state.gameStarted) {
                // Only start game once (by room creator)
                if (ConnectionManager.isRoomCreator) {
                    this.startGame(row, col);
                }
                
                // Don't process right-clicks if game hasn't started
                if (isRightClick) return;
            }
            
            if (isRightClick) {
                // Toggle flag
                if (!this.state.boardState[row][col].isRevealed) {
                    this.toggleFlag(cell, row, col);
                }
            } else {
                // Reveal cell
                if (!this.state.boardState[row][col].isFlagged) {
                    this.revealCell(cell, row, col, true);
                }
            }
        },
        
        /**
         * Toggle flag on/off for a cell
         */
        toggleFlag(cell, row, col) {
            if (this.state.boardState[row][col].isFlagged) {
                // Remove flag
                cell.classList.remove('flagged');
                this.state.boardState[row][col].isFlagged = false;
                this.state.remainingMines++;
            } else {
                // Add flag
                cell.classList.add('flagged');
                this.state.boardState[row][col].isFlagged = true;
                this.state.remainingMines--;
            }
            
            // Update mine count display
            this.updateMineCount();
        },
        
        /**
         * Reveal a cell
         */
        revealCell(cell, row, col, checkWin) {
            if (this.state.boardState[row][col].isRevealed) return;
            
            // Mark as revealed
            this.state.boardState[row][col].isRevealed = true;
            cell.classList.add('revealed');
            
            // Remove any flag
            if (this.state.boardState[row][col].isFlagged) {
                cell.classList.remove('flagged');
                this.state.boardState[row][col].isFlagged = false;
                this.state.remainingMines++;
                this.updateMineCount();
            }
            
            // Check if mine
            if (this.state.boardState[row][col].isMine) {
                cell.classList.add('mine');
                cell.textContent = '💣';
                this.state.gameOver = true;
                this.endGame(false);
                return;
            }
            
            // Count of non-mine cells revealed
            this.state.revealedCount++;
            
            // Check adjacent mines
            const adjacentMines = this.state.boardState[row][col].adjacentMines;
            if (adjacentMines > 0) {
                cell.textContent = adjacentMines;
                cell.classList.add(`number-${adjacentMines}`);
            } else {
                // Auto-reveal neighbors for cells with no adjacent mines
                for (let r = Math.max(0, row - 1); r <= Math.min(this.state.rows - 1, row + 1); r++) {
                    for (let c = Math.max(0, col - 1); c <= Math.min(this.state.cols - 1, col + 1); c++) {
                        if (r === row && c === col) continue;
                        if (!this.state.boardState[r][c].isRevealed && !this.state.boardState[r][c].isFlagged) {
                            const neighborCell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
                            if (neighborCell) {
                                this.revealCell(neighborCell, r, c, false);
                            }
                        }
                    }
                }
            }
            
            // Check win condition
            if (checkWin && this.state.revealedCount === (this.state.rows * this.state.cols - this.state.mineCount)) {
                this.state.gameOver = true;
                this.endGame(true);
            }
        },
        
        /**
         * Start game on first click
         */
        startGame(firstRow, firstCol) {
            this.state.gameStarted = true;
            
            // Place mines (avoiding first click)
            this.placeMines(firstRow, firstCol);
            
            // Start timer
            this.startTimer();
            
            // Notify other players that game has started
            ConnectionManager.sendData({
                type: 'game_data',
                data: {
                    action: 'game_started'
                }
            });
        },
        
        /**
         * Start timer
         */
        startTimer() {
            this.state.timerInterval = setInterval(() => {
                this.state.timerValue++;
                this.updateTimerDisplay();
                
                // Sync timer with other players every 5 seconds
                if (this.state.timerValue % 5 === 0 && ConnectionManager.isRoomCreator) {
                    ConnectionManager.sendData({
                        type: 'game_data',
                        data: {
                            action: 'timer_sync',
                            timerValue: this.state.timerValue
                        }
                    });
                }
            }, 1000);
        },
        
        /**
         * Update timer display
         */
        updateTimerDisplay() {
            if (this.elements.timerDisplay) {
                this.elements.timerDisplay.textContent = this.state.timerValue.toString().padStart(3, '0');
            }
        },
        
        /**
         * Update mine count display
         */
        updateMineCount() {
            if (this.elements.mineCountDisplay) {
                this.elements.mineCountDisplay.textContent = this.state.remainingMines.toString().padStart(3, '0');
            }
        },
        
        /**
         * End game (win or lose)
         */
        endGame(isWin) {
            // Stop timer
            if (this.state.timerInterval) {
                clearInterval(this.state.timerInterval);
                this.state.timerInterval = null;
            }
            
            // Update reset button face
            if (this.elements.resetButton) {
                this.elements.resetButton.textContent = isWin ? '😎' : '😵';
            }
            
            // Reveal all mines
            if (!isWin) {
                this.revealAllMines();
            }
            
            // Show game over modal
            this.showGameOverModal(isWin);
            
            // Send game over message
            ConnectionManager.sendData({
                type: 'game_data',
                data: {
                    action: 'game_over',
                    isWin: isWin,
                    timerValue: this.state.timerValue
                }
            });
            
            // Add message to chat
            ConnectionManager.addChatMessage('system', isWin ? 
                `Game over! The team cleared all mines in ${this.state.timerValue} seconds! 🎉` :
                `Game over! The team hit a mine. Better luck next time! 💣`
            );
        },
        
        /**
         * Reveal all mines when game is lost
         */
        revealAllMines() {
            this.state.mineLocations.forEach(loc => {
                const cell = document.querySelector(`.cell[data-row="${loc.row}"][data-col="${loc.col}"]`);
                
                if (cell && !this.state.boardState[loc.row][loc.col].isRevealed) {
                    cell.classList.add('revealed');
                    cell.classList.add('mine');
                    cell.textContent = '💣';
                    
                    // Remove flag if present
                    if (this.state.boardState[loc.row][loc.col].isFlagged) {
                        cell.classList.remove('flagged');
                    }
                }
            });
            
            // Mark incorrectly flagged cells
            for (let r = 0; r < this.state.rows; r++) {
                for (let c = 0; c < this.state.cols; c++) {
                    if (this.state.boardState[r][c].isFlagged && !this.state.boardState[r][c].isMine) {
                        const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
                        if (cell) {
                            cell.classList.add('revealed');
                            cell.textContent = '❌';
                        }
                    }
                }
            }
        },
        
        /**
         * Show game over modal
         */
        showGameOverModal(isWin) {
            const modal = document.getElementById('game-over-modal');
            const resultTitle = document.getElementById('game-result');
            const message = document.getElementById('game-message');
            
            if (modal && resultTitle && message) {
                resultTitle.textContent = isWin ? 'You Win!' : 'Game Over';
                message.textContent = isWin ? 
                    `Congratulations! The team cleared all mines in ${this.state.timerValue} seconds.` : 
                    'The team hit a mine! Better luck next time.';
                
                modal.style.display = 'flex';
            }
        },
        
        /**
         * Handle game data from other players
         */
        handleGameData(data) {
            if (!data || !data.action) return;
            
            switch (data.action) {
                case 'cell_click':
                    this.processCellClick(data.row, data.col, data.isRightClick);
                    break;
                    
                case 'game_started':
                    this.state.gameStarted = true;
                    // Start timer for non-creators
                    if (!ConnectionManager.isRoomCreator && !this.state.timerInterval) {
                        this.startTimer();
                    }
                    break;
                    
                case 'mines_placed':
                    if (!ConnectionManager.isRoomCreator) {
                        // Set mine locations
                        this.state.mineLocations = data.mineLocations;
                        
                        // Update board state with mines
                        data.mineLocations.forEach(mine => {
                            if (mine.row < this.state.rows && mine.col < this.state.cols) {
                                this.state.boardState[mine.row][mine.col].isMine = true;
                            }
                        });
                        
                        // Calculate adjacent mines
                        for (let r = 0; r < this.state.rows; r++) {
                            for (let c = 0; c < this.state.cols; c++) {
                                if (!this.state.boardState[r][c].isMine) {
                                    this.state.boardState[r][c].adjacentMines = this.countAdjacentMines(r, c);
                                }
                            }
                        }
                    }
                    break;
                    
                case 'timer_sync':
                    // Update timer if not room creator
                    if (!ConnectionManager.isRoomCreator) {
                        this.state.timerValue = data.timerValue;
                        this.updateTimerDisplay();
                    }
                    break;
                    
                case 'game_over':
                    this.state.gameOver = true;
                    
                    // Stop timer
                    if (this.state.timerInterval) {
                        clearInterval(this.state.timerInterval);
                        this.state.timerInterval = null;
                    }
                    
                    // Update timer value
                    this.state.timerValue = data.timerValue;
                    this.updateTimerDisplay();
                    
                    // Update reset button face
                    if (this.elements.resetButton) {
                        this.elements.resetButton.textContent = data.isWin ? '😎' : '😵';
                    }
                    
                    // Show game over modal
                    this.showGameOverModal(data.isWin);
                    break;
                    
                case 'reset':
                    // Update difficulty if provided
                    if (data.difficulty && this.elements.difficultySelect) {
                        this.elements.difficultySelect.value = data.difficulty;
                        
                        // Update board size based on difficulty
                        switch (data.difficulty) {
                            case 'beginner':
                                this.state.rows = 9;
                                this.state.cols = 9;
                                this.state.mineCount = 10;
                                break;
                            case 'intermediate':
                                this.state.rows = 16;
                                this.state.cols = 16;
                                this.state.mineCount = 40;
                                break;
                            case 'expert':
                                this.state.rows = 16;
                                this.state.cols = 30;
                                this.state.mineCount = 99;
                                break;
                        }
                    }
                    
                    // Reset the game
                    this.reset();
                    break;
                    
                case 'difficulty_change':
                    if (data.difficulty && this.elements.difficultySelect) {
                        this.elements.difficultySelect.value = data.difficulty;
                        
                        // Update board size based on difficulty
                        switch (data.difficulty) {
                            case 'beginner':
                                this.state.rows = 9;
                                this.state.cols = 9;
                                this.state.mineCount = 10;
                                break;
                            case 'intermediate':
                                this.state.rows = 16;
                                this.state.cols = 16;
                                this.state.mineCount = 40;
                                break;
                            case 'expert':
                                this.state.rows = 16;
                                this.state.cols = 30;
                                this.state.mineCount = 99;
                                break;
                        }
                        
                        // Reset game
                        this.reset();
                    }
                    break;
            }
        }
    },
    
    // Additional games can be added here
};

// Register games with connection manager
document.addEventListener('DOMContentLoaded', function() {
    // Make games available globally
    window.GameModules = GameModules;
    
    // Set up game card click handlers
    const gameCards = document.querySelectorAll('.game-card:not(.coming-soon)');
    gameCards.forEach(card => {
        card.addEventListener('click', function() {
            const gameType = card.getAttribute('data-game');
            if (gameType && GameModules[gameType]) {
                // Show game container, hide game selection
                document.getElementById('game-select').style.display = 'none';
                document.getElementById('game-container').style.display = 'block';
                document.getElementById('side-panel').style.display = 'flex';
                
                // Set game title
                document.getElementById('current-game-title').textContent = 
                    gameType.charAt(0).toUpperCase() + gameType.slice(1);
                
                // Initialize the game
                if (window.ConnectionManager) {
                    // Set game module in connection manager
                    ConnectionManager.gameModule = GameModules[gameType];
                }
                
                // Initialize the game
                GameModules[gameType].init();
            }
        });
    });
    
    // Add back to games button functionality
    const backButton = document.getElementById('back-to-games');
    if (backButton) {
        backButton.addEventListener('click', function() {
            document.getElementById('game-select').style.display = 'block';
            document.getElementById('game-container').style.display = 'none';
            document.getElementById('side-panel').style.display = 'none';
            
            // If in a room, ask for confirmation
            if (window.ConnectionManager && ConnectionManager.roomId) {
                if (confirm('Going back will disconnect you from the current room. Continue?')) {
                    ConnectionManager.leaveRoom();
                } else {
                    // Cancel going back
                    document.getElementById('game-select').style.display = 'none';
                    document.getElementById('game-container').style.display = 'block';
                    document.getElementById('side-panel').style.display = 'flex';
                    return;
                }
            }
        });
    }
});