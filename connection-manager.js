/**
 * Connection Manager for Mentalplayer
 * Provides an interface between the app and SimpleWebRTC with improved state management
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
        connectionInfoContainer: null,
        answerInfoContainer: null
    },
    
    /**
     * Initialize the connection manager with improved logging
     * @param {Object} options Configuration options
     * @returns {string} Player ID
     */
    init: function(options = {}) {
        console.log('[ConnectionManager] Initializing with options:', options);
        
        // Make sure SimpleWebRTC is available
        if (typeof SimpleWebRTC === 'undefined') {
            console.error('[ConnectionManager] SimpleWebRTC not found. Please make sure webrtc.js is loaded');
            this.showNotification('Connection Error', 'WebRTC system not available. Please refresh the page.', 'error');
            return null;
        }
        
        // Set player info
        this.playerName = options.playerName || localStorage.getItem('playerName') || 'Player';
        console.log('[ConnectionManager] Player name:', this.playerName);
        
        this.roomId = ''; // Reset roomId on initialization
        this.isRoomCreator = false; // Reset room creator status
        this.players = {}; // Reset players list

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
                onNewIceCandidate: (candidate) => this.handleNewIceCandidate(candidate),
                onReconnectAttempt: (peerId) => this.handleReconnectAttempt(peerId)
            }
        });
        
        console.log('[ConnectionManager] Initialized with ID:', this.playerId);
        
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
        
        // Add self to players list
        this.players[this.playerId] = {
            name: this.playerName,
            id: this.playerId,
            color: this.getRandomColor()
        };
        
        // Sync with AppState if available
        if (typeof AppState !== 'undefined') {
            this.syncWithAppState();
        }
        
        // Show welcome notification
        this.showNotification('Connection Ready', 'You can now create or join a room', 'info');
        
        return this.playerId;
    },
    
    /**
     * Synchronize state with AppState
     */
    syncWithAppState: function() {
        console.log('[ConnectionManager] Synchronizing with AppState');
        
        if (typeof AppState === 'undefined') {
            console.warn('[ConnectionManager] AppState not available for synchronization');
            return;
        }
        
        // Update AppState with our values
        AppState.playerName = this.playerName;
        AppState.playerId = this.playerId;
        AppState.roomId = this.roomId;
        AppState.isRoomCreator = this.isRoomCreator;
        AppState.players = this.players;
        
        // Set game module if AppState has a current game
        if (AppState.currentGame && typeof AppState.gameModules !== 'undefined' && AppState.gameModules[AppState.currentGame]) {
            this.gameModule = AppState.gameModules[AppState.currentGame];
        }
        
        console.log('[ConnectionManager] State synchronized with AppState:', {
            playerName: AppState.playerName,
            playerId: AppState.playerId,
            roomId: AppState.roomId,
            isRoomCreator: AppState.isRoomCreator,
            currentGame: AppState.currentGame
        });
    },
    
    /**
     * Update UI element references to ensure we have the latest
     */
    updateElements: function() {
        console.log('[ConnectionManager] Updating UI element references');
        
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
        console.log('[ConnectionManager] Setting up event listeners');
        
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
     * Create a new room as initiator with improved handling
     */
    createRoom: async function() {
        console.log('[ConnectionManager] Creating room...');
        
        // Check if game is selected
        if (!this.gameModule && typeof AppState !== 'undefined' && !AppState.currentGame) {
            alert('Please select a game first.');
            return;
        }
    
        // Better check for already in a room - verify both roomId and connection state
        if (this.roomId && this.roomId.length > 0 && SimpleWebRTC.state.isConnected) {
            if (!confirm('You are already in a room. Would you like to leave and create a new one?')) {
                return;
            }
        
            // Leave current room
            this.leaveRoom();
        } else if (this.roomId && this.roomId.length > 0) {
            // We have a roomId but no active connection - just reset it
            console.log("[ConnectionManager] Resetting stale roomId:", this.roomId);
            this.roomId = '';
            this.isRoomCreator = false;
        }
    
        // Set as room creator
        this.isRoomCreator = true;
        this.roomId = this.playerId;
        
        // Sync with AppState
        if (typeof AppState !== 'undefined') {
            AppState.roomId = this.roomId;
            AppState.isRoomCreator = this.isRoomCreator;
            console.log('[ConnectionManager] Synced room state with AppState:', {
                roomId: AppState.roomId,
                isRoomCreator: AppState.isRoomCreator
            });
        }
        
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
                this.showNotification('Connection Error', 'Failed to create room. Please try again.', 'error');
            }
        } catch (error) {
            console.error('[ConnectionManager] Error creating room:', error);
            this.updateConnectionStatus('error', 'Failed to create room');
            this.showNotification('Connection Error', 'Error creating room: ' + error.message, 'error');
        }
    },
    
    /**
     * Join an existing room as responder with improved handling
     * @param {string} roomIdOrInfo Room ID or connection info
     */
    joinRoom: async function(roomIdOrInfo) {
        console.log('[ConnectionManager] Joining room with info:', roomIdOrInfo);
        
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
                    console.log('[ConnectionManager] Parsed connection info:', {
                        type: connectionInfo.type,
                        initiatorId: connectionInfo.initiatorId,
                        hasCandidates: !!connectionInfo.candidates
                    });
                }
            } catch (e) {
                console.log('[ConnectionManager] Not valid JSON, treating as room ID:', e);
            }
            
            if (connectionInfo && (connectionInfo.type === 'offer' || connectionInfo.offer)) {
                // Process as a connection info object
                this.processConnectionInfo(connectionInfo);
            } else {
                // Treat as a room ID and show manual connection UI
                this.showManualConnectionInput(roomIdOrInfo);
            }
        } catch (error) {
            console.error('[ConnectionManager] Error joining room:', error);
            this.showNotification('Connection Error', 'Error joining room: ' + error.message, 'error');
        }
    },
    
    /**
     * Handle reconnection attempts from SimpleWebRTC
     * @param {string} peerId Peer ID to reconnect to
     */
    handleReconnectAttempt: function(peerId) {
        console.log('[ConnectionManager] Attempting to reconnect to peer:', peerId);
        this.showNotification('Connection Issue', 'Attempting to reconnect...', 'warning');
        
        // If we're the responder, we need to try re-joining the room
        if (!this.isRoomCreator && this.roomId) {
            // Wait a moment and try to rejoin
            setTimeout(() => {
                const roomIdInput = document.getElementById('room-id');
                if (roomIdInput) {
                    roomIdInput.value = this.roomId;
                }
                this.showManualConnectionInput(this.roomId);
            }, 2000);
        }
    },
    
    /**
     * Process connection info (offer or answer) with improved handling
     * @param {Object} connectionInfo Connection information
     */
    processConnectionInfo: async function(connectionInfo) {
        console.log('[ConnectionManager] Processing connection info:', {
            type: connectionInfo.type,
            hasOffer: !!connectionInfo.offer,
            hasAnswer: !!connectionInfo.answer
        });
        
        try {
            if (!connectionInfo) {
                throw new Error('Invalid connection information');
            }
            
            // Handle offer (join as responder)
            if (connectionInfo.type === 'offer' || connectionInfo.offer) {
                this.isRoomCreator = false;
                this.roomId = connectionInfo.initiatorId;
                
                // Sync with AppState
                if (typeof AppState !== 'undefined') {
                    AppState.roomId = this.roomId;
                    AppState.isRoomCreator = this.isRoomCreator;
                }
                
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
                    throw new Error('Failed to process answer');
                }
            } else {
                throw new Error('Unknown connection information type');
            }
        } catch (error) {
            console.error('[ConnectionManager] Error processing connection info:', error);
            this.updateConnectionStatus('error', error.message);
            this.showNotification('Connection Error', error.message, 'error');
        }
    },
    
    /**
     * Handle new ICE candidate from the local peer
     * @param {RTCIceCandidate} candidate ICE candidate
     */
    handleNewIceCandidate: function(candidate) {
        console.log('[ConnectionManager] New ICE candidate to be sent');
    },
    
    /**
     * Leave the current room with improved handling
     */
    leaveRoom: function() {
        console.log('[ConnectionManager] Leaving room:', this.roomId);
        
        // Disconnect WebRTC
        SimpleWebRTC.disconnect();
        
        // Reset state
        this.isRoomCreator = false;
        this.roomId = '';
        
        // Keep only self in players list
        const currentPlayerData = this.players[this.playerId];
        this.players = {};
        if (currentPlayerData) {
            this.players[this.playerId] = currentPlayerData;
        }
        
        // Sync with AppState
        if (typeof AppState !== 'undefined') {
            AppState.roomId = '';
            AppState.isRoomCreator = false;
            AppState.players = { ...this.players };
        }
        
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
     * Send data to the connected peer with improved handling
     * @param {Object} data Data to send
     * @returns {boolean} Success status
     */
    sendData: function(data) {
        // Don't log ping/pong messages to avoid console noise
        if (data.type !== 'ping' && data.type !== 'pong') {
            console.log('[ConnectionManager] Sending data:', data);
        }
        
        return SimpleWebRTC.sendData(data);
    },
    
    /**
     * Handle successful connection with improved handling
     */
    handleConnected: function() {
        console.log('[ConnectionManager] Successfully connected!');
        
        // Hide connection info dialogs
        this.hideConnectionInfo();
        
        // Make sure self is in players list
        if (!this.players[this.playerId]) {
            this.players[this.playerId] = {
                name: this.playerName,
                id: this.playerId,
                color: this.getRandomColor()
            };
        }
        
        // Sync with AppState
        if (typeof AppState !== 'undefined') {
            AppState.players = { ...this.players };
        }
        
        // Send player info
        this.sendData({
            type: 'player_info',
            name: this.playerName,
            id: this.playerId,
            color: this.players[this.playerId].color,
            gameType: this.gameModule ? this.gameModule.type : 
                (typeof AppState !== 'undefined' ? AppState.currentGame : null)
        });
        
        // Update players list
        this.updatePlayersList();
        
        // Show success notification
        this.showNotification('Connected!', 'Connection established successfully.', 'success');
        
        // Add system message
        this.addChatMessage('system', 'Connection established!');
        
        // Send game state if we're the room creator and have a game module
        if (this.isRoomCreator && this.gameModule && this.gameModule.sendGameState) {
            setTimeout(() => {
                console.log('[ConnectionManager] Sending game state to peer');
                this.gameModule.sendGameState(SimpleWebRTC);
            }, 1000);
        }
    },
    
    /**
     * Handle disconnection with improved handling
     */
    handleDisconnected: function() {
        console.log('[ConnectionManager] Disconnected from peer');
        
        // Find the other player
        const otherPlayerId = Object.keys(this.players).find(id => id !== this.playerId);
        if (otherPlayerId) {
            const playerName = this.players[otherPlayerId].name;
            delete this.players[otherPlayerId];
            
            // Sync with AppState
            if (typeof AppState !== 'undefined') {
                AppState.players = { ...this.players };
            }
            
            // Update UI
            this.updatePlayersList();
            
            // Show notification
            this.showNotification('Disconnected', `${playerName} has disconnected.`, 'warning');
            
            // Add system message
            this.addChatMessage('system', `${playerName} has disconnected.`);
        }
    },
    
    /**
     * Handle incoming messages with improved handling
     * @param {Object} message Message data
     */
    handleMessage: function(message) {
        try {
            // Don't log ping/pong messages to avoid console noise
            if (message.type !== 'ping' && message.type !== 'pong') {
                console.log('[ConnectionManager] Received message:', message);
            }
            
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
                    
                    // Sync with AppState
                    if (typeof AppState !== 'undefined') {
                        AppState.players = { ...this.players };
                    }
                    
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
                    } else if (typeof AppState !== 'undefined' && 
                               AppState.gameModules && 
                               AppState.currentGame && 
                               AppState.gameModules[AppState.currentGame] &&
                               AppState.gameModules[AppState.currentGame].handlePeerMessage) {
                        AppState.gameModules[AppState.currentGame].handlePeerMessage(message.senderId, message);
                    } else {
                        console.log('[ConnectionManager] Unhandled message type:', message.type);
                    }
                    break;
            }
        } catch (error) {
            console.error('[ConnectionManager] Error handling message:', error);
        }
    },
    
    /**
     * Handle errors with improved handling
     * @param {string} message Error message
     * @param {Error} error Error object
     */
    handleError: function(message, error) {
        console.error('[ConnectionManager] Connection error:', message, error);
        
        // Show notification
        this.showNotification('Connection Error', message, 'error');
        
        // Add system message
        this.addChatMessage('system', `Connection error: ${message}`);
    },
    
    /**
     * Update connection status display with improved handling
     * @param {string} status Status code
     * @param {string} message Status message
     */
    updateConnectionStatus: function(status, message) {
        console.log(`[ConnectionManager] Connection status: ${status} - ${message}`);
        
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
        console.log('[ConnectionManager] Updating room info:', this.roomId);
        
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
        console.log('[ConnectionManager] Updating players list:', Object.keys(this.players));
        
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
     * Show connection info for manual sharing with improved UI
     * @param {Object} connectionInfo Connection info to share
     */
    showConnectionInfo: function(connectionInfo) {
        console.log('[ConnectionManager] Showing connection info');
        
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
                    <p>Copy this text and send it to your friend to join your game:</p>
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
            this.showNotification('Copied!', 'Connection info copied to clipboard', 'success');
        });
        
        document.getElementById('process-response-button').addEventListener('click', () => {
            const response = document.getElementById('connection-response').value;
            try {
                const responseObj = JSON.parse(response);
                this.processConnectionInfo(responseObj);
            } catch (e) {
                this.showNotification('Error', 'Invalid response. Please check and try again.', 'error');
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
     * Show answer info for responder to share back with improved UI
     * @param {Object} answerInfo Answer info
     */
    showAnswerInfo: function(answerInfo) {
        console.log('[ConnectionManager] Showing answer info');
        
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
            this.showNotification('Copied!', 'Response copied to clipboard', 'success');
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
        console.log('[ConnectionManager] Hiding connection info containers');
        
        if (this.elements.connectionInfoContainer) {
            this.elements.connectionInfoContainer.style.display = 'none';
        }
        
        if (this.elements.answerInfoContainer) {
            this.elements.answerInfoContainer.style.display = 'none';
        }
        
        // Also remove by ID
        const containers = [
            document.getElementById('connection-info-container'),
            document.getElementById('answer-info-container'),
            document.getElementById('manual-connection-modal')
        ];
        
        containers.forEach(container => {
            if (container) container.style.display = 'none';
        });
    },
    
    /**
     * Show manual connection input with improved UI
     * @param {string} roomId Optional room ID to pre-fill
     */
    showManualConnectionInput: function(roomId = '') {
        console.log('[ConnectionManager] Showing manual connection input');
        
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
                this.showNotification('Error', 'Please paste connection information', 'error');
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
     * Show connection troubleshooting guide with improved UI
     */
    showTroubleshooting: function() {
        console.log('[ConnectionManager] Showing troubleshooting guide');
        
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
     * Show connection diagnostics with improved UI
     */
    showDiagnostics: function() {
        console.log('[ConnectionManager] Showing connection diagnostics');
        
        // Get diagnostic info
        const diagnosticInfo = SimpleWebRTC.diagnosticInfo();
        
        // Create diagnostics modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'diagnostics-modal';
        modal.style.display = 'flex';
        
        // Format connection info
        let connectionInfoHtml = '';
        if (diagnosticInfo.connection !== 'No connection') {
            connectionInfoHtml = `
                <tr><td>Connection State:</td><td>${diagnosticInfo.connection.connectionState || 'unknown'}</td></tr>
                <tr><td>ICE Connection State:</td><td>${diagnosticInfo.connection.iceConnectionState || 'unknown'}</td></tr>
                <tr><td>ICE Gathering State:</td><td>${diagnosticInfo.connection.iceGatheringState || 'unknown'}</td></tr>
                <tr><td>Signaling State:</td><td>${diagnosticInfo.connection.signalingState || 'unknown'}</td></tr>
            `;
        } else {
            connectionInfoHtml = `<tr><td colspan="2">No active connection</td></tr>`;
        }
        
        // Format data channel info
        let channelInfoHtml = '';
        if (diagnosticInfo.dataChannel !== 'No channel') {
            channelInfoHtml = `
                <tr><td>Data Channel Label:</td><td>${diagnosticInfo.dataChannel.label || 'unknown'}</td></tr>
                <tr><td>Data Channel State:</td><td>${diagnosticInfo.dataChannel.readyState || 'unknown'}</td></tr>
                <tr><td>Buffered Amount:</td><td>${diagnosticInfo.dataChannel.bufferedAmount || '0'}</td></tr>
            `;
        } else {
            channelInfoHtml = `<tr><td colspan="2">No data channel</td></tr>`;
        }
        
        // Format network info
        let networkInfoHtml = '';
        if (diagnosticInfo.networkInfo !== 'N/A') {
            networkInfoHtml = `
                <tr><td>Connection Type:</td><td>${diagnosticInfo.networkInfo.type || 'unknown'}</td></tr>
                <tr><td>Effective Type:</td><td>${diagnosticInfo.networkInfo.effectiveType || 'unknown'}</td></tr>
                <tr><td>Downlink:</td><td>${diagnosticInfo.networkInfo.downlink || 'unknown'} Mbps</td></tr>
                <tr><td>RTT:</td><td>${diagnosticInfo.networkInfo.rtt || 'unknown'} ms</td></tr>
            `;
        } else {
            networkInfoHtml = `<tr><td colspan="2">Network information not available</td></tr>`;
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
                        ${connectionInfoHtml}
                        <tr><td>ICE Candidates Gathered:</td><td>${diagnosticInfo.candidatesGathered}</td></tr>
                        <tr><td>Pending Candidates:</td><td>${diagnosticInfo.pendingCandidates}</td></tr>
                    </table>
                    
                    <h3>Data Channel</h3>
                    <table class="diagnostic-table">
                        ${channelInfoHtml}
                    </table>
                    
                    <h3>Connection Status</h3>
                    <table class="diagnostic-table">
                        <tr><td>Is Initiator:</td><td>${diagnosticInfo.state.isInitiator}</td></tr>
                        <tr><td>Is Connected:</td><td>${diagnosticInfo.state.isConnected}</td></tr>
                        <tr><td>Is Connecting:</td><td>${diagnosticInfo.state.isConnecting}</td></tr>
                        <tr><td>Retry Count:</td><td>${diagnosticInfo.state.retryCount}</td></tr>
                    </table>
                    
                    <h3>Network Information</h3>
                    <table class="diagnostic-table">
                        ${networkInfoHtml}
                    </table>
                    
                    <h3>Mentalplayer State</h3>
                    <table class="diagnostic-table">
                        <tr><td>Player ID:</td><td>${this.playerId}</td></tr>
                        <tr><td>Room ID:</td><td>${this.roomId || 'Not in a room'}</td></tr>
                        <tr><td>Is Room Creator:</td><td>${this.isRoomCreator}</td></tr>
                        <tr><td>Player Count:</td><td>${Object.keys(this.players).length}</td></tr>
                        <tr><td>Current Game:</td><td>${this.gameModule ? this.gameModule.type : 'None'}</td></tr>
                    </table>
                    
                    <p style="margin-top: 20px;"><strong>Tip:</strong> Copy this information when reporting connection issues.</p>
                </div>
                <div class="modal-buttons">
                    <button id="fix-connection" class="modal-button primary-button">Fix Connection</button>
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
        document.getElementById('fix-connection').addEventListener('click', () => {
            this.reinitializeConnection();
            modal.style.display = 'none';
        });
        
        document.getElementById('copy-diagnostics').addEventListener('click', () => {
            const diagnosticText = JSON.stringify(diagnosticInfo, null, 2);
            this.copyToClipboard(diagnosticText);
            this.showNotification('Copied', 'Diagnostic information copied to clipboard', 'success');
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
     * Reinitialize the connection to fix issues
     */
    reinitializeConnection: function() {
        console.log('[ConnectionManager] Reinitializing connection');
        
        // Disconnect current connection
        SimpleWebRTC.disconnect();
        
        // Reset state
        this.roomId = '';
        this.isRoomCreator = false;
        
        // Keep only self in players list
        const currentPlayerData = this.players[this.playerId];
        this.players = {};
        if (currentPlayerData) {
            this.players[this.playerId] = currentPlayerData;
        }
        
        // Sync with AppState
        if (typeof AppState !== 'undefined') {
            AppState.roomId = '';
            AppState.isRoomCreator = false;
            AppState.players = { ...this.players };
        }
        
        // Hide room info
        if (this.elements.roomInfo) {
            this.elements.roomInfo.style.display = 'none';
        }
        
        // Update UI
        this.updatePlayersList();
        this.updateConnectionStatus('initialized', 'Reinitialized');
        
        // System message
        this.addChatMessage('system', 'Connection reinitialized. You can now create or join a room.');
        
        // Show notification
        this.showNotification('Reinitialized', 'Connection has been reinitialized', 'info');
        
        // Initialize WebRTC again
        SimpleWebRTC.init({
            callbacks: {
                onConnected: () => this.handleConnected(),
                onDisconnected: () => this.handleDisconnected(),
                onMessage: (message) => this.handleMessage(message),
                onError: (message, error) => this.handleError(message, error),
                onStatusChange: (status, message) => this.updateConnectionStatus(status, message),
                onNewIceCandidate: (candidate) => this.handleNewIceCandidate(candidate),
                onReconnectAttempt: (peerId) => this.handleReconnectAttempt(peerId)
            }
        });
        
        // Hide any open connection modals
        this.hideConnectionInfo();
    },
    
    /**
     * Add a chat message
     * @param {string} senderId Sender ID or 'system'
     * @param {string} text Message text
     */
    addChatMessage: function(senderId, text) {
        console.log(`[ConnectionManager] Adding chat message from ${senderId}: ${text}`);
        
        const isSystem = senderId === 'system';
        const chatMessages = document.getElementById('chat-messages');
        
        if (!chatMessages) {
            console.warn('[ConnectionManager] Chat messages container not found');
            return;
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = isSystem ? 'system-message' : 
            (senderId === this.playerId ? 'chat-message own-message' : 'chat-message peer-message');
        
        let messageContent = '';
        
        // Add sender name for peer messages
        if (!isSystem && senderId !== this.playerId) {
            const senderName = this.players[senderId] ? this.players[senderId].name : 'Unknown Player';
            const senderColor = this.players[senderId] && this.players[senderId].color ? 
                this.players[senderId].color : '#808080';
                
            messageContent += `<div class="message-sender" style="color: ${senderColor}">${senderName}</div>`;
        }
        
        // Add message text
        messageContent += `<div class="message-text">${text}</div>`;
        
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
     * Play notification sound for new messages
     */
    playNotificationSound: function() {
        try {
            // Create a simple beep sound
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime); // Low volume
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1); // Short beep
        } catch (e) {
            console.warn('[ConnectionManager] Could not play notification sound:', e);
        }
    },
    
    /**
     * Copy text to clipboard
     * @param {string} text Text to copy
     */
    copyToClipboard: function(text) {
        const textarea = document.createElement('textarea');
        textarea.textContent = text;
        textarea.style.position = 'fixed';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
        } catch (ex) {
            console.warn('[ConnectionManager] Copy to clipboard failed:', ex);
        } finally {
            document.body.removeChild(textarea);
        }
    },
    
    /**
     * Show notification
     * @param {string} title Notification title
     * @param {string} message Notification message
     * @param {string} type Notification type (info, success, warning, error)
     */
    showNotification: function(title, message, type = 'info') {
        console.log(`[ConnectionManager] Showing notification: ${title} - ${message} (${type})`);
        
        // Create container if not exists
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            document.body.appendChild(container);
        }
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-header">
                <div class="notification-title">${title}</div>
                <button class="notification-close">&times;</button>
            </div>
            <div class="notification-body">
                <p>${message}</p>
            </div>
        `;
        
        // Add to container
        container.appendChild(notification);
        
        // Add close handler
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.add('notification-hiding');
            setTimeout(() => notification.remove(), 300);
        });
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.add('notification-hiding');
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    },
    
    /**
     * Get a random color for player identification
     */
    getRandomColor: function() {
        // Generate vibrant colors that are easily distinguishable
        const hue = Math.floor(Math.random() * 360);
        return `hsl(${hue}, 70%, 60%)`;
    }
};