/**
 * Connection Manager for Mentalplayer
 * Provides an interface between the app and SimpleWebRTC
 */

const ConnectionManager = {
    // State
    playerName: '',
    playerId: '',
    isRoomCreator: false,
    roomId: '',
    players: {},
    gameModule: null,
    
    // UI Elements
    elements: {
        connectionStatus: document.getElementById('connection-status'),
        playerDisplay: document.getElementById('player-display'),
        roomInfo: document.getElementById('room-info'),
        currentRoomId: document.getElementById('current-room-id'),
        playersContainer: document.getElementById('players-container'),
        myConnectionId: document.getElementById('my-connection-id'),
        connectionInfoContainer: null
    },
    
    /**
     * Initialize the connection manager
     * @param {Object} options Configuration options
     */
    init: function(options = {}) {
        console.log('Initializing Connection Manager...');
        
        // Make sure SimpleWebRTC is available
        if (typeof SimpleWebRTC === 'undefined') {
            console.error('SimpleWebRTC not found. Please make sure webrtc.js is loaded');
            return;
        }
        
        // Set player info
        this.playerName = options.playerName || localStorage.getItem('playerName') || 'Player';
        
        // Update elements references
        this.updateElements();
        
        // Initialize WebRTC with callbacks
        this.playerId = SimpleWebRTC.init({
            callbacks: {
                onConnected: () => this.handleConnected(),
                onDisconnected: () => this.handleDisconnected(),
                onMessage: (message) => this.handleMessage(message),
                onError: (message, error) => this.handleError(message, error),
                onStatusChange: (status, message) => this.updateConnectionStatus(status, message),
                onNewIceCandidate: (candidate) => this.handleNewIceCandidate(candidate)
            }
        });
        
        // Update player display
        if (this.elements.playerDisplay) {
            this.elements.playerDisplay.textContent = this.playerName;
        }
        
        // Update connection ID display
        if (this.elements.myConnectionId) {
            this.elements.myConnectionId.textContent = this.playerId;
        }
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Add adapter.js for better browser compatibility
        this.loadScript('https://webrtc.github.io/adapter/adapter-latest.js');
        
        console.log('Connection Manager initialized with ID:', this.playerId);
        
        return this.playerId;
    },
    
    /**
     * Update UI element references to ensure we have the latest
     */
    updateElements: function() {
        this.elements.connectionStatus = document.getElementById('connection-status') || this.elements.connectionStatus;
        this.elements.playerDisplay = document.getElementById('player-display') || this.elements.playerDisplay;
        this.elements.roomInfo = document.getElementById('room-info') || this.elements.roomInfo;
        this.elements.currentRoomId = document.getElementById('current-room-id') || this.elements.currentRoomId;
        this.elements.playersContainer = document.getElementById('players-container') || this.elements.playersContainer;
        this.elements.myConnectionId = document.getElementById('my-connection-id') || this.elements.myConnectionId;
    },
    
    /**
     * Set up event listeners for connection-related elements
     */
    setupEventListeners: function() {
        // Create room button
        const createRoomButton = document.getElementById('create-room');
        if (createRoomButton) {
            createRoomButton.addEventListener('click', () => this.createRoom());
        }
        
        // Join room button
        const joinRoomButton = document.getElementById('join-room');
        if (joinRoomButton) {
            joinRoomButton.addEventListener('click', () => {
                const roomIdInput = document.getElementById('room-id');
                const roomId = roomIdInput ? roomIdInput.value.trim() : '';
                if (roomId) {
                    this.joinRoom(roomId);
                } else {
                    this.showManualConnectionInput();
                }
            });
        }
        
        // Add diagnostic button to troubleshooting
        const webrtcInfo = document.querySelector('.webrtc-info');
        if (webrtcInfo) {
            const diagnosticButton = document.createElement('button');
            diagnosticButton.id = 'diagnostic-button';
            diagnosticButton.className = 'button secondary-button';
            diagnosticButton.innerHTML = '<i class="fas fa-stethoscope"></i> Connection Diagnostics';
            diagnosticButton.addEventListener('click', () => this.showDiagnostics());
            
            webrtcInfo.appendChild(diagnosticButton);
        }
    },
    
    /**
     * Create a new room as initiator
     */
    createRoom: async function() {
        // Check if game is selected
        if (!this.gameModule && typeof AppState !== 'undefined' && !AppState.currentGame) {
            alert('Please select a game first.');
            return;
        }
        
        // Check if already in a room
        if (this.roomId) {
            if (!confirm('You are already in a room. Would you like to leave and create a new one?')) {
                return;
            }
            
            // Leave current room
            this.leaveRoom();
        }
        
        // Set as room creator
        this.isRoomCreator = true;
        this.roomId = this.playerId;
        
        // Update UI
        this.updateRoomInfo();
        
        try {
            // Create WebRTC connection
            this.updateConnectionStatus('connecting', 'Creating room...');
            const connectionInfo = await SimpleWebRTC.createConnection();
            
            if (connectionInfo) {
                // Show connection info for manual sharing
                this.showConnectionInfo(connectionInfo);
                
                // System message
                this.addChatMessage('system', 'Room created. Share the connection info with a friend to play together.');
            } else {
                this.updateConnectionStatus('error', 'Failed to create room');
                alert('Failed to create room. Please try again.');
            }
        } catch (error) {
            console.error('Error creating room:', error);
            this.updateConnectionStatus('error', 'Failed to create room');
            alert('Error creating room: ' + error.message);
        }
    },
    
    /**
     * Join an existing room as responder
     * @param {string} roomIdOrInfo Room ID or connection info
     */
    joinRoom: async function(roomIdOrInfo) {
        try {
            if (!roomIdOrInfo) {
                alert('Please enter a Room ID or connection info.');
                return;
            }
            
            // Check if trying to join own room
            if (roomIdOrInfo === this.playerId) {
                alert('You cannot join your own room this way.');
                return;
            }
            
            // Check if already in a room
            if (this.roomId) {
                if (!confirm('You are already in a room. Would you like to leave and join a new one?')) {
                    return;
                }
                
                // Leave current room
                this.leaveRoom();
            }
            
            // Try to parse as connection info
            let connectionInfo;
            try {
                if (roomIdOrInfo.length > 20 && (roomIdOrInfo.includes('{') || roomIdOrInfo.startsWith('{'))) {
                    connectionInfo = JSON.parse(roomIdOrInfo);
                }
            } catch (e) {
                console.log('Not valid JSON, treating as room ID');
            }
            
            if (connectionInfo && (connectionInfo.type === 'offer' || connectionInfo.offer)) {
                // Process as a connection info object
                this.processConnectionInfo(connectionInfo);
            } else {
                // Treat as a room ID and show manual connection UI
                this.showManualConnectionInput(roomIdOrInfo);
            }
        } catch (error) {
            console.error('Error joining room:', error);
            alert('Error joining room: ' + error.message);
        }
    },
    
    /**
     * Process connection info (offer or answer)
     * @param {Object} connectionInfo Connection information
     */
    processConnectionInfo: async function(connectionInfo) {
        try {
            if (!connectionInfo) {
                throw new Error('Failed to process answer');
                }
            } else {
                throw new Error('Unknown connection information type');
            }
        } catch (error) {
            console.error('Error processing connection info:', error);
            this.updateConnectionStatus('error', error.message);
            alert(error.message);
        }
    },
    
    /**
     * Handle new ICE candidate from the local peer
     * @param {RTCIceCandidate} candidate ICE candidate
     */
    handleNewIceCandidate: function(candidate) {
        // This could be used in trickle ICE implementation to send candidates immediately
        console.log('New ICE candidate to be sent:', candidate);
        // We're using gathered candidates instead for simplicity
    },
    
    /**
     * Add a remote ICE candidate
     * @param {Object} candidate ICE candidate
     */
    addRemoteCandidate: function(candidate) {
        SimpleWebRTC.addRemoteIceCandidate(candidate);
    },
    
    /**
     * Leave the current room
     */
    leaveRoom: function() {
        // Disconnect WebRTC
        SimpleWebRTC.disconnect();
        
        // Reset state
        this.isRoomCreator = false;
        this.roomId = '';
        this.players = {};
        
        // Update UI
        if (this.elements.roomInfo) {
            this.elements.roomInfo.style.display = 'none';
        }
        
        // Close any connection info modals
        this.hideConnectionInfo();
        
        // Update UI
        this.updatePlayersList();
        this.updateConnectionStatus('disconnected', 'Left room');
        
        // System message
        this.addChatMessage('system', 'Disconnected from room.');
    },
    
    /**
     * Send data to the connected peer
     * @param {Object} data Data to send
     */
    sendData: function(data) {
        return SimpleWebRTC.sendData(data);
    },
    
    /**
     * Handle successful connection
     */
    handleConnected: function() {
        console.log('Successfully connected!');
        
        // Hide connection info dialogs
        this.hideConnectionInfo();
        
        // Add self to players list
        this.players[this.playerId] = {
            name: this.playerName,
            id: this.playerId,
            color: this.getRandomColor()
        };
        
        // Send player info
        this.sendData({
            type: 'player_info',
            name: this.playerName,
            id: this.playerId,
            gameType: this.gameModule ? this.gameModule.type : 
                (typeof AppState !== 'undefined' ? AppState.currentGame : null)
        });
        
        // Update players list
        this.updatePlayersList();
        
        // Show success notification
        this.showNotification('Connected!', 'Connection established successfully.', 'success');
        
        // Add system message
        this.addChatMessage('system', 'Connection established!');
    },
    
    /**
     * Handle disconnection
     */
    handleDisconnected: function() {
        console.log('Disconnected from peer');
        
        // Find the other player
        const otherPlayerId = Object.keys(this.players).find(id => id !== this.playerId);
        if (otherPlayerId) {
            const playerName = this.players[otherPlayerId].name;
            delete this.players[otherPlayerId];
            
            // Update UI
            this.updatePlayersList();
            
            // Show notification
            this.showNotification('Disconnected', `${playerName} has disconnected.`, 'warning');
            
            // Add system message
            this.addChatMessage('system', `${playerName} has disconnected.`);
        }
    },
    
    /**
     * Handle incoming messages
     * @param {Object} message Message data
     */
    handleMessage: function(message) {
        try {
            console.log('Received message:', message);
            
            if (!message || !message.type) return;
            
            switch (message.type) {
                case 'player_info':
                    // Add player to list
                    this.players[message.id] = {
                        name: message.name,
                        id: message.id,
                        color: message.color || this.getRandomColor(),
                        gameType: message.gameType
                    };
                    
                    // Update players list
                    this.updatePlayersList();
                    
                    // Show notification
                    this.showNotification('Player Joined', `${message.name} has joined the game.`, 'info');
                    
                    // Add system message
                    this.addChatMessage('system', `${message.name} has joined the room.`);
                    
                    // If we're the room creator and they specified a game type, switch to it
                    if (this.isRoomCreator && message.gameType && 
                        this.gameModule && this.gameModule.type !== message.gameType &&
                        typeof selectGame === 'function') {
                        selectGame(message.gameType, false);
                    }
                    break;
                    
                case 'chat_message':
                    this.addChatMessage(message.senderId, message.message || message.text);
                    break;
                    
                case 'ping':
                    // Auto-respond to pings for connection testing
                    this.sendData({
                        type: 'pong',
                        timestamp: message.timestamp
                    });
                    break;
                    
                case 'pong':
                    // Calculate ping time if monitoring
                    if (typeof pingMonitor !== 'undefined' && message.timestamp) {
                        pingMonitor.receivePong(message.senderId, message.timestamp);
                    }
                    break;
                    
                default:
                    // Pass to game module or app for handling
                    if (this.gameModule && this.gameModule.handlePeerMessage) {
                        this.gameModule.handlePeerMessage(message.senderId, message);
                    } else if (typeof handlePeerMessage === 'function') {
                        handlePeerMessage(message.senderId, message);
                    } else {
                        console.log('Unhandled message type:', message.type);
                    }
                    break;
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    },
    
    /**
     * Handle errors
     * @param {string} message Error message
     * @param {Error} error Error object
     */
    handleError: function(message, error) {
        console.error('Connection error:', message, error);
        
        // Show notification
        this.showNotification('Connection Error', message, 'error');
        
        // Add system message
        this.addChatMessage('system', `Connection error: ${message}`);
    },
    
    /**
     * Update connection status display
     * @param {string} status Status code
     * @param {string} message Status message
     */
    updateConnectionStatus: function(status, message) {
        if (!this.elements.connectionStatus) return;
        
        // Update class
        this.elements.connectionStatus.className = 'connection-status ' + status;
        
        // Update text
        let displayText = status.charAt(0).toUpperCase() + status.slice(1);
        if (message) {
            displayText += ` <span class="status-details">(${message})</span>`;
        }
        
        this.elements.connectionStatus.innerHTML = displayText;
        
        // Add troubleshooting button if disconnected or error
        if (status === 'disconnected' || status === 'error') {
            const troubleshootButton = document.createElement('button');
            troubleshootButton.className = 'troubleshoot-button';
            troubleshootButton.innerHTML = '<i class="fas fa-question-circle"></i>';
            troubleshootButton.title = 'Connection help';
            troubleshootButton.addEventListener('click', () => this.showTroubleshooting());
            
            this.elements.connectionStatus.appendChild(troubleshootButton);
        }
    },
    
    /**
     * Update room info display
     */
    updateRoomInfo: function() {
        if (!this.elements.roomInfo || !this.elements.currentRoomId) return;
        
        this.elements.roomInfo.style.display = 'block';
        this.elements.currentRoomId.textContent = this.roomId;
        
        // Show side panel
        const sidePanel = document.getElementById('side-panel');
        if (sidePanel) {
            sidePanel.style.display = 'flex';
        }
    },
    
    /**
     * Update players list display
     */
    updatePlayersList: function() {
        if (!this.elements.playersContainer) return;
        
        this.elements.playersContainer.innerHTML = '';
        
        Object.values(this.players).forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.classList.add('player');
            
            if (player.id === this.playerId) {
                playerElement.classList.add('current-player');
            }
            
            const colorIndicator = document.createElement('div');
            colorIndicator.classList.add('player-color');
            colorIndicator.style.backgroundColor = player.color;
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = player.name + (player.id === this.playerId ? ' (You)' : '');
            
            playerElement.appendChild(colorIndicator);
            playerElement.appendChild(nameSpan);
            
            this.elements.playersContainer.appendChild(playerElement);
        });
    },
    
    /**
     * Show connection info for manual sharing
     * @param {Object} connectionInfo Connection info to share
     */
    showConnectionInfo: function(connectionInfo) {
        // Create modal for connection info
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        
        const infoString = JSON.stringify(connectionInfo);
        
        const content = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Share Connection Info</h2>
                </div>
                <div class="modal-body">
                    <p>Copy this text and send it to your friend:</p>
                    <textarea id="connection-info-text" readonly rows="5" style="width:100%">${infoString}</textarea>
                    
                    <div class="modal-buttons" style="margin-top: 10px;">
                        <button id="copy-connection-button" class="modal-button primary-button">
                            <i class="fas fa-copy"></i> Copy to Clipboard
                        </button>
                    </div>
                    
                    <hr style="margin: 20px 0;">
                    
                    <h3>Enter Friend's Response</h3>
                    <p>After sending the connection info, paste your friend's response here:</p>
                    <textarea id="connection-response" rows="5" style="width:100%" 
                        placeholder="Paste your friend's response here"></textarea>
                </div>
                <div class="modal-buttons">
                    <button id="process-response-button" class="modal-button primary-button">Connect</button>
                    <button id="close-connection-modal" class="modal-button secondary-button">Close</button>
                </div>
            </div>
        `;
        
        modal.innerHTML = content;
        document.body.appendChild(modal);
        
        // Store reference to the modal
        this.elements.connectionInfoContainer = modal;
        
        // Add event listeners
        document.getElementById('copy-connection-button').addEventListener('click', () => {
            const textArea = document.getElementById('connection-info-text');
            textArea.select();
            document.execCommand('copy');
            alert('Connection info copied to clipboard!');
        });
        
        document.getElementById('process-response-button').addEventListener('click', () => {
            const response = document.getElementById('connection-response').value;
            try {
                const responseObj = JSON.parse(response);
                this.processConnectionInfo(responseObj);
            } catch (e) {
                alert('Invalid response. Please check and try again.');
            }
        });
        
        document.getElementById('close-connection-modal').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        // Close when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    },
    
    /**
     * Show answer info for responder to share back
     * @param {Object} answerInfo Answer info
     */
    showAnswerInfo: function(answerInfo) {
        // Create modal for answer info
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        
        const infoString = JSON.stringify(answerInfo);
        
        const content = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Your Connection Response</h2>
                </div>
                <div class="modal-body">
                    <p>Copy this text and send it back to the person who invited you:</p>
                    <textarea id="answer-info-text" readonly rows="5" style="width:100%">${infoString}</textarea>
                </div>
                <div class="modal-buttons">
                    <button id="copy-answer-button" class="modal-button primary-button">
                        <i class="fas fa-copy"></i> Copy to Clipboard
                    </button>
                    <button id="close-answer-modal" class="modal-button secondary-button">Close</button>
                </div>
            </div>
        `;
        
        modal.innerHTML = content;
        document.body.appendChild(modal);
        
        // Store reference to the modal
        this.elements.answerInfoContainer = modal;
        
        // Add event listeners
        document.getElementById('copy-answer-button').addEventListener('click', () => {
            const textArea = document.getElementById('answer-info-text');
            textArea.select();
            document.execCommand('copy');
            alert('Response copied to clipboard!');
        });
        
        document.getElementById('close-answer-modal').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        // Close when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    },
    
    /**
     * Hide connection info containers
     */
    hideConnectionInfo: function() {
        if (this.elements.connectionInfoContainer) {
            this.elements.connectionInfoContainer.style.display = 'none';
        }
        
        if (this.elements.answerInfoContainer) {
            this.elements.answerInfoContainer.style.display = 'none';
        }
        
        // Also remove by ID
        const containers = [
            document.getElementById('connection-info-container'),
            document.getElementById('answer-info-container')
        ];
        
        containers.forEach(container => {
            if (container) container.style.display = 'none';
        });
    },
    
    /**
     * Show manual connection input
     * @param {string} roomId Optional room ID to pre-fill
     */
    showManualConnectionInput: function(roomId = '') {
        // Create connection info modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'manual-connection-modal';
        modal.style.display = 'flex';
        
        const content = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Manual Connection</h2>
                </div>
                <div class="modal-body">
                    <p>Ask your friend to create a room and share their connection info with you:</p>
                    
                    <textarea id="manual-connection-input" rows="5" style="width:100%" 
                        placeholder="Paste connection info here"></textarea>
                </div>
                <div class="modal-buttons">
                    <button id="connect-manual-button" class="modal-button primary-button">Connect</button>
                    <button id="close-manual-modal" class="modal-button secondary-button">Cancel</button>
                </div>
            </div>
        `;
        
        modal.innerHTML = content;
        document.body.appendChild(modal);
        
        // Add event listeners
        document.getElementById('connect-manual-button').addEventListener('click', () => {
            const input = document.getElementById('manual-connection-input').value.trim();
            if (input) {
                modal.style.display = 'none';
                this.joinRoom(input);
            } else {
                alert('Please paste connection information.');
            }
        });
        
        document.getElementById('close-manual-modal').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        // Close when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    },
    
    /**
     * Show connection troubleshooting guide
     */
    showTroubleshooting: function() {
        // Get existing troubleshooting modal
        let troubleshootingModal = document.getElementById('connectivity-guide');
        
        // If it doesn't exist, create it
        if (!troubleshootingModal) {
            troubleshootingModal = document.createElement('div');
            troubleshootingModal.id = 'connectivity-guide';
            troubleshootingModal.className = 'modal';
            
            const content = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Connection Troubleshooting</h2>
                    </div>
                    <div class="modal-body">
                        <p>If you're having trouble connecting:</p>
                        <ol>
                            <li>Make sure both users are using modern browsers (Chrome, Firefox, Edge)</li>
                            <li>Try refreshing the page and attempting the connection again</li>
                            <li>Disable any VPNs or firewalls that might block WebRTC</li>
                            <li>If you're behind a corporate network, it may block WebRTC connections</li>
                            <li>Try connecting from a different network or using a mobile hotspot</li>
                        </ol>
                        
                        <div class="webrtc-info">
                            <p><i class="fas fa-info-circle"></i> This app uses WebRTC for direct peer-to-peer connections</p>
                            <p>Some networks may require TURN servers for successful connections</p>
                        </div>
                    </div>
                    <div class="modal-buttons">
                        <button id="show-diagnostics" class="modal-button primary-button">Show Diagnostics</button>
                        <button id="show-manual" class="modal-button primary-button">Try Manual Connection</button>
                        <button id="close-guide" class="modal-button secondary-button">Close</button>
                    </div>
                </div>
            `;
            
            troubleshootingModal.innerHTML = content;
            document.body.appendChild(troubleshootingModal);
            
            // Add event listeners
            document.getElementById('show-diagnostics').addEventListener('click', () => {
                this.showDiagnostics();
            });
            
            document.getElementById('show-manual').addEventListener('click', () => {
                troubleshootingModal.style.display = 'none';
                this.showManualConnectionInput();
            });
            
            document.getElementById('close-guide').addEventListener('click', () => {
                troubleshootingModal.style.display = 'none';
            });
            
            // Close when clicking outside
            troubleshootingModal.addEventListener('click', (e) => {
                if (e.target === troubleshootingModal) {
                    troubleshootingModal.style.display = 'none';
                }
            });
        }
        
        // Show the modal
        troubleshootingModal.style.display = 'flex';
    },
    
    /**
     * Show connection diagnostics
     */
    showDiagnostics: function() {
        // Get diagnostic info
        const diagnosticInfo = SimpleWebRTC.diagnosticInfo();
        
        // Create diagnostics modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'diagnostics-modal';
        modal.style.display = 'flex';
        
        // Format network info
        let networkInfoHtml = '';
        if (diagnosticInfo.networkInfo !== 'N/A') {
            networkInfoHtml = `
                <tr><td>Connection Type:</td><td>${diagnosticInfo.networkInfo.type || 'unknown'}</td></tr>
                <tr><td>Effective Type:</td><td>${diagnosticInfo.networkInfo.effectiveType || 'unknown'}</td></tr>
                <tr><td>Downlink:</td><td>${diagnosticInfo.networkInfo.downlink || 'unknown'} Mbps</td></tr>
                <tr><td>RTT:</td><td>${diagnosticInfo.networkInfo.rtt || 'unknown'} ms</td></tr>
            `;
        }
        
        const content = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Connection Diagnostics</h2>
                </div>
                <div class="modal-body">
                    <h3>Browser Information</h3>
                    <table class="diagnostic-table">
                        <tr><td>User Agent:</td><td>${diagnosticInfo.browserInfo}</td></tr>
                        <tr><td>WebRTC Support:</td><td>${diagnosticInfo.webrtcSupport ? 'Yes' : 'No'}</td></tr>
                    </table>
                    
                    <h3>Connection State</h3>
                    <table class="diagnostic-table">
                        <tr><td>Connection State:</td><td>${diagnosticInfo.connectionState}</td></tr>
                        <tr><td>ICE Connection State:</td><td>${diagnosticInfo.iceConnectionState}</td></tr>
                        <tr><td>ICE Gathering State:</td><td>${diagnosticInfo.iceGatheringState}</td></tr>
                        <tr><td>Signalling State:</td><td>${diagnosticInfo.signallingState}</td></tr>
                        <tr><td>Data Channel State:</td><td>${diagnosticInfo.dataChannelState}</td></tr>
                        <tr><td>ICE Candidates Gathered:</td><td>${diagnosticInfo.candidatesGathered}</td></tr>
                    </table>
                    
                    <h3>Network Information</h3>
                    <table class="diagnostic-table">
                        ${networkInfoHtml}
                    </table>
                    
                    <p style="margin-top: 20px;"><strong>Tip:</strong> Copy this information when reporting connection issues.</p>
                </div>
                <div class="modal-buttons">
                    <button id="copy-diagnostics" class="modal-button primary-button">Copy Info</button>
                    <button id="close-diagnostics" class="modal-button secondary-button">Close</button>
                </div>
            </div>
        `;
        
        modal.innerHTML = content;
        document.body.appendChild(modal);
        
        // Add CSS for diagnostics table
        const style = document.createElement('style');
        style.textContent = `
            .diagnostic-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 10px;
            }
            .diagnostic-table td {
                padding: 4px 8px;
                border-bottom: 1px solid #eee;
            }
            .diagnostic-table tr td:first-child {
                font-weight: bold;
                width: 40%;
            }
        `;
        document.head.appendChild(style);
        
        // Add event listeners
        document.getElementById('copy-diagnostics').addEventListener('click', () => {
            const diagnosticText = JSON.stringify(diagnosticInfo, null, 2);
            this.copyToClipboard(diagnosticText);
            alert('Diagnostic information copied to clipboard!');
        });
        
        document.getElementById('close-diagnostics').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        // Close when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    },
    
    /**
     * Add a chat message
     * @param {string} senderId Sender ID or 'system'
     * @param {string} text Message text
     */
    addChatMessage: function(senderId, text) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;
        
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message');
        
        let senderName = '';
        let isSystem = false;
        
        if (senderId === 'system') {
            isSystem = true;
            messageElement.classList.add('system-message');
        } else if (senderId === this.playerId) {
            senderName = 'You';
            messageElement.classList.add('own-message');
        } else {
            senderName = this.players[senderId]?.name || 'Unknown';
            messageElement.classList.add('peer-message');
        }
        
        let messageContent = '';
        if (isSystem) {
            messageContent = `<div class="message-text">${text}</div>`;
        } else {
            const senderColor = senderId === this.playerId ? 
                this.players[this.playerId]?.color : 
                this.players[senderId]?.color || '#999';
                
            messageContent = `
                <div class="message-sender" style="color: ${senderColor};">${senderName}:</div>
                <div class="message-text">${this.escapeHtml(text)}</div>
            `;
        }
        
        messageElement.innerHTML = messageContent;
        chatMessages.appendChild(messageElement);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Play notification sound for messages from others
        if (senderId !== this.playerId && !isSystem) {
            this.playNotificationSound();
        }
    },
    
    /**
     * Send a chat message
     * @param {string} text Message text
     */
    sendChatMessage: function(text) {
        if (!text.trim()) return;
        
        // Add message to local chat
        this.addChatMessage(this.playerId, text);
        
        // Send to peer
        this.sendData({
            type: 'chat_message',
            message: text
        });
    },
    
    /**
     * Show a notification
     * @param {string} title Notification title
     * @param {string} message Notification message
     * @param {string} type Notification type (info, success, warning, error)
     */
    showNotification: function(title, message, type = 'info') {
        // Create notification container if it doesn't exist
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            document.body.appendChild(container);
        }
        
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
        
        // Add to container
        container.appendChild(notification);
        
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
    },
    
    /**
     * Copy text to clipboard
     * @param {string} text Text to copy
     */
    copyToClipboard: function(text) {
        // Create a temporary input element
        const input = document.createElement('textarea');
        input.style.position = 'fixed';
        input.style.opacity = 0;
        input.value = text;
        document.body.appendChild(input);
        
        // Select and copy
        input.select();
        document.execCommand('copy');
        
        // Clean up
        document.body.removeChild(input);
    },
    
    /**
     * Play notification sound for new messages
     */
    playNotificationSound: function() {
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
    },
    
    /**
     * Get a random color
     * @returns {string} Random color
     */
    getRandomColor: function() {
        const hue = Math.floor(Math.random() * 360);
        return `hsl(${hue}, 70%, 60%)`;
    },
    
    /**
     * Escape HTML to prevent XSS
     * @param {string} text Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml: function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    /**
     * Load a script dynamically
     * @param {string} src Script URL
     * @param {Function} callback Optional callback when loaded
     */
    loadScript: function(src, callback) {
        // Check if script is already loaded
        if (document.querySelector(`script[src="${src}"]`)) {
            if (callback) callback();
            return;
        }
        
        const script = document.createElement('script');
        script.src = src;
        
        if (callback) {
            script.onload = callback;
        }
        
        script.onerror = () => {
            console.error(`Failed to load script: ${src}`);
        };
        
        document.head.appendChild(script);
    }
};

// Initialize the connection manager when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Create notification container if it doesn't exist
    if (!document.getElementById('notification-container')) {
        const container = document.createElement('div');
        container.id = 'notification-container';
        document.body.appendChild(container);
    }
    
    // Initialize the connection manager if player has entered their name
    const playerName = localStorage.getItem('playerName');
    if (playerName) {
        // Initialize after a short delay to ensure DOM is ready
        setTimeout(() => {
            ConnectionManager.init({
                playerName: playerName
            });
        }, 500);
    }
    
    // Set up event handlers for chat
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-message');
    
    if (chatInput && sendButton) {
        // Handle send button click
        sendButton.addEventListener('click', () => {
            const text = chatInput.value.trim();
            if (text) {
                ConnectionManager.sendChatMessage(text);
                chatInput.value = '';
            }
        });
        
        // Handle Enter key in chat input
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const text = chatInput.value.trim();
                if (text) {
                    ConnectionManager.sendChatMessage(text);
                    chatInput.value = '';
                }
            }
        });
    }
});Invalid connection information');
            }
            
            // Handle offer (join as responder)
            if (connectionInfo.type === 'offer' || connectionInfo.offer) {
                this.isRoomCreator = false;
                this.roomId = connectionInfo.initiatorId;
                
                // Update UI
                this.updateRoomInfo();
                
                // Join the connection
                this.updateConnectionStatus('connecting', 'Joining room...');
                const answerInfo = await SimpleWebRTC.joinConnection(connectionInfo);
                
                if (answerInfo) {
                    // Show answer for sharing back to initiator
                    this.showAnswerInfo(answerInfo);
                } else {
                    throw new Error('Failed to create answer');
                }
            }
            // Handle answer (as initiator)
            else if (connectionInfo.type === 'answer' || connectionInfo.answer) {
                if (!this.isRoomCreator) {
                    throw new Error('Cannot process answer: not a room creator');
                }
                
                // Process the answer
                const result = await SimpleWebRTC.processAnswer(connectionInfo);
                
                if (result) {
                    this.updateConnectionStatus('connecting', 'Finalizing connection...');
                    // Hide connection info container
                    if (this.elements.connectionInfoContainer) {
                        this.elements.connectionInfoContainer.style.display = 'none';
                    }
                } else {
                    throw new Error('