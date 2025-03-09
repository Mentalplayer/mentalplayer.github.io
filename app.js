/**
 * Mentalplayer - Main Application
 * 
 * Handles core functionality like player authentication, game selection,
 * peer-to-peer connections, and managing the game infrastructure.
 */

// Global app state
const AppState = {
    playerName: '',
    playerId: '',
    peer: null,
    currentGame: null,
    roomId: '',
    isRoomCreator: false,
    peers: {},
    players: {},
    myColor: getRandomColor(),
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
    setupEventListeners();
    checkUrlForRoom();
    registerGameModules();
}

/**
 * Send message to all connected peers
 */
function broadcastToPeers(message) {
    Object.values(AppState.peers).forEach(conn => {
        conn.send(message);
    });
}

/**
 * Update connection status display
 */
function updateConnectionStatus(status) {
    elements.connectionStatus.className = 'connection-status ' + status;
    elements.connectionStatus.textContent = status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Get a random color for player identification
 */
function getRandomColor() {
    // Generate vibrant colors that are easily distinguishable
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 60%)`;
}

/**
 * Check URL for room ID (for invited players)
 */
function checkUrlForRoom() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    
    if (roomParam) {
        elements.roomIdInput.value = roomParam;
    }
}

/**
 * Select a game to play
 */
function selectGame(gameType, broadcast = true) {
    if (!AppState.gameModules[gameType]) {
        console.error(`Game module ${gameType} not found`);
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
    
    // If in a room and room creator, broadcast game type to all peers
    if (broadcast && AppState.roomId && AppState.isRoomCreator) {
        broadcastToPeers({
            type: 'game_type',
            gameType: gameType
        });
    }
}

/**
 * Return to game selection screen
 */
function returnToGameSelection() {
    // If in a room, ask for confirmation
    if (AppState.roomId) {
        if (!confirm('Leaving the game will disconnect you from the current room. Continue?')) {
            return;
        }
        
        // Leave room
        AppState.roomId = '';
        AppState.isRoomCreator = false;
        AppState.peers = {};
        AppState.players = {};
        
        elements.roomInfo.style.display = 'none';
        updatePlayersList();
    }
    
    // Show game selection, hide game container
    elements.gameSelect.style.display = 'block';
    elements.gameContainer.style.display = 'none';
    elements.sidePanel.style.display = 'none';
    
    AppState.currentGame = null;
}

/**
 * Create a new game room
 */
function createRoom() {
    if (!AppState.playerId) {
        alert('Waiting for connection to initialize. Please try again in a moment.');
        return;
    }
    
    if (!AppState.currentGame) {
        alert('Please select a game first.');
        return;
    }
    
    // Generate a random room ID
    AppState.roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    AppState.isRoomCreator = true;
    
    // Update UI
    updateRoomInfo();
    
    // Initialize game
    AppState.gameModules[AppState.currentGame].reset();
    
    addChatMessage('system', 'Room created. Invite friends to join!');
}

/**
 * Join an existing room
 */
function joinRoom() {
    if (!AppState.playerId) {
        alert('Waiting for connection to initialize. Please try again in a moment.');
        return;
    }
    
    const inputRoomId = elements.roomIdInput.value.trim().toUpperCase();
    if (!inputRoomId) {
        alert('Please enter a Room ID to join.');
        return;
    }
    
    AppState.roomId = inputRoomId;
    AppState.isRoomCreator = false;
    
    // Update UI
    updateRoomInfo();
    
    // Connect to room creator
    connectToPeer(AppState.roomId);
    
    addChatMessage('system', 'Joining room...');
}

/**
 * Connect to a peer
 */
function connectToPeer(peerId) {
    const conn = AppState.peer.connect(peerId);
    
    updateConnectionStatus('connecting');
    
    conn.on('open', () => {
        console.log('Connected to peer: ' + conn.peer);
        AppState.peers[conn.peer] = conn;
        updateConnectionStatus('connected');
        
        // Send player info
        conn.send({
            type: 'player_info',
            name: AppState.playerName,
            color: AppState.myColor,
            id: AppState.playerId,
            gameType: AppState.currentGame
        });
    });
    
    conn.on('data', data => {
        handlePeerMessage(conn.peer, data);
    });
    
    conn.on('close', () => {
        console.log('Connection closed with: ' + conn.peer);
        delete AppState.peers[conn.peer];
        delete AppState.players[conn.peer];
        updatePlayersList();
        updateConnectionStatus('disconnected');
    });
    
    conn.on('error', err => {
        console.error('Connection error:', err);
        updateConnectionStatus('disconnected');
    });
}

/**
 * Update room info display
 */
function updateRoomInfo() {
    elements.roomInfo.style.display = 'block';
    elements.currentRoomIdSpan.textContent = AppState.roomId;
    
    // Add current player to players list
    AppState.players[AppState.playerId] = {
        name: AppState.playerName,
        color: AppState.myColor,
        id: AppState.playerId,
        gameType: AppState.currentGame
    };
    
    updatePlayersList();
}

/**
 * Update the players list display
 */
function updatePlayersList() {
    elements.playersContainer.innerHTML = '';
    
    Object.entries(AppState.players).forEach(([id, player]) => {
        const playerElement = document.createElement('div');
        playerElement.classList.add('player');
        
        if (id === AppState.playerId) {
            playerElement.classList.add('current-player');
        }
        
        const colorIndicator = document.createElement('div');
        colorIndicator.classList.add('player-color');
        colorIndicator.style.backgroundColor = player.color;
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = player.name + (id === AppState.playerId ? ' (You)' : '');
        
        playerElement.appendChild(colorIndicator);
        playerElement.appendChild(nameSpan);
        
        elements.playersContainer.appendChild(playerElement);
    });
}

/**
 * Show invite modal with link
 */
function showInviteModal() {
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
 * Add a message to the chat
 */
function addChatMessage(senderId, message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message');
    
    let senderName = '';
    let isSystem = false;
    
    if (senderId === 'system') {
        isSystem = true;
        messageElement.classList.add('system-message');
    } else if (senderId === AppState.playerId) {
        senderName = 'You';
        messageElement.classList.add('own-message');
    } else {
        senderName = AppState.players[senderId]?.name || 'Unknown';
        messageElement.classList.add('peer-message');
    }
    
    let messageContent = '';
    if (isSystem) {
        messageContent = `<div class="message-text">${message}</div>`;
    } else {
        const senderColor = senderId === AppState.playerId ? AppState.myColor : AppState.players[senderId]?.color || '#999';
        messageContent = `
            <div class="message-sender" style="color: ${senderColor};">${senderName}:</div>
            <div class="message-text">${message}</div>
        `;
    }
    
    messageElement.innerHTML = messageContent;
    elements.chatMessages.appendChild(messageElement);
    
    // Scroll to bottom
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

/**
 * Send a chat message
 */
function sendChatMessage() {
    const message = elements.chatInput.value.trim();
    if (!message) return;
    
    // Clear input
    elements.chatInput.value = '';
    
    // Add message to local chat
    addChatMessage(AppState.playerId, message);
    
    // Send to peers
    broadcastToPeers({
        type: 'chat_message',
        message: message
    });
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

/**
 * Register available game modules
 */
function registerGameModules() {
    // Register Minesweeper
    if (typeof MinesweeperGame !== 'undefined') {
        AppState.gameModules['minesweeper'] = MinesweeperGame;
    }
    
    // Additional games can be registered here in the future
}

/**
 * Set up event listeners for the application
 */
function setupEventListeners() {
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
    
    // Chat
    elements.sendMessageButton.addEventListener('click', sendChatMessage);
    elements.chatInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') elements.sendMessageButton.click();
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', e => {
        if (e.target === elements.inviteModal) {
            elements.inviteModal.style.display = 'none';
        }
    });
}

/**
 * Handle player name submission and initialize peer connection
 */
function handlePlayerNameSubmit() {
    const name = elements.playerNameInput.value.trim();
    if (name) {
        AppState.playerName = name;
        elements.entryModal.style.display = 'none';
        elements.playerDisplay.textContent = name;
        
        initializePeer();
    } else {
        alert('Please enter your name to continue.');
    }
}

/**
 * Initialize PeerJS connection
 */
function initializePeer() {
    updateConnectionStatus('connecting');
    
    AppState.peer = new Peer(null, {
        debug: 2
    });
    
    AppState.peer.on('open', id => {
        AppState.playerId = id;
        updateConnectionStatus('connected');
        console.log('My peer ID is: ' + id);
        
        // Auto-join room if in URL
        const urlParams = new URLSearchParams(window.location.search);
        const roomParam = urlParams.get('room');
        if (roomParam) {
            elements.roomIdInput.value = roomParam;
            joinRoom();
        }
    });
    
    AppState.peer.on('connection', conn => {
        handleConnection(conn);
    });
    
    AppState.peer.on('error', err => {
        console.error('PeerJS error:', err);
        updateConnectionStatus('disconnected');
    });
    
    AppState.peer.on('disconnected', () => {
        updateConnectionStatus('disconnected');
        console.log('Peer disconnected');
        AppState.peer.reconnect();
    });
}

/**
 * Handle new peer connection
 */
function handleConnection(conn) {
    conn.on('open', () => {
        console.log('Connected to: ' + conn.peer);
        AppState.peers[conn.peer] = conn;
        
        // Exchange player info
        conn.send({
            type: 'player_info',
            name: AppState.playerName,
            color: AppState.myColor,
            id: AppState.playerId,
            gameType: AppState.currentGame
        });
        
        // Send current game state if room creator
        if (AppState.isRoomCreator && AppState.currentGame) {
            // Let the specific game module handle state sending
            AppState.gameModules[AppState.currentGame].sendGameState(conn);
        }
    });
    
    conn.on('data', data => {
        handlePeerMessage(conn.peer, data);
    });
    
    conn.on('close', () => {
        console.log('Connection closed with: ' + conn.peer);
        delete AppState.peers[conn.peer];
        delete AppState.players[conn.peer];
        updatePlayersList();
        
        addChatMessage('system', `${AppState.players[conn.peer]?.name || 'A player'} has disconnected.`);
    });
    
    conn.on('error', err => {
        console.error('Connection error:', err);
    });
}

/**
 * Handle messages from peers
 */
function handlePeerMessage(peerId, data) {
    console.log('Received message:', data);
    
    switch (data.type) {
        case 'player_info':
            AppState.players[peerId] = {
                name: data.name,
                color: data.color,
                id: data.id,
                gameType: data.gameType
            };
            updatePlayersList();
            
            // Notify when a new player joins
            addChatMessage('system', `${data.name} has joined the room.`);
            break;
            
        case 'chat_message':
            addChatMessage(peerId, data.message);
            break;
            
        case 'game_type':
            // If received game type differs from current, switch to it
            if (data.gameType !== AppState.currentGame) {
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