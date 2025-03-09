/**
 * Show network information for troubleshooting
 */
async function showNetworkInfo() {
    // Create modal if it doesn't exist
    let networkModal = document.getElementById('network-info-modal');
    
    if (!networkModal) {
        networkModal = document.createElement('div');
        networkModal.id = 'network-info-modal';
        networkModal.className = 'modal';
        
        // Create modal content
        networkModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Network Information</h2>
                </div>
                <div class="modal-body" id="network-info-content">
                    <div class="loading-container">
                        <div class="loading-spinner"></div>
                        <p>Collecting network information...</p>
                    </div>
                </div>
                <div class="modal-buttons">
                    <button id="close-network-info" class="modal-button secondary-button">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(networkModal);
        
        // Add close button event
        document.getElementById('close-network-info').addEventListener('click', () => {
            networkModal.style.display = 'none';
        });
        
        // Close when clicking outside
        networkModal.addEventListener('click', (e) => {
            if (e.target === networkModal) {
                networkModal.style.display = 'none';
            }
        });
    }
    
    // Show the modal
    networkModal.style.display = 'flex';
    
    // Get network info content area
    const networkContent = document.getElementById('network-info-content');
    
    // Start gathering network info
    try {
        // Get connection info
        let networkInfo = '';
        
        // Get browser info
        networkInfo += `<h3>Browser</h3>`;
        networkInfo += `<p>Browser: ${getBrowserInfo()}</p>`;
        networkInfo += `<p>User Agent: ${navigator.userAgent}</p>`;
        
        // Get basic connection info
        networkInfo += `<h3>Connection</h3>`;
        
        if (navigator.connection) {
            networkInfo += `<p>Type: ${navigator.connection.type || 'unknown'}</p>`;
            networkInfo += `<p>Effective Type: ${navigator.connection.effectiveType || 'unknown'}</p>`;
            networkInfo += `<p>Downlink: ${navigator.connection.downlink || 'unknown'} Mbps</p>`;
            networkInfo += `<p>RTT: ${navigator.connection.rtt || 'unknown'} ms</p>`;
        } else {
            networkInfo += `<p>Connection API not available</p>`;
        }
        
        // Get IP information
        networkInfo += `<h3>IP Information</h3>`;
        
        try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            networkInfo += `<p>Public IP: ${ipData.ip}</p>`;
        } catch (error) {
            networkInfo += `<p>Could not determine public IP: ${error.message}</p>`;
        }
        
        // WebRTC information
        networkInfo += `<h3>WebRTC</h3>`;
        networkInfo += `<p>PeerJS ID: ${AppState.playerId || 'Not connected'}</p>`;
        networkInfo += `<p>Connected Peers: ${Object.keys(AppState.peers).length}</p>`;
        networkInfo += `<p>TURN Status: ${document.getElementById('turn-status').className.includes('active') ? 'Active' : 'Inactive'}</p>`;
        
        // Update the content
        networkContent.innerHTML = networkInfo;
        
    } catch (error) {
        networkContent.innerHTML = `<p>Error collecting network information: ${error.message}</p>`;
    }
}/**
 * Add additional event listeners after DOM is loaded
 */
function addAdditionalEventListeners() {
    // Manual connection modal
    document.getElementById('close-manual-connection').addEventListener('click', () => {
        elements.manualConnectionModal.style.display = 'none';
    });
    
    document.getElementById('show-manual-connection').addEventListener('click', () => {
        document.getElementById('connectivity-guide').style.display = 'none';
        elements.manualConnectionModal.style.display = 'flex';
    });
    
    // Add manual connection button to room controls
    const roomControls = document.querySelector('.room-controls');
    const manualConnectButton = document.createElement('button');
    manualConnectButton.id = 'manual-connect-button';
    manualConnectButton.className = 'button secondary-button';
    manualConnectButton.innerHTML = '<i class="fas fa-plug"></i> Manual Connect';
    manualConnectButton.addEventListener('click', () => {
        elements.manualConnectionModal.style.display = 'flex';
    });
    roomControls.appendChild(manualConnectButton);
    
    // Add TURN server status indicator to header
    const connectionStatus = document.getElementById('connection-status');
    const turnStatus = document.createElement('div');
    turnStatus.id = 'turn-status';
    turnStatus.className = 'turn-status';
    turnStatus.innerHTML = '<span class="turn-indicator">TURN</span>';
    connectionStatus.parentNode.insertBefore(turnStatus, connectionStatus.nextSibling);
    
    // Add troubleshooting button to error modal
    document.getElementById('show-troubleshooting').addEventListener('click', () => {
        document.getElementById('connection-error-modal').style.display = 'none';
        showConnectionTroubleshooting();
    });
    
    // Add network info link to troubleshooting
    const webrtcInfo = document.querySelector('.webrtc-info');
    if (webrtcInfo) {
        const networkInfoButton = document.createElement('button');
        networkInfoButton.id = 'network-info-button';
        networkInfoButton.className = 'button secondary-button';
        networkInfoButton.innerHTML = '<i class="fas fa-network-wired"></i> Network Details';
        networkInfoButton.addEventListener('click', showNetworkInfo);
        
        const networkInfoContainer = document.createElement('div');
        networkInfoContainer.className = 'network-info-container';
        networkInfoContainer.appendChild(networkInfoButton);
        
        webrtcInfo.appendChild(networkInfoContainer);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        initApp();
        addAdditionalEventListeners();
        
        // Add a version number to the footer
        const footer = document.querySelector('.main-footer');
        if (footer) {
            const versionElem = document.createElement('div');
            versionElem.className = 'version-info';
            versionElem.innerHTML = 'v1.3.1 with enhanced resources';
            footer.appendChild(versionElem);
        }
        
        // Add notification container
        const notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        document.body.appendChild(notificationContainer);
        
        // Show a welcome notification with connection tips
        setTimeout(() => {
            showNotification('Welcome to Mentalplayer', 
                            'For best results, allow some time for connections to establish.', 
                            'info');
        }, 3000);
    } catch (error) {
        console.error('Error initializing app:', error);
        alert('There was an error initializing the application. Please try refreshing the page.');
    }
});/**
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
    manualConnectionModal: document.getElementById('manual-connection-ui'),
    
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
    // Check if CSS has loaded properly
    checkCssLoaded();
    
    setupEventListeners();
    checkUrlForRoom();
    registerGameModules();
    checkSavedPlayerName();
}

/**
 * Check if CSS has loaded properly
 */
function checkCssLoaded() {
    // Basic check for CSS loading status
    const hasStyles = document.styleSheets.length > 1; // At least one external stylesheet plus inline
    console.log(`CSS check: ${hasStyles ? 'External stylesheets detected' : 'No external stylesheets detected'}`);
    
    // Additional check for specific styles
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
        const containerStyle = window.getComputedStyle(appContainer);
        if (containerStyle.display !== 'flex') {
            console.warn('CSS may not be fully loaded or applied');
            showCssLoadingWarning();
        }
    }
}

/**
 * Show a warning about CSS loading issues
 */
function showCssLoadingWarning() {
    const cssError = document.getElementById('css-loading-error');
    if (cssError) {
        cssError.style.display = 'flex';
    }
}

/**
 * Broadcast message to all connected peers
 */
function broadcastToPeers(message) {
    // Log the broadcast
    console.log('Broadcasting message:', message.type);
    
    // Use a delay to stagger messages and avoid network congestion
    let delay = 0;
    const increment = 50; // milliseconds between each send
    
    Object.values(AppState.peers).forEach(conn => {
        setTimeout(() => {
            sendWithRetry(conn, message);
        }, delay);
        delay += increment;
    });
}

/**
 * Update connection status display
 */
function updateConnectionStatus(status, details = '') {
    elements.connectionStatus.className = 'connection-status ' + status;
    
    let statusText = status.charAt(0).toUpperCase() + status.slice(1);
    if (details) {
        statusText += ` <span class="status-details">(${details})</span>`;
    }
    
    elements.connectionStatus.innerHTML = statusText;
    
    // Update TURN status based on connection status
    const turnStatus = document.getElementById('turn-status');
    if (turnStatus) {
        if (status === 'connected') {
            turnStatus.className = 'turn-status turn-active';
        } else {
            turnStatus.className = 'turn-status turn-inactive';
        }
    }
    
    // Show troubleshooting if disconnected
    if (status === 'disconnected' && AppState.roomId) {
        const troubleshootButton = document.createElement('button');
        troubleshootButton.className = 'troubleshoot-button';
        troubleshootButton.innerHTML = '<i class="fas fa-question-circle"></i>';
        troubleshootButton.title = 'Connection help';
        troubleshootButton.addEventListener('click', showConnectionTroubleshooting);
        elements.connectionStatus.appendChild(troubleshootButton);
    }
    
    // Log status change
    console.log(`Connection status: ${status}${details ? ' (' + details + ')' : ''}`);
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
    
    // Generate a random room ID - 8 characters max
    AppState.roomId = generateRandomId();
    AppState.isRoomCreator = true;
    
    // Update room ID input to match
    elements.roomIdInput.value = AppState.roomId;
    
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
    
    // Limit room ID to 8 characters
    const trimmedRoomId = inputRoomId.substring(0, 8);
    
    // Check if trying to join own room
    if (trimmedRoomId === AppState.playerId) {
        alert('You cannot join your own room this way.');
        return;
    }
    
    AppState.roomId = trimmedRoomId;
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
    
    // Check if peer exists to avoid duplicated handling
    if (!AppState.peers[peerId]) {
        console.log('Peer already disconnected or not in peer list:', peerId);
        return;
    }
    
    // Try to close the connection if still open
    try {
        if (AppState.peers[peerId] && AppState.peers[peerId].open) {
            AppState.peers[peerId].close();
        }
    } catch (e) {
        console.log('Error closing peer connection:', e);
    }
    
    // Update UI
    const disconnectedPlayerName = AppState.players[peerId]?.name || 'A player';
    
    // Remove from peers and players
    delete AppState.peers[peerId];
    delete AppState.players[peerId];
    
    // Update player list and connection status
    updatePlayersList();
    const connectedPeers = Object.keys(AppState.peers).length;
    updateConnectionStatus(connectedPeers > 0 ? 'connected' : 'disconnected', 
                         connectedPeers > 0 ? `${connectedPeers} peer(s)` : 'no peers');
    
    // Notify user
    addChatMessage('system', `${disconnectedPlayerName} has disconnected.`);
    
    // If room creator disconnected, notify and consider leaving room
    if (wasRoomCreator && !AppState.isRoomCreator) {
        addChatMessage('system', 'The room creator has disconnected. The game may not function properly.');
        
        // Show a notification but don't force disconnect
        showNotification('Room creator disconnected', 
                         'The room creator has disconnected. You may continue playing, but some functionality might be limited.',
                         'warning');
    }
}

/**
 * Show a notification
 */
function showNotification(title, message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Set content
    notification.innerHTML = `
        <div class="notification-header">
            <span class="notification-title">${title}</span>
            <button class="notification-close"><i class="fas fa-times"></i></button>
        </div>
        <div class="notification-body">
            <p>${message}</p>
        </div>
    `;
    
    // Add notification to the page
    const notificationContainer = document.getElementById('notification-container');
    
    if (!notificationContainer) {
        // Create container if it doesn't exist
        const container = document.createElement('div');
        container.id = 'notification-container';
        document.body.appendChild(container);
        container.appendChild(notification);
    } else {
        notificationContainer.appendChild(notification);
    }
    
    // Add close functionality
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.classList.add('notification-hiding');
        setTimeout(() => {
            notification.remove();
        }, 300);
    });
    
    // Auto-hide after 10 seconds for non-error notifications
    if (type !== 'error') {
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.add('notification-hiding');
                setTimeout(() => {
                    notification.remove();
                }, 300);
            }
        }, 10000);
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
    
    // Manual connection
    document.getElementById('copy-my-id').addEventListener('click', () => {
        const myId = document.getElementById('my-connection-id').textContent;
        navigator.clipboard.writeText(myId).then(() => {
            alert('Your ID has been copied to clipboard!');
        });
    });
    
    document.getElementById('connect-to-friend').addEventListener('click', () => {
        const friendId = document.getElementById('friend-id').value.trim();
        if (friendId) {
            // Set as room ID and join
            elements.roomIdInput.value = friendId;
            joinRoom();
        } else {
            alert('Please enter your friend\'s ID');
        }
    });
    
    // Connection modals
    document.getElementById('close-connectivity-guide').addEventListener('click', () => {
        document.getElementById('connectivity-guide').style.display = 'none';
    });
    
    document.getElementById('retry-connection-button').addEventListener('click', () => {
        document.getElementById('connection-error-modal').style.display = 'none';
        joinRoom();
    });
    
    document.getElementById('close-connection-error-modal').addEventListener('click', () => {
        document.getElementById('connection-error-modal').style.display = 'none';
    });
    
    // Game over modal
    document.getElementById('close-game-over-modal').addEventListener('click', () => {
        document.getElementById('game-over-modal').style.display = 'none';
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', e => {
        if (e.target === elements.inviteModal) {
            elements.inviteModal.style.display = 'none';
        }
        if (e.target === document.getElementById('game-over-modal')) {
            document.getElementById('game-over-modal').style.display = 'none';
        }
        if (e.target === document.getElementById('connectivity-guide')) {
            document.getElementById('connectivity-guide').style.display = 'none';
        }
        if (e.target === document.getElementById('connection-error-modal')) {
            document.getElementById('connection-error-modal').style.display = 'none';
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
async function initializePeer() {
    try {
        updateConnectionStatus('connecting');
        
        // Check if we already have a peer connection
        if (AppState.peer) {
            try {
                AppState.peer.destroy();
            } catch (e) {
                console.log('Error destroying previous peer connection:', e);
            }
        }
        
        // Generate a short random ID (8 characters max)
        const peerId = generateRandomId();
        
        // Default ICE servers (STUN only)
        let iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            { urls: 'stun:stun.stunprotocol.org:3478' },
            { urls: 'stun:stun.voip.blackberry.com:3478' }
        ];
        
        // Try to fetch TURN server credentials
        try {
            const response = await fetch("https://mentalplayer.metered.live/api/v1/turn/credentials?apiKey=2ea89f5bfe297a1c8b6cf84013f358728e9d");
            
            // Only use the response if it's successful
            if (response.ok) {
                const turnServers = await response.json();
                if (Array.isArray(turnServers) && turnServers.length > 0) {
                    console.log('Successfully fetched TURN server credentials');
                    iceServers = turnServers;
                    
                    // Update TURN status indicator
                    const turnStatus = document.getElementById('turn-status');
                    if (turnStatus) {
                        turnStatus.className = 'turn-status turn-active';
                    }
                } else {
                    console.warn('TURN server response invalid:', turnServers);
                }
            } else {
                console.warn('TURN server fetch failed with status:', response.status);
            }
        } catch (error) {
            console.error('Error fetching TURN server credentials:', error);
        }
        
        // Create PeerJS instance with ice servers
        AppState.peer = new Peer(peerId, {
            secure: true,
            host: 'peerjs.herokuapp.com',
            port: 443,
            debug: 1, // Reduce debug level to avoid console spam
            config: {
                iceServers: iceServers,
                sdpSemantics: 'unified-plan', // Add explicit SDP semantics
                iceCandidatePoolSize: 10 // Increase candidate pool for better connectivity
            }
        });
        
        setupPeerEventListeners();
        
    } catch (error) {
        console.error('Error initializing peer:', error);
        updateConnectionStatus('disconnected', 'initialization failed');
        alert('Failed to initialize connection system. Please refresh the page and try again.');
    }
}

/**
 * Set up event listeners for the peer connection
 */
function setupPeerEventListeners() {
    // Set a timeout for the initial connection
    const peerConnectionTimeout = setTimeout(() => {
        if (!AppState.playerId) {
            updateConnectionStatus('disconnected');
            console.error('Connection to the PeerJS server timed out');
            
            // Try alternative PeerJS server
            tryAlternativePeerServer();
        }
    }, 20000); // 20 second timeout - increased for reliability
    
    AppState.peer.on('open', id => {
        clearTimeout(peerConnectionTimeout);
        AppState.playerId = id;
        updateConnectionStatus('connected', 'ready');
        console.log('My peer ID is: ' + id);
        
        // Update manual connection ID display
        document.getElementById('my-connection-id').textContent = id;
        
        // Auto-join room if in URL
        const urlParams = new URLSearchParams(window.location.search);
        const roomParam = urlParams.get('room');
        if (roomParam) {
            elements.roomIdInput.value = roomParam;
            setTimeout(() => joinRoom(), 1000); // Delay to ensure peer is fully ready
        }
    });
    
    AppState.peer.on('connection', conn => {
        console.log('Received connection from peer:', conn.peer);
        handleConnection(conn);
    });
    
    AppState.peer.on('error', err => {
        clearTimeout(peerConnectionTimeout);
        console.error('PeerJS error:', err);
        
        // Handle specific error types
        if (err.type === 'peer-unavailable') {
            console.log('Peer unavailable');
            updateConnectionStatus('disconnected', 'peer not found');
            showConnectionErrorModal('Could not connect to the specified room. The room may not exist or has been closed.');
        } else if (err.type === 'network' || err.type === 'socket-error') {
            console.log('Network or socket error');
            updateConnectionStatus('disconnected', 'network error');
            showConnectionErrorModal('Network error. Please check your internet connection and try again.');
        } else if (err.type === 'server-error') {
            console.log('Server error - will try alternative server');
            updateConnectionStatus('disconnected', 'server error');
            tryAlternativePeerServer();
        } else if (err.type === 'browser-incompatible') {
            console.log('Browser incompatible');
            updateConnectionStatus('disconnected', 'browser incompatible');
            showConnectionErrorModal('Your browser does not support WebRTC. Please use a modern browser like Chrome, Firefox, or Edge.');
        } else {
            console.log('Other PeerJS error:', err.type);
            updateConnectionStatus('disconnected', err.type || 'unknown error');
            showConnectionErrorModal(`Connection error: ${err.message || 'Unknown error'}`);
        }
    });
    
    AppState.peer.on('disconnected', () => {
        updateConnectionStatus('disconnected', 'lost connection');
        console.log('Peer disconnected');
        
        // Try to reconnect
        setTimeout(() => {
            if (AppState.peer) {
                console.log('Attempting to reconnect...');
                try {
                    AppState.peer.reconnect();
                } catch (e) {
                    console.error('Reconnection failed:', e);
                    // If reconnection fails, try alternative server
                    tryAlternativePeerServer();
                }
            }
        }, 3000);
    });
}

/**
 * Try an alternative PeerJS server if the primary one fails
 */
function tryAlternativePeerServer() {
    console.log('Trying alternative PeerJS server...');
    updateConnectionStatus('connecting', 'alternative server');
    
    // Back up existing state
    const currentRoomId = AppState.roomId;
    const isRoomCreator = AppState.isRoomCreator;
    
    // Generate a new random ID (8 characters max)
    const peerId = generateRandomId();
    
    // Clean up existing peer
    if (AppState.peer) {
        try {
            AppState.peer.destroy();
        } catch (e) {
            console.log('Error destroying previous peer connection:', e);
        }
    }
    
    // Try with a different free PeerJS server (0.peerjs.com)
    AppState.peer = new Peer(peerId, {
        host: '0.peerjs.com',
        secure: true,
        port: 443,
        debug: 1,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });
    
    // Restore state when connected
    AppState.peer.on('open', id => {
        AppState.playerId = id;
        updateConnectionStatus('connected', 'alternative server');
        console.log('Connected to alternative server. My peer ID is: ' + id);
        
        // Update manual connection ID display
        document.getElementById('my-connection-id').textContent = id;
        
        // Restore room if was in one
        if (currentRoomId) {
            // If was room creator, create a new room
            if (isRoomCreator) {
                setTimeout(() => createRoom(), 1000);
            }
        }
    });
    
    // Set other event listeners
    AppState.peer.on('connection', handleConnection);
    
    AppState.peer.on('error', err => {
        console.error('Alternative server error:', err);
        updateConnectionStatus('disconnected', 'all servers failed');
        showConnectionErrorModal('All connection servers failed. Please try again later or use manual connection.');
    });
}

/**
 * Generate a random ID (8 characters)
 */
function generateRandomId() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

/**
 * Show connection troubleshooting modal
 */
function showConnectionTroubleshooting() {
    document.getElementById('connectivity-guide').style.display = 'flex';
    
    // Add browser WebRTC information
    const webrtcInfo = document.querySelector('.webrtc-info');
    if (webrtcInfo) {
        // Clear any existing dynamic content
        while (webrtcInfo.children.length > 2) {
            webrtcInfo.removeChild(webrtcInfo.lastChild);
        }
        
        // Add browser information
        const browserInfo = document.createElement('p');
        browserInfo.innerHTML = `Your browser: <strong>${getBrowserInfo()}</strong>`;
        webrtcInfo.appendChild(browserInfo);
        
        // Add WebRTC support test
        if (window.RTCPeerConnection) {
            const supportInfo = document.createElement('p');
            supportInfo.innerHTML = '<span style="color: green;"><i class="fas fa-check-circle"></i> Your browser supports WebRTC</span>';
            webrtcInfo.appendChild(supportInfo);
            
            // Add TURN server info
            const turnInfo = document.createElement('p');
            turnInfo.innerHTML = '<span style="color: green;"><i class="fas fa-server"></i> TURN relay server activated</span>';
            webrtcInfo.appendChild(turnInfo);
        } else {
            const supportInfo = document.createElement('p');
            supportInfo.innerHTML = '<span style="color: red;"><i class="fas fa-times-circle"></i> Your browser does NOT support WebRTC</span>';
            webrtcInfo.appendChild(supportInfo);
        }
    }
}

/**
 * Get browser information
 */
function getBrowserInfo() {
    const userAgent = navigator.userAgent;
    let browserName = "Unknown";
    
    if (userAgent.match(/chrome|chromium|crios/i)) {
        browserName = "Chrome";
    } else if (userAgent.match(/firefox|fxios/i)) {
        browserName = "Firefox";
    } else if (userAgent.match(/safari/i)) {
        browserName = "Safari";
    } else if (userAgent.match(/opr\//i)) {
        browserName = "Opera";
    } else if (userAgent.match(/edg/i)) {
        browserName = "Edge";
    }
    
    return browserName;
}

/**
 * Show connection error modal
 */
function showConnectionErrorModal(message) {
    const errorModal = document.getElementById('connection-error-modal');
    const errorMessage = document.getElementById('connection-error-message');
    
    if (errorModal && errorMessage) {
        // Check if modal is already showing (to prevent stacking errors)
        if (errorModal.style.display === 'flex') {
            console.log('Error modal already showing, updating message');
            errorMessage.textContent = message || 'There was a problem connecting to the room.';
            return;
        }
        
        // Set the error message
        errorMessage.textContent = message || 'There was a problem connecting to the room.';
        
        // Show the error modal
        errorModal.style.display = 'flex';
        
        // Auto-hide after some time
        setTimeout(() => {
            errorModal.style.display = 'none';
        }, 8000);
    } else {
        // Fallback if modal elements not found
        console.error('Error modal elements not found, using alert instead');
        alert(message || 'There was a problem connecting to the room.');
    }
}

/**
 * Handle new peer connection
 */
function handleConnection(conn) {
    console.log('New incoming connection from:', conn.peer);
    
    // Check if this is a valid room connection
    if (AppState.isRoomCreator || AppState.roomId) {
        let connectionOpenHandler = () => {
            console.log('Connected to: ' + conn.peer);
            
            // Store the connection
            AppState.peers[conn.peer] = conn;
            
            // Exchange player info
            sendWithRetry(conn, {
                type: 'player_info',
                name: AppState.playerName,
                color: AppState.myColor,
                id: AppState.playerId,
                gameType: AppState.currentGame
            });
            
            // Send current game state if room creator
            if (AppState.isRoomCreator && AppState.currentGame) {
                // First confirm game type
                sendWithRetry(conn, {
                    type: 'game_type',
                    gameType: AppState.currentGame
                });
                
                // Let the specific game module handle state sending
                setTimeout(() => {
                    if (AppState.gameModules[AppState.currentGame]) {
                        AppState.gameModules[AppState.currentGame].sendGameState(conn);
                    }
                }, 1000); // Small delay to ensure game type is processed first
            }
        };
        
        // If connection is already open, call the handler immediately
        if (conn.open) {
            connectionOpenHandler();
        } else {
            conn.on('open', connectionOpenHandler);
        }
        
        // Set up error handling
        conn.on('error', err => {
            console.error('Connection error from peer:', err);
            handlePeerDisconnection(conn.peer);
        });
        
        // Set up data handling
        conn.on('data', data => {
            try {
                handlePeerMessage(conn.peer, data);
            } catch (error) {
                console.error('Error handling peer message:', error, data);
            }
        });
        
        // Set up close handling
        conn.on('close', () => {
            console.log('Connection closed with: ' + conn.peer);
            handlePeerDisconnection(conn.peer);
        });
    } else {
        // Automatically close connections if we're not in a room
        console.log('Rejecting connection as we are not in a room');
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