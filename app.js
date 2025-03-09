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
    checkSavedPlayerName();
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
        leaveCurrentRoom();
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
    
    // Check if already in a room
    if (AppState.roomId) {
        if (!confirm('You are already in a room. Would you like to leave the current room and create a new one?')) {
            return;
        }
        // Leave current room first
        leaveCurrentRoom();
    }
    
    // Use player ID as room ID for simplicity and uniqueness
    AppState.roomId = AppState.playerId;
    AppState.isRoomCreator = true;
    
    // Update UI
    updateRoomInfo();
    
    // Initialize game
    AppState.gameModules[AppState.currentGame].reset();
    
    addChatMessage('system', 'Room created. Invite friends to join!');
    
    // Automatically show invite dialog
    showInviteModal();
}

/**
 * Leave the current room
 */
function leaveCurrentRoom() {
    // Stop ping monitoring
    pingMonitor.stop();
    
    // Close all peer connections
    Object.values(AppState.peers).forEach(conn => {
        try {
            if (conn.open) {
                conn.close();
            }
        } catch (e) {
            console.error('Error closing connection:', e);
        }
    });
    
    // Reset room state
    AppState.roomId = '';
    AppState.isRoomCreator = false;
    AppState.peers = {};
    AppState.players = {};
    
    // Update UI
    elements.roomInfo.style.display = 'none';
    updatePlayersList();
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
    
    // Check if trying to join own room
    if (inputRoomId === AppState.playerId) {
        alert('You cannot join your own room this way.');
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
    try {
        updateConnectionStatus('connecting');
        
        const conn = AppState.peer.connect(peerId, {
            reliable: true,
            metadata: {
                name: AppState.playerName
            }
        });
        
        // Set timeout for connection attempt
        const connectionTimeout = setTimeout(() => {
            if (conn.open === false) {
                alert('Connection timed out. Make sure the Room ID is correct.');
                updateConnectionStatus('disconnected');
            }
        }, 10000); // 10 second timeout
        
        conn.on('open', () => {
            clearTimeout(connectionTimeout);
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
            handlePeerDisconnection(conn.peer);
        });
        
        conn.on('error', err => {
            console.error('Connection error:', err);
            alert(`Connection error: ${err.message}`);
            updateConnectionStatus('disconnected');
            handlePeerDisconnection(conn.peer);
        });
    } catch (error) {
        console.error('Failed to establish connection:', error);
        alert('Failed to connect. Please try again.');
        updateConnectionStatus('disconnected');
    }
}

/**
 * Handle peer disconnection
 */
function handlePeerDisconnection(peerId) {
    // Check if this was the room creator
    const wasRoomCreator = peerId === AppState.roomId;
    
    // Update UI
    delete AppState.peers[peerId];
    
    const disconnectedPlayerName = AppState.players[peerId]?.name || 'A player';
    delete AppState.players[peerId];
    
    updatePlayersList();
    updateConnectionStatus(Object.keys(AppState.peers).length > 0 ? 'connected' : 'disconnected');
    
    // Notify user
    addChatMessage('system', `${disconnectedPlayerName} has disconnected.`);
    
    // If room creator disconnected, notify and consider leaving room
    if (wasRoomCreator) {
        addChatMessage('system', 'The room creator has disconnected. The game may not function properly.');
        
        if (confirm('The room creator has disconnected. Would you like to return to the game selection?')) {
            returnToGameSelection();
        }
    }
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
    
    // Start ping monitoring
    pingMonitor.updatePeers(AppState.peers);
    pingMonitor.start();
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
            <div class="message-text">${escapeHtml(message)}</div>
        `;
    }
    
    messageElement.innerHTML = messageContent;
    elements.chatMessages.appendChild(messageElement);
    
    // Scroll to bottom
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    
    // Add notification sound for new messages (except own messages)
    if (senderId !== AppState.playerId && !isSystem) {
        playNotificationSound();
    }
}

/**
 * Escape HTML to prevent XSS in chat
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Play notification sound for new messages
 */
function playNotificationSound() {
    try {
        // Create audio context
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        
        // Create oscillator (simple beep)
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 600;
        gainNode.gain.value = 0.1; // Low volume
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        // Start and stop after short duration
        oscillator.start();
        setTimeout(() => {
            oscillator.stop();
        }, 150);
    } catch (e) {
        console.log('Could not play notification sound:', e);
    }
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

/**
 * Show privacy policy modal
 */
function showPrivacyPolicy() {
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
                    <p>1.0.0 (March 2025)</p>
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
 * Ping monitoring system for connection quality
 */
class PingMonitor {
    constructor() {
        this.peers = {};
        this.pingInterval = null;
        this.pingTimeouts = {};
        this.pingElement = document.getElementById('ping-value');
        this.lastPings = [];
    }
    
    start() {
        if (this.pingInterval) this.stop();
        
        this.pingInterval = setInterval(() => {
            this.sendPings();
        }, 5000); // Check every 5 seconds
    }
    
    stop() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        // Clear any pending timeouts
        Object.values(this.pingTimeouts).forEach(timeout => {
            clearTimeout(timeout);
        });
        
        this.pingTimeouts = {};
        this.lastPings = [];
        this.updateDisplay('--');
    }
    
    updatePeers(peers) {
        this.peers = peers;
    }
    
    sendPings() {
        if (Object.keys(this.peers).length === 0) {
            this.updateDisplay('--');
            return;
        }
        
        const timestamp = Date.now();
        
        // Send ping to all peers
        Object.entries(this.peers).forEach(([peerId, conn]) => {
            try {
                if (conn.open) {
                    conn.send({
                        type: 'ping',
                        timestamp: timestamp
                    });
                    
                    // Set timeout for response
                    this.pingTimeouts[peerId] = setTimeout(() => {
                        // No response received
                        this.updateDisplay('!');
                    }, 10000); // 10 second timeout
                }
            } catch (e) {
                console.error('Error sending ping:', e);
            }
        });
    }
    
    receivePong(peerId, timestamp) {
        // Calculate ping
        const pingTime = Date.now() - timestamp;
        
        // Clear timeout
        if (this.pingTimeouts[peerId]) {
            clearTimeout(this.pingTimeouts[peerId]);
            delete this.pingTimeouts[peerId];
        }
        
        // Add to recent pings (keep last 3)
        this.lastPings.push(pingTime);
        if (this.lastPings.length > 3) {
            this.lastPings.shift();
        }
        
        // Calculate average ping
        const averagePing = Math.round(
            this.lastPings.reduce((sum, ping) => sum + ping, 0) / this.lastPings.length
        );
        
        this.updateDisplay(averagePing);
    }
    
    updateDisplay(value) {
        if (this.pingElement) {
            this.pingElement.textContent = value;
            
            // Update color based on ping quality
            if (value === '--' || value === '!') {
                this.pingElement.style.color = '#999';
            } else if (value < 100) {
                this.pingElement.style.color = '#4CAF50'; // Good ping
            } else if (value < 200) {
                this.pingElement.style.color = '#FF9800'; // Medium ping
            } else {
                this.pingElement.style.color = '#F44336'; // Bad ping
            }
        }
    }
    
    handlePeerMessage(peerId, data) {
        if (data.type === 'ping') {
            // Respond with pong
            if (AppState.peers[peerId] && AppState.peers[peerId].open) {
                AppState.peers[peerId].send({
                    type: 'pong',
                    timestamp: data.timestamp
                });
            }
        } else if (data.type === 'pong') {
            this.receivePong(peerId, data.timestamp);
        }
    }
}

// Create ping monitor instance
const pingMonitor = new PingMonitor();

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
        savePlayerName(name);
        AppState.playerName = name;
        elements.entryModal.style.display = 'none';
        updatePlayerDisplay();
        
        initializePeer();
    } else {
        alert('Please enter your name to continue.');
    }
}

/**
 * Check for saved player name in cookies
 */
function checkSavedPlayerName() {
    const savedName = getCookie('playerName');
    if (savedName) {
        elements.playerNameInput.value = savedName;
    }
}

/**
 * Save player name to cookie
 */
function savePlayerName(name) {
    setCookie('playerName', name, 30); // Save for 30 days
}

/**
 * Update player display in header
 */
function updatePlayerDisplay() {
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
    // Only allow name change if not in a room
    if (AppState.roomId) {
        alert('You cannot change your name while in a room.');
        return;
    }
    
    const newName = prompt('Enter your new name:', AppState.playerName);
    if (newName && newName.trim()) {
        savePlayerName(newName.trim());
        AppState.playerName = newName.trim();
        updatePlayerDisplay();
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
 * Initialize PeerJS connection
 */
function initializePeer() {
    updateConnectionStatus('connecting');
    
    // Check if we already have a peer connection
    if (AppState.peer) {
        try {
            AppState.peer.destroy();
        } catch (e) {
            console.log('Error destroying previous peer connection:', e);
        }
    }
    
    // Create new peer with reliability options
    AppState.peer = new Peer(null, {
        debug: 2,
        config: {
            'iceServers': [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        }
    });
    
    // Set a timeout for the initial connection
    const peerConnectionTimeout = setTimeout(() => {
        if (!AppState.playerId) {
            updateConnectionStatus('disconnected');
            alert('Connection to the PeerJS server timed out. Please check your internet connection and try again.');
        }
    }, 15000); // 15 second timeout
    
    AppState.peer.on('open', id => {
        clearTimeout(peerConnectionTimeout);
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
        clearTimeout(peerConnectionTimeout);
        console.error('PeerJS error:', err);
        
        // Show appropriate error message based on error type
        if (err.type === 'peer-unavailable') {
            alert('Could not connect to the specified room. The room may not exist or has been closed.');
        } else if (err.type === 'network' || err.type === 'server-error') {
            alert('Network or server error. Please check your internet connection and try again.');
        } else {
            alert(`Connection error: ${err.message || 'Unknown error'}`);
        }
        
        updateConnectionStatus('disconnected');
    });
    
    AppState.peer.on('disconnected', () => {
        updateConnectionStatus('disconnected');
        console.log('Peer disconnected');
        
        // Try to reconnect
        setTimeout(() => {
            if (AppState.peer) {
                AppState.peer.reconnect();
            }
        }, 3000);
    });
}

/**
 * Handle new peer connection
 */
function handleConnection(conn) {
    console.log('New incoming connection from:', conn.peer);
    
    // Check if this is a valid room connection
    if (AppState.isRoomCreator || AppState.roomId) {
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
                // First confirm game type
                conn.send({
                    type: 'game_type',
                    gameType: AppState.currentGame
                });
                
                // Let the specific game module handle state sending
                setTimeout(() => {
                    if (AppState.gameModules[AppState.currentGame]) {
                        AppState.gameModules[AppState.currentGame].sendGameState(conn);
                    }
                }, 500); // Small delay to ensure game type is processed first
            }
        });
        
        conn.on('data', data => {
            handlePeerMessage(conn.peer, data);
        });
        
        conn.on('close', () => {
            console.log('Connection closed with: ' + conn.peer);
            handlePeerDisconnection(conn.peer);
        });
        
        conn.on('error', err => {
            console.error('Connection error:', err);
            handlePeerDisconnection(conn.peer);
        });
    } else {
        // Automatically close connections if we're not in a room
        setTimeout(() => {
            if (conn.open) {
                conn.close();
            }
        }, 100);
    }
}

/**
 * Handle messages from peers
 */
function handlePeerMessage(peerId, data) {
    console.log('Received message:', data);
    
    // Handle ping monitoring
    if (data.type === 'ping' || data.type === 'pong') {
        pingMonitor.handlePeerMessage(peerId, data);
        return;
    }
    
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