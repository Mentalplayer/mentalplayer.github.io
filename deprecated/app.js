/**
 * Mentalplayer - Main Application
 * Modernized version with cleaner state management and simpler connection handling
 */

// Global app state
const AppState = {
    playerName: '',
    playerId: '',
    currentGame: null,
    roomId: '',
    isRoomCreator: false,
    players: {},
    gameModules: {}
};

// DOM Elements
const elements = {
    // Modals
    entryModal: document.getElementById('entry-modal'),
    playerNameInput: document.getElementById('player-name-input'),
    continueButton: document.getElementById('continue-button'),
    inviteModal: document.getElementById('invite-modal'),
    inviteLink: document.getElementById('invite-link'),
    copyLinkButton: document.getElementById('copy-link'),
    closeInviteModalButton: document.getElementById('close-invite-modal'),
    
    // Navigation & Game Selection
    gameSelect: document.getElementById('game-select'),
    gameContainer: document.getElementById('game-container'),
    sidePanel: document.getElementById('side-panel'),
    backToGamesButton: document.getElementById('back-to-games'),
    currentGameTitle: document.getElementById('current-game-title'),
    
    // Room & Connection
    connectionStatus: document.getElementById('connection-status'),
    playerDisplay: document.getElementById('player-display'),
    roomIdInput: document.getElementById('room-id'),
    createRoomButton: document.getElementById('create-room'),
    joinRoomButton: document.getElementById('join-room'),
    invitePlayersButton: document.getElementById('invite-players'),
    roomInfo: document.getElementById('room-info'),
    currentRoomIdSpan: document.getElementById('current-room-id'),
    playersContainer: document.getElementById('players-container'),
    
    // Chat
    chatInput: document.getElementById('chat-input'),
    chatMessages: document.getElementById('chat-messages'),
    sendMessageButton: document.getElementById('send-message')
};

/**
 * Initialize the application
 */
function initApp() {
    console.log('[App] Initializing application...');
    
    // Setup event listeners
    setupEventListeners();
    
    // Check URL for room invitations
    checkUrlForRoom();
    
    // Register game modules
    registerGameModules();
    
    // Check for saved player name
    checkSavedPlayerName();
    
    console.log('[App] Initialization complete');
}

/**
 * Sync app and connection manager states
 */
function syncStates() {
    if (typeof ConnectionManager === 'undefined' || typeof AppState === 'undefined') {
        console.warn('[App] ConnectionManager or AppState not available for state sync');
        return;
    }
    
    // Update AppState from ConnectionManager
    AppState.playerId = ConnectionManager.state.playerId;
    AppState.roomId = ConnectionManager.state.roomId;
    AppState.isRoomCreator = ConnectionManager.state.isRoomCreator;
    AppState.players = {...ConnectionManager.state.players};
    
    // Update ConnectionManager from AppState
    ConnectionManager.state.playerName = AppState.playerName;
    
    // Update game module reference
    if (AppState.currentGame && AppState.gameModules[AppState.currentGame]) {
        ConnectionManager.state.gameModule = AppState.gameModules[AppState.currentGame];
    }
    
    console.log('[App] States synchronized');
}

/**
 * Select a game to play
 * @param {string} gameType Game type to select
 * @param {boolean} broadcast Whether to broadcast the game type to peers
 */
function selectGame(gameType, broadcast = true) {
    console.log(`[App] Selecting game: ${gameType}, broadcast: ${broadcast}`);
    
    if (!AppState.gameModules[gameType]) {
        console.error(`[App] Game module ${gameType} not found`);
        alert(`Game "${gameType}" is not available. Please choose another game.`);
        return;
    }
    
    // Hide game selection, show game container
    elements.gameSelect.style.display = 'none';
    elements.gameContainer.style.display = 'block';
    elements.sidePanel.style.display = 'flex';
    
    // Set game title
    AppState.currentGame = gameType;
    elements.currentGameTitle.textContent = gameType.charAt(0).toUpperCase() + gameType.slice(1);
    
    // Initialize the selected game
    AppState.gameModules[gameType].init();
    
    // Sync with ConnectionManager
    if (typeof ConnectionManager !== 'undefined') {
        ConnectionManager.state.gameModule = AppState.gameModules[gameType];
        
        // If connected and room creator, broadcast game type to all peers
        if (broadcast && AppState.roomId && AppState.isRoomCreator) {
            ConnectionManager.sendData({
                type: 'game_type',
                gameType: gameType
            });
        }
    }
    
    console.log(`[App] Game "${gameType}" selected and initialized`);
}

/**
 * Return to game selection screen
 */
function returnToGameSelection() {
    console.log('[App] Returning to game selection');
    
    // If in a room, ask for confirmation
    if (AppState.roomId) {
        if (!confirm('Leaving the game will disconnect you from the current room. Continue?')) {
            return;
        }
        
        // Leave room using ConnectionManager
        if (typeof ConnectionManager !== 'undefined') {
            ConnectionManager.leaveRoom();
        }
    }
    
    // Show game selection, hide game container
    elements.gameSelect.style.display = 'block';
    elements.gameContainer.style.display = 'none';
    elements.sidePanel.style.display = 'none';
    
    AppState.currentGame = null;
    
    // Sync state
    syncStates();
    
    console.log('[App] Returned to game selection');
}

/**
 * Create a new game room
 */
function createRoom() {
    console.log('[App] Creating room');
    
    if (!AppState.currentGame) {
        alert('Please select a game first.');
        return;
    }
    
    // Use ConnectionManager to create room
    if (typeof ConnectionManager !== 'undefined') {
        ConnectionManager.createRoom();
        
        // Sync state after a short delay to ensure ConnectionManager has had time to process
        setTimeout(() => {
            syncStates();
        }, 500);
    } else {
        console.error('[App] ConnectionManager not initialized');
        alert('Connection manager not initialized. Please refresh the page and try again.');
    }
}

/**
 * Join an existing room
 */
function joinRoom() {
    console.log('[App] Joining room');
    
    const roomId = elements.roomIdInput.value.trim();
    if (!roomId) {
        alert('Please enter a Room ID to join.');
        return;
    }
    
    // Use ConnectionManager to join room
    if (typeof ConnectionManager !== 'undefined') {
        ConnectionManager.joinRoom(roomId);
        
        // Sync state after a short delay to ensure ConnectionManager has had time to process
        setTimeout(() => {
            syncStates();
        }, 500);
    } else {
        console.error('[App] ConnectionManager not initialized');
        alert('Connection manager not initialized. Please refresh the page and try again.');
    }
}

/**
 * Show invite modal with link
 */
function showInviteModal() {
    console.log('[App] Showing invite modal');
    
    if (!AppState.roomId) {
        alert('Please create a room first.');
        return;
    }
    
    const url = new URL(window.location.href);
    url.searchParams.set('room', AppState.roomId);
    elements.inviteLink.value = url.toString();
    
    elements.inviteModal.style.display = 'flex';
}

/**
 * Share via different platforms
 */
function shareViaWhatsApp() {
    const url = elements.inviteLink.value;
    const text = `Join me for a game on Mentalplayer! ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function shareViaEmail() {
    const url = elements.inviteLink.value;
    const subject = "Join me on Mentalplayer";
    const body = `I'm playing a game on Mentalplayer and would like you to join! Click this link to join my room: ${url}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
}

function shareViaFacebook() {
    const url = elements.inviteLink.value;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'width=600,height=400');
}

function shareViaTwitter() {
    const url = elements.inviteLink.value;
    const text = "Join me for a game on Mentalplayer!";
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'width=600,height=400');
}

/**
 * Copy invite link to clipboard
 */
function copyInviteLink() {
    elements.inviteLink.select();
    document.execCommand('copy');
    
    // Change button text temporarily
    const originalText = elements.copyLinkButton.textContent;
    elements.copyLinkButton.textContent = 'Copied!';
    setTimeout(() => {
        elements.copyLinkButton.innerHTML = originalText;
    }, 2000);
}

/**
 * Send a chat message
 */
function sendChatMessage() {
    if (!elements.chatInput.value.trim()) return;
    
    if (typeof ConnectionManager !== 'undefined' && ConnectionManager.state.connected) {
        ConnectionManager.sendData({
            type: 'chat_message',
            message: elements.chatInput.value.trim()
        });
        
        // Also add to local chat display
        ConnectionManager.addChatMessage(AppState.playerId, elements.chatInput.value.trim());
        
        // Clear input
        elements.chatInput.value = '';
    } else {
        alert('You need to be in a room to send messages.');
    }
}

/**
 * Handle messages from peers
 */
function handlePeerMessage(peerId, data) {
    if (!data || !data.type) return;
    
    console.log('[App] Received peer message:', data);
    
    switch (data.type) {
        case 'game_type':
            // Switch to the game type received
            if (data.gameType && data.gameType !== AppState.currentGame) {
                selectGame(data.gameType, false);
            }
            break;
            
        default:
            // Game-specific messages are handled by the respective game module
            if (AppState.currentGame && AppState.gameModules[AppState.currentGame]) {
                AppState.gameModules[AppState.currentGame].handlePeerMessage(peerId, data);
            }
            break;
    }
}

/**
 * Show privacy policy modal
 */
function showPrivacyPolicy() {
    console.log('[App] Showing privacy policy');
    
    const modalHtml = `
        <div id="policy-modal" class="modal" style="display: flex;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Privacy Policy</h2>
                </div>
                <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
                    <h3>Information Collection</h3>
                    <p>Mentalplayer uses cookies to store your chosen display name for convenience. No other personal information is collected or stored on our servers.</p>
                    
                    <h3>Peer-to-Peer Connections</h3>
                    <p>This application uses direct peer-to-peer connections through WebRTC technology. Your connection ID is temporarily generated when you use the application but is not permanently stored.</p>
                    
                    <h3>Chat Messages</h3>
                    <p>Chat messages are sent directly between peers and are not stored or monitored. Please be respectful in your communications with other players.</p>
                    
                    <h3>Analytics</h3>
                    <p>Basic anonymous usage statistics may be collected to improve the application's performance and features.</p>
                    
                    <h3>Updates to This Policy</h3>
                    <p>This policy may be updated from time to time. Please check back periodically for changes.</p>
                </div>
                <div class="modal-buttons">
                    <button id="close-policy-button" class="modal-button primary-button">Close</button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to body
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHtml;
    document.body.appendChild(tempDiv.firstElementChild);
    
    // Set up close button
    document.getElementById('close-policy-button').addEventListener('click', () => {
        document.getElementById('policy-modal').remove();
    });
}

/**
 * Show about modal
 */
function showAbout() {
    console.log('[App] Showing about information');
    
    const modalHtml = `
        <div id="about-modal" class="modal" style="display: flex;">
            <div class="modal-content">
                <div class="modal-header">
                    <i class="fas fa-brain modal-logo"></i>
                    <h2>About Mentalplayer</h2>
                </div>
                <div class="modal-body">
                    <p>Mentalplayer is a multiplayer gaming platform that lets you play classic games with friends using peer-to-peer technology.</p>
                    
                    <p>Currently featuring Minesweeper with more games coming soon!</p>
                    
                    <h3>How It Works</h3>
                    <p>Mentalplayer uses WebRTC technology for direct peer-to-peer connections, allowing you to play with friends without a central server handling the gameplay.</p>
                    
                    <h3>Version</h3>
                    <p>2.0.0 (March 2025)</p>
                </div>
                <div class="modal-buttons">
                    <button id="close-about-button" class="modal-button primary-button">Close</button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to body
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHtml;
    document.body.appendChild(tempDiv.firstElementChild);
    
    // Set up close button
    document.getElementById('close-about-button').addEventListener('click', () => {
        document.getElementById('about-modal').remove();
    });
}

/**
 * Check URL for room ID (for invited players)
 */
function checkUrlForRoom() {
    console.log('[App] Checking URL for room parameter');
    
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    
    if (roomParam) {
        console.log(`[App] Found room parameter in URL: ${roomParam}`);
        elements.roomIdInput.value = roomParam;
    }
}

/**
 * Check for saved player name in cookies
 */
function checkSavedPlayerName() {
    console.log('[App] Checking for saved player name');
    
    const savedName = getCookie('playerName');
    if (savedName) {
        console.log(`[App] Found saved player name: ${savedName}`);
        elements.playerNameInput.value = savedName;
    }
}

/**
 * Save player name to cookie
 */
function savePlayerName(name) {
    console.log(`[App] Saving player name: ${name}`);
    setCookie('playerName', name, 30); // Save for 30 days
}

/**
 * Update player display in header
 */
function updatePlayerDisplay() {
    console.log('[App] Updating player display');
    
    elements.playerDisplay.innerHTML = `
        <span>${AppState.playerName}</span>
        <button id="change-name-button" class="small-button" title="Change Name">
            <i class="fas fa-edit"></i>
        </button>
    `;
    
    // Add event listener to change name button
    const changeNameButton = document.getElementById('change-name-button');
    if (changeNameButton) {
        changeNameButton.addEventListener('click', showChangeNameDialog);
    }
}

/**
 * Show dialog to change player name
 */
function showChangeNameDialog() {
    console.log('[App] Showing change name dialog');
    
    // Only allow name change if not in a room
    if (AppState.roomId) {
        alert('You cannot change your name while in a room.');
        return;
    }
    
    const newName = prompt('Enter your new name:', AppState.playerName);
    if (newName && newName.trim()) {
        const trimmedName = newName.trim();
        savePlayerName(trimmedName);
        AppState.playerName = trimmedName;
        updatePlayerDisplay();
        
        // Update ConnectionManager if available
        if (typeof ConnectionManager !== 'undefined') {
            ConnectionManager.state.playerName = trimmedName;
        }
        
        console.log(`[App] Player name changed to: ${trimmedName}`);
    }
}

/**
 * Set cookie with name, value and expiration days
 */
function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

/**
 * Get cookie value by name
 */
function getCookie(name) {
    const cookieName = name + "=";
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i].trim();
        if (cookie.indexOf(cookieName) === 0) {
            return cookie.substring(cookieName.length, cookie.length);
        }
    }
    return "";
}

/**
 * Register available game modules
 */
function registerGameModules() {
    console.log('[App] Registering game modules');
    
    // Register Minesweeper
    if (typeof MinesweeperGame !== 'undefined') {
        AppState.gameModules['minesweeper'] = MinesweeperGame;
        console.log('[App] Registered Minesweeper game module');
    } else {
        console.warn('[App] MinesweeperGame module not found');
    }
    
    // Additional games can be registered here in the future
}

/**
 * Set up event listeners for the application
 */
function setupEventListeners() {
    console.log('[App] Setting up event listeners');
    
    // Player name entry
    elements.continueButton.addEventListener('click', handlePlayerNameSubmit);
    elements.playerNameInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') elements.continueButton.click();
    });
    
    // Game selection
    document.querySelectorAll('.game-card:not(.coming-soon)').forEach(card => {
        card.addEventListener('click', () => selectGame(card.dataset.game));
    });
    
    elements.backToGamesButton.addEventListener('click', returnToGameSelection);
    
    // Room management
    elements.createRoomButton.addEventListener('click', createRoom);
    elements.joinRoomButton.addEventListener('click', joinRoom);
    elements.roomIdInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') elements.joinRoomButton.click();
    });
    
    // Invite system
    elements.invitePlayersButton.addEventListener('click', showInviteModal);
    elements.copyLinkButton.addEventListener('click', copyInviteLink);
    elements.closeInviteModalButton.addEventListener('click', () => {
        elements.inviteModal.style.display = 'none';
    });
    
    // Chat functionality
    if (elements.chatInput && elements.sendMessageButton) {
        elements.sendMessageButton.addEventListener('click', sendChatMessage);
        elements.chatInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }
    
    // Game over modal
    const closeGameOverButton = document.getElementById('close-game-over-modal');
    if (closeGameOverButton) {
        closeGameOverButton.addEventListener('click', () => {
            document.getElementById('game-over-modal').style.display = 'none';
        });
    }
    
    // Close modals when clicking outside
    window.addEventListener('click', e => {
        if (e.target === elements.inviteModal) {
            elements.inviteModal.style.display = 'none';
        }
        
        const gameOverModal = document.getElementById('game-over-modal');
        if (e.target === gameOverModal) {
            gameOverModal.style.display = 'none';
        }
    });
}

/**
 * Handle player name submission and initialize connections
 */
function handlePlayerNameSubmit() {
    console.log('[App] Handling player name submission');
    
    const name = elements.playerNameInput.value.trim();
    if (name) {
        savePlayerName(name);
        AppState.playerName = name;
        elements.entryModal.style.display = 'none';
        updatePlayerDisplay();
        
        // Initialize ConnectionManager if available
        if (typeof ConnectionManager !== 'undefined') {
            console.log('[App] Initializing ConnectionManager with name:', name);
            
            ConnectionManager.state.playerName = name;
            ConnectionManager.init({
                playerName: name
            });
            
            // Sync IDs immediately
            AppState.playerId = ConnectionManager.state.playerId;
            
            // Set up sync for roomId and isRoomCreator
            syncStates();
            
            // Show notification
            ConnectionManager.showNotification('Welcome', 'Select a game to start playing.', 'success');
            
            // Auto-join room if in URL
            const urlParams = new URLSearchParams(window.location.search);
            const roomParam = urlParams.get('room');
            if (roomParam) {
                setTimeout(() => {
                    console.log('[App] Auto-joining room from URL:', roomParam);
                    ConnectionManager.joinRoom(roomParam);
                }, 1000);
            }
        } else {
            console.error('[App] ConnectionManager not available');
            alert('Connection system not available. Please refresh the page and try again.');
        }
    } else {
        alert('Please enter your name to continue.');
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);