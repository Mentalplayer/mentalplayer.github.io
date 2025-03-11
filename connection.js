/**
 * ConnectionManager for MentalPlayer
 * Handles WebRTC peer-to-peer connections using PeerJS
 * 
 * @version 2.1.0
 */

const ConnectionManager = (() => {
    // Private properties
    let initialized = false;
    
    // Configuration options
    const config = {
        debug: true,
        connectionTimeout: 20000,   // 20 seconds timeout for connections
        heartbeatInterval: 5000,    // 5 seconds between heartbeats
        reconnectDelay: 2000,       // 2 seconds before reconnection attempts
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            }
        ]
    };
    
    // Connection state
    const state = {
        userId: '',
        userName: '',
        peer: null,            // PeerJS instance
        status: 'disconnected',
        roomId: '',
        isHost: false,
        activeConnections: {}, // Map of active connections by peerId
        peers: {},             // Map of peer information by peerId
        pendingOffers: {},     // Track pending connection offers
        gameState: null,       // Current game state for sharing
        heartbeatTimers: {},   // Map of heartbeat timers by peerId
        masterHeartbeatTimer: null, // Main heartbeat timer
        connectionAttempts: 0, // Counter for connection attempts
        onStateChangeCallback: null // Callback for state changes
    };
    
    // Debug message queue
    const debugMessages = [];
    
    /**
     * Log a debug message
     * @param {string} direction Message direction (SENT, RECEIVED)
     * @param {string} type Message type
     * @param {Object} content Message content
     */
    function logDebugMessage(direction, type, content) {
        if (!config.debug) return;
        
        const msg = {
            time: new Date().toLocaleTimeString(),
            direction, type, content
        };
        
        debugMessages.push(msg);
        if (debugMessages.length > 50) debugMessages.shift();
        
        // Log to console
        log(`${direction} ${type}: ${JSON.stringify(content)}`, 'debug');
        
        // Update display if available
        const debugContainer = document.getElementById('connection-debug');
        if (debugContainer) {
            const msgEl = document.createElement('div');
            msgEl.className = `debug-message ${direction.toLowerCase()}`;
            msgEl.innerText = `${msg.time} [${direction}] ${type}: ${JSON.stringify(content).slice(0, 100)}${content.length > 100 ? '...' : ''}`;
            debugContainer.prepend(msgEl);
            
            // Limit number of displayed messages
            if (debugContainer.children.length > 20) {
                debugContainer.removeChild(debugContainer.lastChild);
            }
        }
    }
    
    /**
     * Initialize the connection manager
     * @param {Object} options Options for initialization
     */
    function init(options = {}) {
        if (initialized) {
            log('Connection manager already initialized');
            return;
        }
        
        log('Initializing connection manager');
        
        // Apply options
        if (options.userId) {
            state.userId = options.userId;
        }
        
        if (options.userName) {
            state.userName = options.userName;
        }
        
        if (options.onStateChange && typeof options.onStateChange === 'function') {
            state.onStateChangeCallback = options.onStateChange;
        }
        
        if (options.debug !== undefined) {
            config.debug = !!options.debug;
        }
        
        // Initialize PeerJS
        initializePeer();
        
        // Create debug panel if in debug mode
        if (config.debug) {
            createDebugPanel();
        }
        
        // Set initialized flag
        initialized = true;
    }
    
    /**
     * Create debug panel for connection monitoring
     */
    function createDebugPanel() {
        if (document.getElementById('connection-debug-container')) return;
        
        const container = document.createElement('div');
        container.id = 'connection-debug-container';
        container.style.cssText = 'position:fixed; bottom:10px; right:10px; width:400px; background:rgba(0,0,0,0.7); color:white; font-family:monospace; font-size:11px; z-index:10000; border-radius:5px; max-height:300px; overflow:auto;';
        
        const header = document.createElement('div');
        header.style.cssText = 'padding:5px; background:rgba(0,0,0,0.5); display:flex; justify-content:space-between;';
        header.innerHTML = '<span>Connection Debug</span><span id="connection-debug-close" style="cursor:pointer;">×</span>';
        
        const content = document.createElement('div');
        content.id = 'connection-debug';
        content.style.cssText = 'padding:5px; max-height:250px; overflow-y:auto;';
        
        container.appendChild(header);
        container.appendChild(content);
        document.body.appendChild(container);
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .debug-message { margin-bottom: 3px; padding: 3px; border-radius: 3px; }
            .debug-message.sent { background: rgba(0, 100, 0, 0.3); }
            .debug-message.received { background: rgba(0, 0, 100, 0.3); }
        `;
        document.head.appendChild(style);
        
        // Add event listeners
        document.getElementById('connection-debug-close').addEventListener('click', () => {
            container.style.display = 'none';
        });
    }
    
    /**
     * Initialize the PeerJS instance
     */
    function initializePeer() {
        if (!window.Peer) {
            log('PeerJS library not found. Attempting to load it', 'error');
            
            // Try to load PeerJS dynamically
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/peerjs@1.4.7/dist/peerjs.min.js';
            script.onload = () => initializePeer();
            script.onerror = () => {
                log('Failed to load PeerJS library', 'error');
                updateStatus('error', 'Failed to load connection library');
            };
            
            document.head.appendChild(script);
            return;
        }
        
        try {
            // Create a Peer instance with the user ID
            state.peer = new Peer(state.userId, {
                config: {
                    iceServers: config.iceServers,
                    iceCandidatePoolSize: 10
                },
                debug: config.debug ? 2 : 0
            });
            
            // Set up event listeners for the peer
            setupPeerEventListeners();
        } catch (error) {
            log(`Error initializing PeerJS: ${error.message}`, 'error');
            updateStatus('error', 'Connection system initialization failed');
        }
    }
    
    /**
     * Set up event listeners for the PeerJS instance
     */
    function setupPeerEventListeners() {
        if (!state.peer) return;
        
        // When this peer is created and ready
        state.peer.on('open', id => {
            log(`Peer connection established with ID: ${id}`);
            state.userId = id;
            updateStatus('initialized', 'Ready to connect');
            
            // Notify state change
            notifyStateChange();
        });
        
        // When another peer tries to connect to us
        state.peer.on('connection', connection => {
            log(`Incoming connection from peer: ${connection.peer}`);
            
            // Only accept connections if we're hosting a room
            if (state.isHost) {
                handleIncomingConnection(connection);
            } else {
                log('Rejecting connection as we are not hosting a room', 'warning');
                connection.close();
            }
        });
        
        // Error handling
        state.peer.on('error', error => {
            log(`Peer error: ${error.type} - ${error.message}`, 'error');
            
            switch (error.type) {
                case 'peer-unavailable':
                    updateStatus('error', 'Room not found');
                    showConnectionError('The specified room could not be found. Please check the Room ID and try again.');
                    break;
                    
                case 'network':
                    updateStatus('error', 'Network error');
                    showConnectionError('Network error. Please check your internet connection and try again.');
                    break;
                    
                case 'server-error':
                    updateStatus('error', 'Server error');
                    showConnectionError('Server error. Please try again later.');
                    break;
                    
                case 'disconnected':
                    updateStatus('disconnected', 'Disconnected from signaling server');
                    
                    // Try to reconnect after a delay
                    setTimeout(() => {
                        if (state.peer) {
                            state.peer.reconnect();
                        }
                    }, config.reconnectDelay);
                    break;
                    
                default:
                    updateStatus('error', `Connection error: ${error.type}`);
                    showConnectionError('Connection error. Please try again.');
                    break;
            }
        });
        
        // When disconnected from the signaling server
        state.peer.on('disconnected', () => {
            log('Disconnected from signaling server');
            updateStatus('disconnected', 'Disconnected from signaling server');
            
            // Try to reconnect after a delay
            setTimeout(() => {
                if (state.peer) {
                    state.peer.reconnect();
                }
            }, config.reconnectDelay);
        });
        
        // When completely closed
        state.peer.on('close', () => {
            log('Peer connection closed');
            updateStatus('disconnected', 'Connection closed');
            
            // Clean up
            cleanup();
            
            // Try to reinitialize after a delay
            setTimeout(() => {
                initializePeer();
            }, config.reconnectDelay * 2);
        });
    }
    
    /**
     * Create a new room
     */
    function createRoom() {
        if (!initialized || !state.peer) {
            log('Cannot create room: Connection manager not initialized', 'error');
            return false;
        }
        
        if (state.status === 'connected') {
            log('Leaving current room before creating a new one');
            leaveRoom();
        }
        
        // Use our peer ID as the room ID
        state.roomId = state.userId;
        state.isHost = true;
        
        // Add ourselves to the peers list
        state.peers[state.userId] = {
            id: state.userId,
            name: state.userName,
            isHost: true,
            color: getColorForUser(state.userId)
        };
        
        log(`Created room with ID: ${state.roomId}`);
        
        // Update status
        updateStatus('connected', 'Room created');
        
        // Start heartbeat
        startHeartbeat();
        
        // Notify state change
        notifyStateChange();
        
        return true;
    }
    
    /**
     * Join an existing room
     * @param {string} roomId ID of the room to join
     */
    function joinRoom(roomId) {
        if (!initialized || !state.peer) {
            log('Cannot join room: Connection manager not initialized', 'error');
            return false;
        }
        
        if (!roomId) {
            log('Cannot join room: No room ID provided', 'error');
            return false;
        }
        
        if (roomId === state.userId) {
            log('Cannot join your own room', 'error');
            return false;
        }
        
        if (state.status === 'connected') {
            log('Leaving current room before joining a new one');
            leaveRoom();
        }
        
        log(`Joining room with ID: ${roomId}`);
        
        // Update state
        state.roomId = roomId;
        state.isHost = false;
        state.connectionAttempts = 0;
        
        // Add ourselves to the peers list
        state.peers[state.userId] = {
            id: state.userId,
            name: state.userName,
            isHost: false,
            color: getColorForUser(state.userId)
        };
        
        // Update status
        updateStatus('connecting', 'Connecting to room...');
        
        // Connect to the host peer
        return connectToPeer(roomId);
    }
    
    /**
     * Leave the current room
     */
    function leaveRoom() {
        log('Leaving room');
        
        // Close all active connections
        Object.keys(state.activeConnections).forEach(peerId => {
            const connection = state.activeConnections[peerId];
            if (connection) {
                connection.close();
            }
        });
        
        // Clear connections and peers
        state.activeConnections = {};
        state.peers = {};
        
        // Stop heartbeats
        stopHeartbeat();
        
        // Reset state
        state.roomId = '';
        state.isHost = false;
        
        // Update status
        updateStatus('disconnected', 'Left room');
        
        // Notify state change
        notifyStateChange();
    }
    
    /**
     * Connect to a specific peer
     * @param {string} peerId ID of the peer to connect to
     * @returns {boolean} Success status
     */
    function connectToPeer(peerId) {
        if (!state.peer) return false;
        
        try {
            // Increment connection attempts
            state.connectionAttempts++;
            
            // Create connection
            const connection = state.peer.connect(peerId, {
                reliable: true,
                serialization: 'json'
            });
            
            if (!connection) {
                throw new Error('Failed to create connection');
            }
            
            // Set up connection timeout
            const timeoutId = setTimeout(() => {
                if (state.pendingOffers[peerId]) {
                    log(`Connection to peer ${peerId} timed out`, 'error');
                    delete state.pendingOffers[peerId];
                    
                    // Try again if under max attempts
                    if (state.connectionAttempts < 3) {
                        log(`Retrying connection to peer ${peerId} (attempt ${state.connectionAttempts + 1}/3)`);
                        connectToPeer(peerId);
                    } else {
                        log('Max connection attempts reached', 'error');
                        updateStatus('error', 'Connection failed');
                        showConnectionError('Could not connect to the room after multiple attempts. The host may be offline or behind a firewall.');
                    }
                }
            }, config.connectionTimeout);
            
            // Track this offer
            state.pendingOffers[peerId] = {
                connection,
                timeoutId
            };
            
            // Set up connection event handlers
            setupConnectionEventListeners(connection);
            
            return true;
        } catch (error) {
            log(`Error connecting to peer ${peerId}: ${error.message}`, 'error');
            updateStatus('error', 'Connection failed');
            return false;
        }
    }
    
    /**
     * Handle an incoming connection from another peer
     * @param {Object} connection PeerJS connection object
     */
    function handleIncomingConnection(connection) {
        const peerId = connection.peer;
        
        log(`Processing incoming connection from peer: ${peerId}`);
        
        // Set up connection event handlers
        setupConnectionEventListeners(connection);
        
        // When the connection is open, we'll set up the peer in our system
        connection.on('open', () => {
            log(`Connection fully established with peer: ${peerId}`);
            
            // Add to active connections
            state.activeConnections[peerId] = connection;
            
            // If we're the host, send a welcome message and current state
            if (state.isHost) {
                log(`Sending welcome data to peer: ${peerId}`);
                
                // First add ourselves to the peer list if not already there
                if (!state.peers[state.userId]) {
                    state.peers[state.userId] = {
                        id: state.userId,
                        name: state.userName,
                        isHost: true,
                        color: getColorForUser(state.userId)
                    };
                }
                
                // Send the complete peer list to the new peer
                sendToPeer(peerId, {
                    type: 'peer_list',
                    peers: state.peers
                });
                
                // Notify all other peers about the new connection
                broadcastToPeers({
                    type: 'peer_joined',
                    peerId: peerId,
                    userName: state.peers[peerId] ? state.peers[peerId].name : 'Unknown User'
                }, [peerId]); // Exclude the new peer from this broadcast
                
                // If we have a current game state, send it after a short delay
                // to ensure the peer has processed previous messages
                setTimeout(() => {
                    if (state.gameState) {
                        log(`Sending current game state to peer: ${peerId}`);
                        sendToPeer(peerId, {
                            type: 'game_state',
                            state: state.gameState
                        });
                    }
                    
                    // Also ask the active game to send its state if available
                    if (window.MentalPlayer && 
                        window.MentalPlayer.activeGame && 
                        window.MentalPlayer.activeGame.instance && 
                        typeof window.MentalPlayer.activeGame.instance.sendGameState === 'function') {
                        log(`Requesting game module to send state to peer: ${peerId}`);
                        window.MentalPlayer.activeGame.instance.sendGameState();
                    }
                }, 1000); // Short delay for connection stabilization
                
                // Add welcome message to chat
                if (window.MentalPlayer && window.MentalPlayer.addChatMessage) {
                    const peerName = state.peers[peerId] ? state.peers[peerId].name : 'New player';
                    window.MentalPlayer.addChatMessage('system', '', `${peerName} has joined the room.`);
                }
            }
            
            // Start heartbeat for this connection
            startPeerHeartbeat(peerId);
        });
        
        // Handle errors specifically for this connection
        connection.on('error', (err) => {
            log(`Error with peer ${peerId} connection: ${err.message}`, 'error');
            // If this is a critical connection (e.g., host for non-host peer), handle accordingly
            if (!state.isHost && peerId === state.roomId) {
                updateStatus('error', 'Lost connection to host');
                // Show notification
                if (window.MentalPlayer && window.MentalPlayer.showNotification) {
                    window.MentalPlayer.showNotification(
                        'Connection Error',
                        'Lost connection to the game host. You may need to rejoin the room.',
                        'error'
                    );
                }
            }
        });
    }
    
    /**
     * Set up event listeners for a peer connection
     * @param {Object} connection PeerJS connection object
     */
    function setupConnectionEventListeners(connection) {
        const peerId = connection.peer;
        
        // When the connection is established
        connection.on('open', () => {
            log(`Connection opened with peer: ${peerId}`);
            
            // Clear timeout if this was from our offer
            if (state.pendingOffers[peerId]) {
                clearTimeout(state.pendingOffers[peerId].timeoutId);
                delete state.pendingOffers[peerId];
            }
            
            // Add to active connections
            state.activeConnections[peerId] = connection;
            
            // Update status
            updateStatus('connected', 'Connected to room');
            
            // Send our information to the peer
            sendToPeer(peerId, {
                type: 'peer_info',
                userId: state.userId,
                userName: state.userName,
                isHost: state.isHost,
                color: getColorForUser(state.userId)
            });
            
            // If we're the host, update internal host information first
            if (state.isHost && !state.peers[state.userId]) {
                // Add ourselves to the peer list
                state.peers[state.userId] = {
                    id: state.userId,
                    name: state.userName,
                    isHost: true,
                    color: getColorForUser(state.userId)
                };
                
                // Notify state change for local UI updates
                notifyStateChange();
            }
            
            // If we're the host, send the current peer list to the new peer
            if (state.isHost) {
                // Send the complete peer list after a short delay
                // to ensure the peer's peer_info is processed first
                setTimeout(() => {
                    sendToPeer(peerId, {
                        type: 'peer_list',
                        peers: state.peers
                    });
                    
                    // Notify all peers about the new connection
                    broadcastToPeers({
                        type: 'peer_joined',
                        peerId: peerId,
                        userName: state.peers[peerId] ? state.peers[peerId].name : 'Unknown User'
                    }, [peerId]); // Exclude the new peer from this broadcast
                    
                    // Send current game state if available
                    if (state.gameState) {
                        sendToPeer(peerId, {
                            type: 'game_state',
                            state: state.gameState
                        });
                    }
                    
                    // Request the active game to send its state
                    if (window.MentalPlayer && 
                        window.MentalPlayer.activeGame && 
                        window.MentalPlayer.activeGame.instance && 
                        typeof window.MentalPlayer.activeGame.instance.sendGameState === 'function') {
                        window.MentalPlayer.activeGame.instance.sendGameState();
                    }
                }, 500); // Short delay
            }
            
            // Start heartbeat for this connection
            startPeerHeartbeat(peerId);
            
            // Notify state change
            notifyStateChange();
        });
        
        // When data is received
        connection.on('data', data => {
            handlePeerMessage(peerId, data);
        });
        
        // When the connection is closed
        connection.on('close', () => {
            log(`Connection closed with peer: ${peerId}`);
            
            // Remove from active connections
            delete state.activeConnections[peerId];
            
            // Stop heartbeat for this peer
            stopPeerHeartbeat(peerId);
            
            // If we were connected to the host and we're not the host, we've been disconnected from the room
            if (!state.isHost && peerId === state.roomId) {
                updateStatus('disconnected', 'Disconnected from room');
                
                // Reset room state
                state.roomId = '';
                state.peers = {};
                
                // Notify state change
                notifyStateChange();
                
                // Show notification
                if (window.MentalPlayer && window.MentalPlayer.showNotification) {
                    window.MentalPlayer.showNotification(
                        'Disconnected',
                        'You have been disconnected from the room.',
                        'warning'
                    );
                }
            } 
            // If we're the host, notify other peers about this disconnection
            else if (state.isHost) {
                const peerName = state.peers[peerId] ? state.peers[peerId].name : 'Unknown User';
                
                // Remove from peers list
                delete state.peers[peerId];
                
                // Notify other peers
                broadcastToPeers({
                    type: 'peer_left',
                    peerId: peerId,
                    userName: peerName
                });
                
                // Add system message to chat
                if (window.MentalPlayer && window.MentalPlayer.addChatMessage) {
                    window.MentalPlayer.addChatMessage('system', '', `${peerName} has left the room.`);
                }
                
                // Notify state change
                notifyStateChange();
            }
        });
        
        // When an error occurs
        connection.on('error', error => {
            log(`Connection error with peer ${peerId}: ${error.message}`, 'error');
            
            // Handle specific errors
            if (error.type === 'peer-unavailable') {
                updateStatus('error', 'Peer unavailable');
                showConnectionError('The specified room could not be found. Please check the Room ID and try again.');
            } else {
                updateStatus('error', 'Connection error');
            }
        });
    }
    
    /**
     * Handle a message from a peer
     * @param {string} peerId ID of the sending peer
     * @param {Object} data Message data
     */
    function handlePeerMessage(peerId, data) {
        if (!data || !data.type) return;
        
        // Skip logging heartbeat messages to avoid noise
        if (data.type !== 'heartbeat' && data.type !== 'heartbeat_ack') {
            logDebugMessage('RECEIVED', data.type, data);
        }
        
        switch (data.type) {
            case 'peer_info':
                // Store peer information but prevent duplicates if it's the host
                if (peerId !== state.userId) {
                    // Only update for non-self peers
                    state.peers[peerId] = {
                        id: peerId,
                        name: data.userName || 'Unknown User',
                        isHost: data.isHost || false,
                        color: data.color || getColorForUser(peerId)
                    };
                    
                    // Notify state change
                    notifyStateChange();
                    
                    // Add system message to chat if this is a new connection
                    if (window.MentalPlayer && window.MentalPlayer.addChatMessage) {
                        window.MentalPlayer.addChatMessage('system', '', `${state.peers[peerId].name} has joined the room.`);
                    }
                }
                break;
                
            case 'peer_list':
                // Update our peer list with the received list, but preserve our own entry
                if (data.peers && typeof data.peers === 'object') {
                    // Keep our own info
                    const selfInfo = state.peers[state.userId];
                    
                    // Update peer list
                    state.peers = data.peers;
                    
                    // Make sure we don't override our own entry
                    if (selfInfo) {
                        state.peers[state.userId] = selfInfo;
                    }
                    
                    // Notify state change
                    notifyStateChange();
                }
                break;
                
            case 'peer_joined':
                // Show notification that a new peer joined (for non-host peers)
                if (window.MentalPlayer && window.MentalPlayer.addChatMessage) {
                    window.MentalPlayer.addChatMessage('system', '', `${data.userName || 'A new user'} has joined the room.`);
                }
                break;
                
            case 'peer_left':
                // Show notification that a peer left (for non-host peers)
                if (window.MentalPlayer && window.MentalPlayer.addChatMessage) {
                    window.MentalPlayer.addChatMessage('system', '', `${data.userName || 'A user'} has left the room.`);
                }
                
                // Remove from our peer list
                if (data.peerId && state.peers[data.peerId]) {
                    delete state.peers[data.peerId];
                    
                    // Notify state change
                    notifyStateChange();
                }
                break;
                
            case 'chat_message':
                // Determine the actual sender ID (from data.peerId if forwarded, or from the direct sender)
                const senderId = data.peerId || peerId;
                const senderName = state.peers[senderId] ? 
                                 state.peers[senderId].name : 'Unknown User';
                
                // Handle chat message
                if (data.message && window.MentalPlayer && window.MentalPlayer.addChatMessage) {
                    window.MentalPlayer.addChatMessage(senderId, senderName, data.message);
                }
                
                // If we're the host, forward the message to all other peers
                if (state.isHost) {
                    // Make sure we're preserving the original sender ID
                    broadcastToPeers({
                        type: 'chat_message',
                        peerId: senderId, // Important: Include original sender ID
                        message: data.message
                    }, [peerId]); // Exclude the sender
                }
                break;
                
            case 'game_switch':
                // Handle game switch request
                if (data.gameId && window.MentalPlayer && window.MentalPlayer.loadGame) {
                    window.MentalPlayer.loadGame(data.gameId);
                }
                break;
                
            case 'game_state':
                // Update our game state
                state.gameState = data.state;
                break;
                
            case 'game_data':
                // Forward game-specific data to the game module
                if (window.MentalPlayer && window.MentalPlayer.handleGameMessage) {
                    window.MentalPlayer.handleGameMessage(peerId, data);
                }
                
                // If we're the host, forward the message to all other peers
                if (state.isHost) {
                    // Preserve the entire message structure and add original sender info
                    broadcastToPeers({
                        ...data,
                        originalSender: peerId // Add original sender ID
                    }, [peerId]); // Exclude the sender
                }
                break;
                
            case 'heartbeat':
                // Respond to heartbeat with an acknowledgment
                sendToPeer(peerId, {
                    type: 'heartbeat_ack',
                    timestamp: data.timestamp
                });
                break;
                
            case 'heartbeat_ack':
                // Calculate ping
                const ping = Date.now() - data.timestamp;
                
                // Update ping display if needed
                const pingDisplay = document.getElementById('ping-value');
                if (pingDisplay) {
                    pingDisplay.textContent = ping;
                }
                break;
        }
    }
    
    /**
     * Send data to a specific peer
     * @param {string} peerId ID of the receiving peer
     * @param {Object} data Data to send
     * @returns {boolean} Success status
     */
    function sendToPeer(peerId, data) {
        const connection = state.activeConnections[peerId];
        if (!connection || !connection.open) {
            log(`Cannot send to peer ${peerId}: Connection not open`, 'warning');
            return false;
        }
        
        try {
            // Log all non-heartbeat messages
            if (data.type !== 'heartbeat' && data.type !== 'heartbeat_ack') {
                logDebugMessage('SENT', data.type, data);
            }
            
            connection.send(data);
            return true;
        } catch (error) {
            log(`Error sending to peer ${peerId}: ${error.message}`, 'error');
            return false;
        }
    }
    
    /**
     * Broadcast data to all connected peers
     * @param {Object} data Data to broadcast
     * @param {Array<string>} excludePeerIds Array of peer IDs to exclude
     * @returns {number} Number of peers data was sent to
     */
    function broadcastToPeers(data, excludePeerIds = []) {
        let sentCount = 0;
        
        // Log detail about what's being broadcast (for debugging)
        if (data.type !== 'heartbeat' && data.type !== 'heartbeat_ack') {
            log(`Broadcasting ${data.type} to peers (excluding ${excludePeerIds.length} peers)`, 'debug');
        }
        
        Object.keys(state.activeConnections).forEach(peerId => {
            // Skip excluded peers
            if (excludePeerIds.includes(peerId)) {
                return;
            }
            
            if (sendToPeer(peerId, data)) {
                sentCount++;
            }
        });
        
        if (data.type !== 'heartbeat' && data.type !== 'heartbeat_ack') {
            log(`Broadcast completed. Sent to ${sentCount} peers.`, 'debug');
        }
        
        return sentCount;
    }
    
    /**
     * Send data to all connected peers
     * @param {Object} data Data to send
     * @returns {boolean} Success status (true if sent to at least one peer)
     */
    function sendData(data) {
        if (!initialized) {
            log('Cannot send data: Connection manager not initialized', 'error');
            return false;
        }
        
        // Add sender ID to any outgoing message
        const messageWithSender = {
            ...data,
            senderId: state.userId
        };
        
        // If we're the host, broadcast to all peers
        if (state.isHost) {
            return broadcastToPeers(messageWithSender) > 0;
        }
        // Otherwise, send to the host
        else if (state.roomId) {
            return sendToPeer(state.roomId, messageWithSender);
        }
        
        return false;
    }
    
    /**
     * Update connection status
     * @param {string} status New status
     * @param {string} message Status message
     */
    function updateStatus(status, message) {
        log(`Status: ${status} - ${message}`);
        
        // Update state
        state.status = status;
        
        // Notify state change
        notifyStateChange();
    }
    
    /**
     * Show connection error modal
     * @param {string} message Error message
     */
    function showConnectionError(message) {
        const modal = document.getElementById('connection-error-modal');
        const messageElement = document.getElementById('connection-error-message');
        
        if (modal && messageElement) {
            messageElement.textContent = message;
            modal.style.display = 'flex';
            
            // Add retry handler
            const retryButton = document.getElementById('retry-connection-button');
            if (retryButton) {
                // Remove existing listeners
                const newRetryButton = retryButton.cloneNode(true);
                retryButton.parentNode.replaceChild(newRetryButton, retryButton);
                
                // Add new listener
                newRetryButton.addEventListener('click', () => {
                    modal.style.display = 'none';
                    
                    // Try to join the room again
                    if (state.roomId) {
                        joinRoom(state.roomId);
                    }
                });
            }
        }
    }
    
    /**
     * Start heartbeat to monitor connections
     */
    function startHeartbeat() {
        // Stop any existing heartbeat
        stopHeartbeat();
        
        // Start master heartbeat timer
        state.masterHeartbeatTimer = setInterval(() => {
            // Send heartbeat to all connected peers
            Object.keys(state.activeConnections).forEach(peerId => {
                sendToPeer(peerId, {
                    type: 'heartbeat',
                    timestamp: Date.now()
                });
            });
        }, config.heartbeatInterval);
    }
    
    /**
     * Start heartbeat for a specific peer
     * @param {string} peerId ID of the peer
     */
    function startPeerHeartbeat(peerId) {
        // Stop any existing heartbeat for this peer
        stopPeerHeartbeat(peerId);
        
        // Start heartbeat timer
        state.heartbeatTimers[peerId] = setInterval(() => {
            sendToPeer(peerId, {
                type: 'heartbeat',
                timestamp: Date.now()
            });
        }, config.heartbeatInterval);
    }
    
    /**
     * Stop heartbeat for a specific peer
     * @param {string} peerId ID of the peer
     */
    function stopPeerHeartbeat(peerId) {
        if (state.heartbeatTimers[peerId]) {
            clearInterval(state.heartbeatTimers[peerId]);
            delete state.heartbeatTimers[peerId];
        }
    }
    
    /**
     * Stop all heartbeats
     */
    function stopHeartbeat() {
        // Clear master heartbeat timer
        if (state.masterHeartbeatTimer) {
            clearInterval(state.masterHeartbeatTimer);
            state.masterHeartbeatTimer = null;
        }
        
        // Clear all peer heartbeat timers
        Object.keys(state.heartbeatTimers).forEach(peerId => {
            clearInterval(state.heartbeatTimers[peerId]);
        });
        
        state.heartbeatTimers = {};
    }
    
    /**
     * Notify core of state changes
     */
    function notifyStateChange() {
        if (state.onStateChangeCallback && typeof state.onStateChangeCallback === 'function') {
            state.onStateChangeCallback({
                status: state.status,
                roomId: state.roomId,
                isHost: state.isHost,
                peers: {...state.peers}
            });
        }
    }
    
    /**
     * Update user information
     * @param {Object} userInfo User info to update
     */
    function updateUserInfo(userInfo) {
        if (userInfo.userName) {
            state.userName = userInfo.userName;
        }
        
        // Send update to all connected peers
        if (state.status === 'connected') {
            sendData({
                type: 'peer_info',
                userId: state.userId,
                userName: state.userName,
                isHost: state.isHost,
                color: getColorForUser(state.userId)
            });
        }
    }
    
    /**
     * Set the current game state for sharing with new peers
     * @param {Object} gameState Game state to share
     */
    function setGameState(gameState) {
        state.gameState = gameState;
    }
    
    /**
     * Generate a consistent color for a user based on their ID
     * @param {string} userId User ID
     * @returns {string} Color in HSL format
     */
    function getColorForUser(userId) {
        // Generate a hash of the user ID
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = ((hash << 5) - hash) + userId.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        
        // Use the hash to generate a consistent hue (0-360)
        const hue = Math.abs(hash % 360);
        
        return `hsl(${hue}, 70%, 60%)`;
    }
    
    /**
     * Get color for a peer
     * @param {string} peerId Peer ID
     * @returns {string} Color string or null if peer not found
     */
    function getPeerColor(peerId) {
        if (state.peers[peerId]) {
            return state.peers[peerId].color;
        }
        return null;
    }
    
    /**
     * Get color for self
     * @returns {string} Color string
     */
    function getSelfColor() {
        return getColorForUser(state.userId);
    }
    
    /**
     * Clean up resources
     */
    function cleanup() {
        // Stop all heartbeats
        stopHeartbeat();
        
        // Close all connections
        Object.keys(state.activeConnections).forEach(peerId => {
            const connection = state.activeConnections[peerId];
            if (connection) {
                connection.close();
            }
        });
        
        // Clear state
        state.activeConnections = {};
        state.peers = {};
        state.pendingOffers = {};
        state.roomId = '';
        state.isHost = false;
        state.status = 'disconnected';
        
        // Close peer if exists
        if (state.peer) {
            state.peer.destroy();
            state.peer = null;
        }
    }
    
    /**
     * Logging function with levels
     * @param {string} message Message to log
     * @param {string} level Log level (debug, info, warning, error)
     */
    function log(message, level = 'info') {
        if (!config.debug && level === 'debug') return;
        
        const prefix = '[ConnectionManager]';
        
        switch (level) {
            case 'error':
                console.error(`${prefix} ${message}`);
                break;
            case 'warning':
                console.warn(`${prefix} ${message}`);
                break;
            case 'debug':
                console.debug(`${prefix} ${message}`);
                break;
            default:
                console.log(`${prefix} ${message}`);
                break;
        }
    }
    
    // Public API
    return {
        init,
        createRoom,
        joinRoom,
        leaveRoom,
        sendData,
        updateUserInfo,
        setGameState,
        getPeerColor,
        getSelfColor,
        
        // Add additional utility methods as needed
        get state() {
            return {
                status: state.status,
                roomId: state.roomId,
                isHost: state.isHost,
                userId: state.userId,
                userName: state.userName,
            };
        },
        
        // Expose debug messages queue
        get debugMessages() {
            return [...debugMessages];
        }
    };
})();

// Make ConnectionManager available globally
window.ConnectionManager = ConnectionManager;