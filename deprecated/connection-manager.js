/**
 * Simplified Connection Manager for Mentalplayer
 * Uses PeerJS for WebRTC signaling and connection management
 */

class ConnectionManager {
    constructor() {
        // Configuration
        this.config = {
            debug: 2, // Log level (0: errors, 1: warnings, 2: all)
            heartbeatInterval: 5000, // ms between connection checks
        };

        // State
        this.state = {
            initialized: false,
            connected: false,
            connecting: false,
            roomId: '',
            isRoomCreator: false,
            peer: null,
            connection: null,
            playerId: '',
            playerName: '',
            players: {},
            gameModule: null
        };

        // DOM element references 
        this.elements = {
            connectionStatus: document.getElementById('connection-status'),
            roomInfo: document.getElementById('room-info'),
            currentRoomId: document.getElementById('current-room-id'),
            playersContainer: document.getElementById('players-container')
        };

        // Heartbeat timer
        this.heartbeatTimer = null;

        // Bind methods to preserve 'this' context
        this.init = this.init.bind(this);
        this.createRoom = this.createRoom.bind(this);
        this.joinRoom = this.joinRoom.bind(this);
        this.leaveRoom = this.leaveRoom.bind(this);
        this.sendData = this.sendData.bind(this);
        this._setupConnectionListeners = this._setupConnectionListeners.bind(this);
        this._handleConnectionOpen = this._handleConnectionOpen.bind(this);
        this._handleConnectionClose = this._handleConnectionClose.bind(this);
        this._handleConnectionError = this._handleConnectionError.bind(this);
        this._handleConnectionData = this._handleConnectionData.bind(this);
    }

    /**
     * Initialize the connection manager
     * @param {Object} options Configuration options
     * @returns {string} Player ID
     */
    init(options = {}) {
        this.log('Initializing Connection Manager');

        // Load options
        if (options.playerName) {
            this.state.playerName = options.playerName;
        } else if (localStorage.getItem('playerName')) {
            this.state.playerName = localStorage.getItem('playerName');
        } else {
            this.state.playerName = 'Player';
        }

        // Load PeerJS library if not already loaded
        if (typeof Peer === 'undefined') {
            this.log('PeerJS not loaded, loading now...', 1);
            this._loadPeerJS()
                .then(() => this._initializePeer())
                .catch(err => {
                    this.showNotification('Error', 'Failed to load connection library. Please refresh the page.', 'error');
                    this.log('Failed to load PeerJS: ' + err, 0);
                });
        } else {
            this._initializePeer();
        }

        return this.state.playerId;
    }

    /**
     * Create a new room as room creator
     */
    createRoom() {
        if (!this.state.initialized) {
            this.showNotification('Not Ready', 'Connection system is still initializing, please try again in a moment.', 'warning');
            return;
        }

        if (this.state.connected) {
            this.leaveRoom();
        }

        this.state.isRoomCreator = true;
        this.state.roomId = this.state.playerId;
        
        this.updateStatus('connected', 'Room created');
        this.updateRoomInfo();
        
        // Update players list with local player
        this.state.players[this.state.playerId] = {
            id: this.state.playerId,
            name: this.state.playerName,
            color: this._getRandomColor(),
            isCreator: true
        };
        
        this.updatePlayersList();
        this.showNotification('Room Created', `Room ${this.state.roomId} created. Share the Room ID to invite others.`, 'success');
        
        // Start heartbeat
        this._startHeartbeat();
    }

    /**
     * Join an existing room with the given ID
     * @param {string} roomId Room ID to join
     */
    joinRoom(roomId) {
        if (!this.state.initialized) {
            this.showNotification('Not Ready', 'Connection system is still initializing, please try again in a moment.', 'warning');
            return;
        }

        if (!roomId) {
            this.showNotification('Error', 'Please enter a Room ID to join.', 'error');
            return;
        }

        if (roomId === this.state.playerId) {
            this.showNotification('Error', 'You cannot join your own room.', 'error');
            return;
        }

        if (this.state.connected) {
            this.leaveRoom();
        }

        this.log(`Joining room: ${roomId}`);
        this.state.roomId = roomId;
        this.state.isRoomCreator = false;
        this.state.connecting = true;
        
        this.updateStatus('connecting', 'Connecting to room...');

        try {
            // Connect to the peer (room creator)
            const conn = this.state.peer.connect(roomId, {
                reliable: true,
                serialization: 'json'
            });

            if (!conn) {
                throw new Error('Failed to create connection');
            }

            this.state.connection = conn;
            this._setupConnectionListeners(conn);

            // Update players list with local player
            this.state.players[this.state.playerId] = {
                id: this.state.playerId,
                name: this.state.playerName,
                color: this._getRandomColor(),
                isCreator: false
            };

            this.updateRoomInfo();
        } catch (error) {
            this.log('Error joining room: ' + error, 0);
            this.state.connecting = false;
            this.updateStatus('error', 'Failed to join room');
            this.showNotification('Connection Error', 'Failed to join room. Please check the Room ID and try again.', 'error');
        }
    }

    /**
     * Leave the current room
     */
    leaveRoom() {
        if (this.state.connection) {
            this.state.connection.close();
            this.state.connection = null;
        }

        // Close any connections to us if we're the host
        if (this.state.isRoomCreator && this.state.peer) {
            this.state.peer.disconnect();
            // Reconnect for future use
            this.state.peer.reconnect();
        }

        // Stop heartbeat
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }

        // Reset state
        this.state.connected = false;
        this.state.connecting = false;
        this.state.isRoomCreator = false;
        this.state.roomId = '';
        
        // Keep only self in players list
        const selfPlayer = this.state.players[this.state.playerId];
        this.state.players = {};
        if (selfPlayer) {
            this.state.players[this.state.playerId] = selfPlayer;
        }
        
        this.updateStatus('disconnected', 'Left room');
        this.updateRoomInfo();
        this.updatePlayersList();
        
        this.showNotification('Disconnected', 'You have left the room.', 'info');
    }

    /**
     * Send data to the connected peer(s)
     * @param {Object} data Data to send
     * @returns {boolean} Success status
     */
    sendData(data) {
        if (!data) return false;

        try {
            // Room creator sends to all connections
            if (this.state.isRoomCreator) {
                // If we're using PeerJS and have active connections
                if (this.state.peer && this.state.peer.connections) {
                    let sentCount = 0;
                    
                    // Iterate over all connections
                    Object.keys(this.state.peer.connections).forEach(peerId => {
                        const connections = this.state.peer.connections[peerId];
                        connections.forEach(conn => {
                            if (conn.open) {
                                conn.send({
                                    ...data,
                                    senderId: this.state.playerId
                                });
                                sentCount++;
                            }
                        });
                    });
                    
                    return sentCount > 0;
                }
                
                return false;
            } 
            // Non-creator sends only to the room creator
            else if (this.state.connection && this.state.connection.open) {
                this.state.connection.send({
                    ...data,
                    senderId: this.state.playerId
                });
                return true;
            }
            
            return false;
        } catch (error) {
            this.log('Error sending data: ' + error, 0);
            return false;
        }
    }

    /**
     * Update the connection status display
     * @param {string} status Status code
     * @param {string} message Status message
     */
    updateStatus(status, message) {
        this.log(`Status: ${status} - ${message}`);
        
        if (!this.elements.connectionStatus) return;
        
        // Update class
        this.elements.connectionStatus.className = 'connection-status ' + status;
        
        // Update text
        let displayText = status.charAt(0).toUpperCase() + status.slice(1);
        if (message) {
            displayText += ` <span class="status-details">(${message})</span>`;
        }
        
        this.elements.connectionStatus.innerHTML = displayText;
    }

    /**
     * Update room info display
     */
    updateRoomInfo() {
        if (!this.elements.roomInfo || !this.elements.currentRoomId) return;
        
        if (this.state.roomId) {
            this.elements.roomInfo.style.display = 'block';
            this.elements.currentRoomId.textContent = this.state.roomId;
        } else {
            this.elements.roomInfo.style.display = 'none';
        }
    }

    /**
     * Update players list display
     */
    updatePlayersList() {
        if (!this.elements.playersContainer) return;
        
        this.elements.playersContainer.innerHTML = '';
        
        Object.values(this.state.players).forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.classList.add('player');
            
            if (player.id === this.state.playerId) {
                playerElement.classList.add('current-player');
            }
            
            const colorIndicator = document.createElement('div');
            colorIndicator.classList.add('player-color');
            colorIndicator.style.backgroundColor = player.color;
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = player.name + (player.id === this.state.playerId ? ' (You)' : '');
            
            playerElement.appendChild(colorIndicator);
            playerElement.appendChild(nameSpan);
            
            this.elements.playersContainer.appendChild(playerElement);
        });
    }

    /**
     * Show notification
     * @param {string} title Notification title
     * @param {string} message Notification message
     * @param {string} type Notification type (info, success, warning, error)
     */
    showNotification(title, message, type = 'info') {
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
    }

    /**
     * Add a chat message to the chat display
     * @param {string} senderId Sender ID or 'system'
     * @param {string} text Message text
     */
    addChatMessage(senderId, text) {
        const isSystem = senderId === 'system';
        const chatMessages = document.getElementById('chat-messages');
        
        if (!chatMessages) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = isSystem ? 'system-message' : 
            (senderId === this.state.playerId ? 'chat-message own-message' : 'chat-message peer-message');
        
        let messageContent = '';
        
        // Add sender name for peer messages
        if (!isSystem && senderId !== this.state.playerId) {
            const senderName = this.state.players[senderId] ? this.state.players[senderId].name : 'Unknown Player';
            const senderColor = this.state.players[senderId] && this.state.players[senderId].color ? 
                this.state.players[senderId].color : '#808080';
                
            messageContent += `<div class="message-sender" style="color: ${senderColor}">${senderName}</div>`;
        }
        
        // Add message text
        messageContent += `<div class="message-text">${text}</div>`;
        
        messageElement.innerHTML = messageContent;
        chatMessages.appendChild(messageElement);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * Display diagnostic information
     * @returns {Object} Diagnostic information
     */
    diagnosticInfo() {
        const info = {
            initialized: this.state.initialized,
            connected: this.state.connected,
            connecting: this.state.connecting,
            roomId: this.state.roomId,
            isRoomCreator: this.state.isRoomCreator,
            playerId: this.state.playerId,
            playerCount: Object.keys(this.state.players).length,
            peerJsVersion: typeof Peer !== 'undefined' ? 'Loaded' : 'Not loaded',
            connectionState: this.state.connection ? 
                (this.state.connection.open ? 'Open' : 'Closed') : 'No connection',
            browserInfo: navigator.userAgent
        };
        
        this.log('Diagnostic info:', 2);
        this.log(info, 2);
        
        return info;
    }

    /* Private methods */

    /**
     * Load the PeerJS library
     * @returns {Promise} Promise that resolves when PeerJS is loaded
     */
    _loadPeerJS() {
        return new Promise((resolve, reject) => {
            if (typeof Peer !== 'undefined') {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/peerjs@1.4.7/dist/peerjs.min.js';
            script.async = true;
            
            script.onload = () => {
                this.log('PeerJS loaded successfully');
                resolve();
            };
            
            script.onerror = () => {
                reject(new Error('Failed to load PeerJS'));
            };
            
            document.head.appendChild(script);
        });
    }

    /**
     * Initialize the PeerJS instance
     */
    _initializePeer() {
        try {
            // Create a random ID if not specified
            const peerId = this._generateId();
            this.state.playerId = peerId;
            
            this.log(`Initializing PeerJS with ID: ${peerId}`);
            
            // Create the Peer object
            this.state.peer = new Peer(peerId, {
                debug: this.config.debug > 1 ? 2 : 0,
                config: {
                    'iceServers': [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        {
                            urls: 'turn:openrelay.metered.ca:80',
                            username: 'openrelayproject',
                            credential: 'openrelayproject'
                        }
                    ],
                    'iceCandidatePoolSize': 10
                }
            });
            
            // Set up peer event handlers
            this.state.peer.on('open', (id) => {
                this.log(`PeerJS connection opened with ID: ${id}`);
                this.state.initialized = true;
                this.state.playerId = id;
                
                // Add self to players list
                this.state.players[id] = {
                    id: id,
                    name: this.state.playerName,
                    color: this._getRandomColor(),
                    isCreator: false
                };
                
                this.updateStatus('initialized', 'Ready to connect');
                this.updatePlayersList();
            });
            
            this.state.peer.on('connection', (conn) => {
                this.log(`Incoming connection from: ${conn.peer}`);
                
                // Accept the connection if we're the room creator
                if (this.state.isRoomCreator) {
                    this._setupConnectionListeners(conn);
                } else {
                    this.log('Rejecting connection as we are not the room creator', 1);
                    conn.close();
                }
            });
            
            this.state.peer.on('error', (err) => {
                this.log('PeerJS error: ' + err, 0);
                
                if (err.type === 'peer-unavailable') {
                    this.showNotification('Connection Error', 'Could not find the specified room. Please check the Room ID and try again.', 'error');
                    this.state.connecting = false;
                    this.updateStatus('error', 'Room not found');
                } else {
                    this.showNotification('Connection Error', `${err.type}: ${err.message}`, 'error');
                    this.updateStatus('error', err.type);
                }
            });
            
            this.state.peer.on('disconnected', () => {
                this.log('PeerJS disconnected from signaling server');
                this.updateStatus('disconnected', 'Disconnected from signaling server');
                
                // Attempt to reconnect
                setTimeout(() => {
                    if (this.state.peer) {
                        this.log('Attempting to reconnect to signaling server');
                        this.state.peer.reconnect();
                    }
                }, 5000);
            });
            
            this.state.peer.on('close', () => {
                this.log('PeerJS connection closed');
                this.state.initialized = false;
                this.updateStatus('disconnected', 'Connection closed');
                this.leaveRoom();
            });
        } catch (error) {
            this.log('Error initializing peer: ' + error, 0);
            this.updateStatus('error', 'Failed to initialize');
            this.showNotification('Initialization Error', 'Failed to initialize connection system. Please refresh the page.', 'error');
        }
    }

    /**
     * Set up listeners for a peer connection
     * @param {Object} conn PeerJS connection object
     */
    _setupConnectionListeners(conn) {
        conn.on('open', () => {
            this._handleConnectionOpen(conn);
        });
        
        conn.on('data', (data) => {
            this._handleConnectionData(conn, data);
        });
        
        conn.on('close', () => {
            this._handleConnectionClose(conn);
        });
        
        conn.on('error', (err) => {
            this._handleConnectionError(conn, err);
        });
    }

    /**
     * Handle connection open event
     * @param {Object} conn PeerJS connection object
     */
    _handleConnectionOpen(conn) {
        this.log(`Connection opened with peer: ${conn.peer}`);
        this.state.connected = true;
        this.state.connecting = false;
        
        // If we're not the room creator, store the connection
        if (!this.state.isRoomCreator) {
            this.state.connection = conn;
        }
        
        this.updateStatus('connected', 'Connected');
        
        // Send player info
        conn.send({
            type: 'player_info',
            senderId: this.state.playerId,
            name: this.state.playerName,
            color: this.state.players[this.state.playerId].color,
            gameType: this.state.gameModule ? this.state.gameModule.type : null
        });
        
        // If we're the room creator, send current players list to the new peer
        if (this.state.isRoomCreator) {
            conn.send({
                type: 'players_list',
                senderId: this.state.playerId,
                players: this.state.players
            });
            
            // Also send game state if we have a game module
            if (this.state.gameModule && typeof this.state.gameModule.sendGameState === 'function') {
                setTimeout(() => {
                    this.log('Sending game state to new peer');
                    this.state.gameModule.sendGameState(this);
                }, 1000);
            }
        }
        
        // Start heartbeat if we're the room creator
        if (this.state.isRoomCreator && !this.heartbeatTimer) {
            this._startHeartbeat();
        }
    }

    /**
     * Handle connection data event
     * @param {Object} conn PeerJS connection object
     * @param {Object} data Data received
     */
    _handleConnectionData(conn, data) {
        if (!data || !data.type || !data.senderId) return;
        
        // Don't log ping/pong messages to avoid console noise
        if (data.type !== 'ping' && data.type !== 'pong') {
            this.log(`Received data from ${conn.peer}:`, 2);
            this.log(data, 2);
        }
        
        switch (data.type) {
            case 'player_info':
                // Add player to list
                this.state.players[data.senderId] = {
                    id: data.senderId,
                    name: data.name,
                    color: data.color || this._getRandomColor(),
                    isCreator: this.state.isRoomCreator ? false : true
                };
                
                this.updatePlayersList();
                this.showNotification('Player Joined', `${data.name} has joined the game.`, 'info');
                this.addChatMessage('system', `${data.name} has joined the room.`);
                
                // If we're the room creator and they specified a game type, switch to it
                if (this.state.isRoomCreator && data.gameType && 
                    this.state.gameModule && this.state.gameModule.type !== data.gameType &&
                    typeof selectGame === 'function') {
                    selectGame(data.gameType, false);
                }
                break;
                
            case 'players_list':
                // Update our players list with the server's version
                if (!this.state.isRoomCreator && data.players) {
                    // Keep our own player info
                    const ourPlayer = this.state.players[this.state.playerId];
                    this.state.players = data.players;
                    if (ourPlayer) {
                        this.state.players[this.state.playerId] = ourPlayer;
                    }
                    
                    this.updatePlayersList();
                }
                break;
                
            case 'chat_message':
                this.addChatMessage(data.senderId, data.message);
                break;
                
            case 'ping':
                // Auto-respond to pings
                conn.send({
                    type: 'pong',
                    senderId: this.state.playerId,
                    timestamp: data.timestamp
                });
                break;
                
            case 'pong':
                // Process pong response if needed
                break;
                
            default:
                // Pass game-specific messages to the game module
                if (this.state.gameModule && typeof this.state.gameModule.handlePeerMessage === 'function') {
                    this.state.gameModule.handlePeerMessage(data.senderId, data);
                } 
                // Or pass to app's handler if available
                else if (typeof handlePeerMessage === 'function') {
                    handlePeerMessage(data.senderId, data);
                }
                // Or pass to AppState if available
                else if (typeof AppState !== 'undefined' && 
                         AppState.gameModules && 
                         AppState.currentGame && 
                         AppState.gameModules[AppState.currentGame] &&
                         typeof AppState.gameModules[AppState.currentGame].handlePeerMessage === 'function') {
                    AppState.gameModules[AppState.currentGame].handlePeerMessage(data.senderId, data);
                }
                break;
        }
        
        // Forward message to other peers if we're the room creator
        if (this.state.isRoomCreator && data.senderId !== this.state.playerId) {
            this._forwardMessageToOtherPeers(data, conn.peer);
        }
    }

    /**
     * Handle connection close event
     * @param {Object} conn PeerJS connection object
     */
    _handleConnectionClose(conn) {
        this.log(`Connection closed with peer: ${conn.peer}`);
        
        if (!this.state.isRoomCreator) {
            this.state.connected = false;
            this.state.connection = null;
            this.updateStatus('disconnected', 'Disconnected from host');
            this.showNotification('Disconnected', 'You have been disconnected from the room.', 'warning');
        } else {
            // Find disconnected player and remove them
            const disconnectedPlayerId = conn.peer;
            const playerName = this.state.players[disconnectedPlayerId]?.name || 'Unknown Player';
            
            if (this.state.players[disconnectedPlayerId]) {
                delete this.state.players[disconnectedPlayerId];
                this.updatePlayersList();
                this.addChatMessage('system', `${playerName} has left the room.`);
                this.showNotification('Player Left', `${playerName} has left the game.`, 'info');
            }
        }
    }

    /**
     * Handle connection error event
     * @param {Object} conn PeerJS connection object
     * @param {Error} err Error object
     */
    _handleConnectionError(conn, err) {
        this.log(`Connection error with peer ${conn.peer}: ${err}`, 0);
        
        if (!this.state.isRoomCreator) {
            this.updateStatus('error', 'Connection error');
            this.showNotification('Connection Error', 'There was an error with the connection. You may need to rejoin the room.', 'error');
        }
    }

    /**
     * Forward a message to all peers except the sender and specified exclusions
     * @param {Object} data Message data
     * @param {string} excludePeerId Peer ID to exclude
     */
    _forwardMessageToOtherPeers(data, excludePeerId) {
        if (!this.state.isRoomCreator || !this.state.peer || !this.state.peer.connections) {
            return;
        }
        
        // Skip certain message types that should not be forwarded
        if (['ping', 'pong'].includes(data.type)) {
            return;
        }
        
        // Forward to all other peers
        Object.keys(this.state.peer.connections).forEach(peerId => {
            // Skip the sender and any explicitly excluded peers
            if (peerId === excludePeerId) {
                return;
            }
            
            const connections = this.state.peer.connections[peerId];
            connections.forEach(conn => {
                if (conn.open) {
                    conn.send(data);
                }
            });
        });
    }

    /**
     * Start heartbeat to check connections
     */
    _startHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
        
        this.heartbeatTimer = setInterval(() => {
            // Send ping to all connections to check if they're still alive
            if (this.state.isRoomCreator && this.state.peer && this.state.peer.connections) {
                Object.keys(this.state.peer.connections).forEach(peerId => {
                    const connections = this.state.peer.connections[peerId];
                    connections.forEach(conn => {
                        if (conn.open) {
                            conn.send({
                                type: 'ping',
                                senderId: this.state.playerId,
                                timestamp: Date.now()
                            });
                        }
                    });
                });
            } 
            // Send ping to room creator if we're a client
            else if (!this.state.isRoomCreator && this.state.connection && this.state.connection.open) {
                this.state.connection.send({
                    type: 'ping',
                    senderId: this.state.playerId,
                    timestamp: Date.now()
                });
            }
        }, this.config.heartbeatInterval);
    }

    /**
     * Generate a random ID
     * @returns {string} Random ID
     */
    _generateId() {
        return Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    /**
     * Get a random color for player identification
     * @returns {string} Random color in HSL format
     */
    _getRandomColor() {
        const hue = Math.floor(Math.random() * 360);
        return `hsl(${hue}, 70%, 60%)`;
    }

    /**
     * Log a message with the specified level
     * @param {string|Object} message Message to log
     * @param {number} level Log level (0: errors, 1: warnings, 2: all)
     */
    log(message, level = 2) {
        if (level <= this.config.debug) {
            const prefix = '[ConnectionManager]';
            if (typeof message === 'string') {
                console.log(`${prefix} ${message}`);
            } else {
                console.log(`${prefix} Object:`, message);
            }
        }
    }
}

// Create a single instance
window.ConnectionManager = new ConnectionManager();