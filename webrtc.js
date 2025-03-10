/**
 * SimpleWebRTC - A streamlined WebRTC implementation for Mentalplayer
 * This provides a reliable peer-to-peer connection with manual signaling
 */

const SimpleWebRTC = {
    // Configuration with improved STUN/TURN servers
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            // More reliable TURN servers
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            }
        ],
        iceCandidatePoolSize: 10
    },
    
    // Browser info for compatibility handling
    browserInfo: (function() {
        const ua = navigator.userAgent;
        let browser = "unknown";
        let version = "0";
    
        if (ua.indexOf("Chrome") > -1) {
            browser = "chrome";
            version = ua.match(/Chrome\/(\d+)/)[1];
        } else if (ua.indexOf("Firefox") > -1) {
            browser = "firefox";
            version = ua.match(/Firefox\/(\d+)/)[1];
        } else if (ua.indexOf("Safari") > -1 && ua.indexOf("Chrome") === -1) {
            browser = "safari";
            version = ua.match(/Version\/(\d+)/)[1];
        } else if (ua.indexOf("Edge") > -1 || ua.indexOf("Edg/") > -1) {
            browser = "edge";
            version = ua.match(/Edge\/(\d+)/) || ua.match(/Edg\/(\d+)/);
            version = version ? version[1] : "0";
        }
    
        return { browser, version: parseInt(version) };
    })(),

    // Connection state
    state: {
        isInitiator: false,
        isConnected: false,
        isConnecting: false,
        localId: null,
        peerId: null,
        localCandidates: [],
        offerCreated: false,
        answerReceived: false,
        connection: null,
        channel: null,
        retryCount: 0,
        maxRetries: 3,
        signalConnected: false,
        pendingCandidates: [],
        connectionMonitor: null
    },
    
    // Event callbacks
    callbacks: {
        onConnected: null,
        onDisconnected: null,
        onMessage: null,
        onError: null,
        onStatusChange: null,
        onNewIceCandidate: null
    },
    
    /**
     * Initialize WebRTC with improved logging
     * @param {Object} options Configuration options
     * @returns {string} Local ID
     */
    init: function(options = {}) {
        console.log('[SimpleWebRTC] Initializing with options:', options);
        
        // Merge options with defaults
        if (options.config) {
            this.config = { ...this.config, ...options.config };
        }
        
        if (options.callbacks) {
            this.callbacks = { ...this.callbacks, ...options.callbacks };
        }
        
        // Generate a local ID if not provided
        this.state.localId = options.localId || this.generateId();
        console.log('[SimpleWebRTC] Initialized with ID:', this.state.localId);
        
        // Reset connection state
        this.state.isInitiator = false;
        this.state.isConnected = false;
        this.state.isConnecting = false;
        this.state.localCandidates = [];
        this.state.offerCreated = false;
        this.state.answerReceived = false;
        this.state.pendingCandidates = [];
        
        // Update status
        this.updateStatus('initialized', 'WebRTC initialized');
        
        // Check for WebRTC support
        if (!window.RTCPeerConnection) {
            this.handleError('WebRTC not supported in this browser', new Error('WebRTC not supported'));
        }
        
        return this.state.localId;
    },
    
    /**
     * Create a connection as the initiator (room creator) with improved logging
     * @returns {Promise<Object>} Connection information for signaling
     */
    createConnection: async function() {
        try {
            console.log('[SimpleWebRTC] Creating connection as initiator...');
        
            // Set state
            this.state.isInitiator = true;
            this.state.isConnecting = true;
            this.updateStatus('connecting', 'Creating connection...');
        
            // Clean up existing connection if any
            this.cleanupConnection();
        
            // Create new RTCPeerConnection with browser-specific options
            const rtcConfig = this.getBrowserCompatibleConfig();
            
            console.log('[SimpleWebRTC] Using RTC configuration:', rtcConfig);
            this.state.connection = new RTCPeerConnection(rtcConfig);
            console.log('[SimpleWebRTC] Created peer connection as initiator');
        
            // Set up connection event handlers
            this.setupConnectionHandlers();
        
            // Create data channel with browser-specific options
            const channelOptions = this.getDataChannelOptions();
            console.log('[SimpleWebRTC] Creating data channel with options:', channelOptions);
            
            this.state.channel = this.state.connection.createDataChannel('gameChannel', channelOptions);
            console.log('[SimpleWebRTC] Data channel created: ', this.state.channel.label);
        
            // Set up data channel handlers
            this.setupChannelHandlers(this.state.channel);
        
            // Create offer
            const offerOptions = this.getOfferOptions();
            console.log('[SimpleWebRTC] Creating offer with options:', offerOptions);
            
            const offer = await this.state.connection.createOffer(offerOptions);
            console.log('[SimpleWebRTC] Offer created:', offer);
            
            await this.state.connection.setLocalDescription(offer);
            console.log('[SimpleWebRTC] Local description set');
        
            this.state.offerCreated = true;
        
            // Wait for ICE gathering with better timeout handling
            console.log('[SimpleWebRTC] Waiting for ICE candidates...');
            const offerWithCandidates = await this.waitForIceCandidates();
            console.log('[SimpleWebRTC] ICE gathering completed with', 
                offerWithCandidates.candidates.length, 'candidates');
        
            // Start connection monitoring
            this.startConnectionMonitor();
        
            // Return the offer with connection details
            const connectionInfo = {
                type: 'offer',
                initiatorId: this.state.localId,
                offer: this.state.connection.localDescription,
                candidates: this.state.localCandidates,
                browser: this.browserInfo.browser,
                version: this.browserInfo.version
            };
            
            console.log('[SimpleWebRTC] Returning connection info:', {
                ...connectionInfo,
                offer: '[SDP offer]', // Don't log the full SDP for readability
                candidates: `[${connectionInfo.candidates.length} candidates]`
            });
            
            return connectionInfo;
        } catch (error) {
            console.error('[SimpleWebRTC] Error creating connection:', error);
            this.handleError('Failed to create connection', error);
            return null;
        }
    },
    
    /**
     * Join a connection as the responder with improved logging
     * @param {Object} connectionInfo Connection info from initiator
     * @returns {Promise<Object>} Answer information for signaling
     */
    joinConnection: async function(connectionInfo) {
        try {
            console.log('[SimpleWebRTC] Joining connection as responder:', {
                ...connectionInfo,
                offer: '[SDP offer]', // Don't log the full SDP for readability
                candidates: connectionInfo.candidates ? 
                    `[${connectionInfo.candidates.length} candidates]` : 'none'
            });
        
            // Set state
            this.state.isInitiator = false;
            this.state.isConnecting = true;
            this.state.peerId = connectionInfo.initiatorId;
            this.updateStatus('connecting', 'Joining connection...');
        
            // Clean up existing connection if any
            this.cleanupConnection();
        
            // Create new RTCPeerConnection with browser-specific options
            const rtcConfig = this.getBrowserCompatibleConfig();
            
            console.log('[SimpleWebRTC] Using RTC configuration:', rtcConfig);
            this.state.connection = new RTCPeerConnection(rtcConfig);
            console.log('[SimpleWebRTC] Created peer connection as responder');
        
            // Set up connection event handlers
            this.setupConnectionHandlers();
        
            // Set remote description from offer
            console.log('[SimpleWebRTC] Setting remote description from offer');
            const offerDesc = new RTCSessionDescription(connectionInfo.offer);
            await this.state.connection.setRemoteDescription(offerDesc);
            console.log('[SimpleWebRTC] Remote description set successfully');
        
            // Add ICE candidates from initiator
            if (connectionInfo.candidates && Array.isArray(connectionInfo.candidates)) {
                console.log('[SimpleWebRTC] Adding', connectionInfo.candidates.length, 'ICE candidates from initiator');
                for (const candidate of connectionInfo.candidates) {
                    try {
                        await this.state.connection.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (e) {
                        console.warn('[SimpleWebRTC] Error adding ICE candidate:', e);
                    }
                }
            } else {
                console.log('[SimpleWebRTC] No ICE candidates provided by initiator');
            }
        
            // Create answer with browser-specific options
            const answerOptions = this.getAnswerOptions();
            console.log('[SimpleWebRTC] Creating answer with options:', answerOptions);
            
            const answer = await this.state.connection.createAnswer(answerOptions);
            console.log('[SimpleWebRTC] Answer created');
            
            await this.state.connection.setLocalDescription(answer);
            console.log('[SimpleWebRTC] Local description set');
        
            // Wait for ICE gathering to complete or timeout
            console.log('[SimpleWebRTC] Waiting for ICE candidates...');
            const answerWithCandidates = await this.waitForIceCandidates();
            console.log('[SimpleWebRTC] ICE gathering completed with', 
                answerWithCandidates.candidates.length, 'candidates');
        
            // Start connection monitoring
            this.startConnectionMonitor();
        
            // Return the answer with connection details
            const answerInfo = {
                type: 'answer',
                responderId: this.state.localId,
                answer: this.state.connection.localDescription,
                candidates: this.state.localCandidates,
                browser: this.browserInfo.browser,
                version: this.browserInfo.version
            };
            
            console.log('[SimpleWebRTC] Returning answer info:', {
                ...answerInfo,
                answer: '[SDP answer]', // Don't log the full SDP for readability
                candidates: `[${answerInfo.candidates.length} candidates]`
            });
            
            return answerInfo;
        } catch (error) {
            console.error('[SimpleWebRTC] Error joining connection:', error);
            this.handleError('Failed to join connection', error);
            return null;
        }
    },
    
    /**
     * Process answer from responder with improved logging
     * @param {Object} answerInfo Answer info from responder
     * @returns {Promise<boolean>} Success status
     */
    processAnswer: async function(answerInfo) {
        try {
            console.log('[SimpleWebRTC] Processing answer from responder:', {
                ...answerInfo,
                answer: '[SDP answer]', // Don't log the full SDP for readability
                candidates: answerInfo.candidates ? 
                    `[${answerInfo.candidates.length} candidates]` : 'none'
            });
            
            if (!this.state.connection) {
                throw new Error('No active connection to process answer');
            }
            
            // Set peer ID
            this.state.peerId = answerInfo.responderId;
            
            // Set remote description from answer
            console.log('[SimpleWebRTC] Setting remote description from answer');
            const answerDesc = new RTCSessionDescription(answerInfo.answer);
            await this.state.connection.setRemoteDescription(answerDesc);
            console.log('[SimpleWebRTC] Remote description set successfully');
            
            // Add ICE candidates from responder
            if (answerInfo.candidates && Array.isArray(answerInfo.candidates)) {
                console.log('[SimpleWebRTC] Adding', answerInfo.candidates.length, 'ICE candidates from responder');
                for (const candidate of answerInfo.candidates) {
                    try {
                        await this.state.connection.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (e) {
                        console.warn('[SimpleWebRTC] Error adding ICE candidate:', e);
                    }
                }
            } else {
                console.log('[SimpleWebRTC] No ICE candidates provided by responder');
            }
            
            this.state.answerReceived = true;
            this.updateStatus('connecting', 'Connection in progress...');
            
            return true;
        } catch (error) {
            console.error('[SimpleWebRTC] Error processing answer:', error);
            this.handleError('Failed to process answer', error);
            return false;
        }
    },
    
    /**
     * Get browser-compatible RTC configuration
     * @returns {Object} Configuration object
     */
    getBrowserCompatibleConfig: function() {
        const rtcConfig = {
            iceServers: this.config.iceServers,
            iceCandidatePoolSize: this.config.iceCandidatePoolSize
        };
    
        // Safari and old Edge-specific compatibility
        if (this.browserInfo.browser === 'safari' || 
            (this.browserInfo.browser === 'edge' && this.browserInfo.version < 79)) {
            console.log('[SimpleWebRTC] Applying Safari/Edge compatibility mode');
            rtcConfig.bundlePolicy = 'max-bundle';
            rtcConfig.rtcpMuxPolicy = 'require';
        }
        
        return rtcConfig;
    },
    
    /**
     * Get browser-compatible data channel options
     * @returns {Object} Data channel options
     */
    getDataChannelOptions: function() {
        const channelOptions = {
            ordered: true
        };
    
        // Add maxRetransmits for better reliability, different browsers have different defaults
        if (this.browserInfo.browser === 'chrome' || this.browserInfo.browser === 'edge') {
            channelOptions.maxRetransmits = 30;
        } else if (this.browserInfo.browser === 'firefox') {
            // Firefox has different defaults for reliability
            channelOptions.maxRetransmits = 30;
            channelOptions.maxPacketLifeTime = 5000; // 5 seconds
        }
        
        return channelOptions;
    },
    
    /**
     * Get browser-compatible offer options
     * @returns {Object} Offer options
     */
    getOfferOptions: function() {
        const offerOptions = {};
    
        // Safari requires these offer options
        if (this.browserInfo.browser === 'safari') {
            offerOptions.offerToReceiveAudio = false;
            offerOptions.offerToReceiveVideo = false;
        }
        
        return offerOptions;
    },
    
    /**
     * Get browser-compatible answer options
     * @returns {Object} Answer options
     */
    getAnswerOptions: function() {
        const answerOptions = {};
    
        // Safari requires these answer options
        if (this.browserInfo.browser === 'safari') {
            answerOptions.offerToReceiveAudio = false;
            answerOptions.offerToReceiveVideo = false;
        }
        
        return answerOptions;
    },
    
    /**
     * Set up handlers for peer connection events with improved logging
     */
    setupConnectionHandlers: function() {
        const connection = this.state.connection;
        
        // ICE candidate event
        connection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('[SimpleWebRTC] New ICE candidate:', event.candidate);
                this.state.localCandidates.push(event.candidate);
                
                // Notify for trickle ICE if callback is set
                if (this.callbacks.onNewIceCandidate) {
                    this.callbacks.onNewIceCandidate(event.candidate);
                }
            } else {
                console.log('[SimpleWebRTC] ICE candidate gathering complete');
            }
        };
        
        // ICE gathering state change
        connection.onicegatheringstatechange = () => {
            console.log('[SimpleWebRTC] ICE gathering state changed to:', connection.iceGatheringState);
        };
        
        // ICE connection state change
        connection.oniceconnectionstatechange = () => {
            console.log('[SimpleWebRTC] ICE connection state changed to:', connection.iceConnectionState);
            
            switch (connection.iceConnectionState) {
                case 'connected':
                case 'completed':
                    if (!this.state.isConnected) {
                        console.log('[SimpleWebRTC] ICE connection established');
                        this.state.isConnected = true;
                        this.state.isConnecting = false;
                        this.updateStatus('connected', 'Connection established');
                        
                        if (this.callbacks.onConnected) {
                            this.callbacks.onConnected();
                        }
                    }
                    break;
                    
                case 'disconnected':
                    console.log('[SimpleWebRTC] ICE connection disconnected');
                    this.updateStatus('disconnected', 'Connection lost');
                    this.handleReconnect();
                    break;
                    
                case 'failed':
                    console.log('[SimpleWebRTC] ICE connection failed');
                    this.updateStatus('error', 'Connection failed');
                    this.handleReconnect();
                    break;
                    
                case 'closed':
                    console.log('[SimpleWebRTC] ICE connection closed');
                    this.state.isConnected = false;
                    this.state.isConnecting = false;
                    this.updateStatus('disconnected', 'Connection closed');
                    
                    if (this.callbacks.onDisconnected) {
                        this.callbacks.onDisconnected();
                    }
                    break;
            }
        };
        
        // Connection state change
        connection.onconnectionstatechange = () => {
            console.log('[SimpleWebRTC] Connection state changed to:', connection.connectionState);
            
            switch (connection.connectionState) {
                case 'connected':
                    console.log('[SimpleWebRTC] Connection established');
                    this.state.isConnected = true;
                    this.state.isConnecting = false;
                    this.state.retryCount = 0; // Reset retry count on successful connection
                    this.updateStatus('connected', 'Connection established');
                    break;
                    
                case 'disconnected':
                    console.log('[SimpleWebRTC] Connection disconnected');
                    this.handleReconnect();
                    break;
                    
                case 'failed':
                    console.log('[SimpleWebRTC] Connection failed');
                    this.handleReconnect();
                    break;
                    
                case 'closed':
                    console.log('[SimpleWebRTC] Connection closed');
                    this.state.isConnected = false;
                    this.state.isConnecting = false;
                    this.updateStatus('disconnected', 'Connection closed');
                    break;
            }
        };
        
        // Signaling state change
        connection.onsignalingstatechange = () => {
            console.log('[SimpleWebRTC] Signaling state changed to:', connection.signalingState);
        };
        
        // Data channel event (for responder)
        if (!this.state.isInitiator) {
            connection.ondatachannel = (event) => {
                console.log('[SimpleWebRTC] Received data channel:', event.channel.label);
                this.state.channel = event.channel;
                this.setupChannelHandlers(this.state.channel);
            };
        }
    },
    
    /**
     * Set up handlers for data channel events with improved logging
     * @param {RTCDataChannel} channel Data channel
     */
    setupChannelHandlers: function(channel) {
        console.log('[SimpleWebRTC] Setting up data channel handlers for', channel.label);
        
        channel.binaryType = 'arraybuffer';  // Optimize for binary data if needed
        
        channel.onopen = () => {
            console.log('[SimpleWebRTC] Data channel opened:', channel.label);
    
            // Make sure we update state flags
            this.state.isConnected = true;
            this.state.isConnecting = false;
    
            // Add a small delay before notifying - helps with race conditions
            setTimeout(() => {
                this.updateStatus('connected', 'Data channel open');
        
                // Send an initial ping to confirm connection
                this.sendData({
                    type: 'ping',
                    timestamp: Date.now()
                });
        
                if (this.callbacks.onConnected) {
                    this.callbacks.onConnected();
                }
            }, 200);
        };
        
        channel.onclose = () => {
            console.log('[SimpleWebRTC] Data channel closed:', channel.label);
            this.state.isConnected = false;
            this.updateStatus('disconnected', 'Data channel closed');
            
            if (this.callbacks.onDisconnected) {
                this.callbacks.onDisconnected();
            }
        };
        
        channel.onerror = (error) => {
            console.error('[SimpleWebRTC] Data channel error:', error);
            this.handleError('Data channel error', error);
        };
        
        channel.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                
                // Don't log ping/pong messages to avoid console noise
                if (message.type !== 'ping' && message.type !== 'pong') {
                    console.log('[SimpleWebRTC] Received message:', message);
                }
                
                if (this.callbacks.onMessage) {
                    this.callbacks.onMessage(message);
                }
            } catch (error) {
                console.error('[SimpleWebRTC] Error handling message:', error);
            }
        };
    },
    
    /**
     * Send data through the connection with improved logging
     * @param {Object} data Data to send
     * @returns {boolean} Success status
     */
    sendData: function(data) {
        try {
            if (!this.state.channel || this.state.channel.readyState !== 'open') {
                console.warn('[SimpleWebRTC] Data channel not open, cannot send data. Channel state:', 
                    this.state.channel ? this.state.channel.readyState : 'no channel');
                return false;
            }
            
            // Add sender ID to data
            const fullData = {
                ...data,
                senderId: this.state.localId
            };
            
            // Don't log ping/pong messages to avoid console noise
            if (data.type !== 'ping' && data.type !== 'pong') {
                console.log('[SimpleWebRTC] Sending data:', fullData);
            }
            
            // Send as JSON string
            this.state.channel.send(JSON.stringify(fullData));
            return true;
        } catch (error) {
            console.error('[SimpleWebRTC] Error sending data:', error);
            return false;
        }
    },
    
    /**
     * Wait for ICE candidates to be gathered with improved timeout handling
     * @returns {Promise} Promise that resolves when ICE gathering is complete or times out
     */
    waitForIceCandidates: function() {
        return new Promise((resolve) => {
            // If gathering is already complete, resolve immediately
            if (this.state.connection.iceGatheringState === 'complete') {
                console.log('[SimpleWebRTC] ICE gathering already complete');
                resolve({
                    description: this.state.connection.localDescription,
                    candidates: this.state.localCandidates
                });
                return;
            }
            
            console.log('[SimpleWebRTC] Waiting for ICE gathering to complete...');
            
            // Set a longer timeout (10 seconds)
            const iceGatheringTimeout = setTimeout(() => {
                console.log('[SimpleWebRTC] ICE gathering timed out after 10s, using available candidates:', 
                    this.state.localCandidates.length);
                resolve({
                    description: this.state.connection.localDescription,
                    candidates: this.state.localCandidates
                });
            }, 10000);
            
            // Set up listener for gathering state changes
            const gatheringStateHandler = () => {
                if (this.state.connection.iceGatheringState === 'complete') {
                    console.log('[SimpleWebRTC] ICE gathering completed with', 
                        this.state.localCandidates.length, 'candidates');
                    
                    // Remove the event listener to avoid memory leaks
                    this.state.connection.removeEventListener('icegatheringstatechange', gatheringStateHandler);
                    
                    clearTimeout(iceGatheringTimeout);
                    resolve({
                        description: this.state.connection.localDescription,
                        candidates: this.state.localCandidates
                    });
                }
            };
            
            // Listen for gathering state changes
            this.state.connection.addEventListener('icegatheringstatechange', gatheringStateHandler);
        });
    },
    
    /**
     * Start connection monitoring to detect and fix issues
     */
    startConnectionMonitor: function() {
        // Clear any existing monitor
        if (this.state.connectionMonitor) {
            clearInterval(this.state.connectionMonitor);
        }
    
        console.log('[SimpleWebRTC] Starting connection monitor');
        
        // Check connection every 2 seconds
        this.state.connectionMonitor = setInterval(() => {
            if (this.state.connection) {
                const state = {
                    connection: this.state.connection.connectionState,
                    iceConnection: this.state.connection.iceConnectionState,
                    signaling: this.state.connection.signalingState,
                    dataChannel: this.state.channel ? this.state.channel.readyState : 'none'
                };
            
                // Don't log every check to avoid console noise
                // Only log if there's a mismatch or problem
                if (this.state.isConnected && 
                    (state.connection !== 'connected' || 
                     state.iceConnection !== 'connected' || 
                     (this.state.channel && state.dataChannel !== 'open'))) {
                    
                    console.warn('[SimpleWebRTC] Connection state mismatch detected:', state);
                    
                    // If serious disconnection is detected
                    if ((state.connection === 'failed' || state.iceConnection === 'failed') ||
                        (this.state.channel && state.dataChannel === 'closed')) {
                        console.error('[SimpleWebRTC] Critical connection failure detected');
                        this.state.isConnected = false;
                        this.updateStatus('error', 'Connection failed');
                        this.handleReconnect();
                    }
                }
            }
        }, 2000);
    },
    
    /**
     * Handle reconnection attempts with improved logging
     */
    handleReconnect: function() {
        // Only attempt reconnect if we've successfully connected before
        if (this.state.offerCreated || this.state.answerReceived) {
            if (this.state.retryCount < this.state.maxRetries) {
                this.state.retryCount++;
                console.log('[SimpleWebRTC] Attempting reconnection, attempt', this.state.retryCount);
                this.updateStatus('connecting', `Reconnecting (attempt ${this.state.retryCount})...`);
                
                // Try to reconnect after a delay
                setTimeout(() => {
                    if (this.state.isInitiator) {
                        console.log('[SimpleWebRTC] Reinitializing connection as initiator');
                        this.createConnection();
                    }
                }, 2000);
            } else {
                console.error('[SimpleWebRTC] Maximum reconnection attempts reached');
                this.updateStatus('error', 'Reconnection failed');
                this.handleError('Maximum reconnection attempts reached', null);
            }
        }
    },
    
    /**
     * Disconnect and clean up resources with improved logging
     */
    disconnect: function() {
        console.log('[SimpleWebRTC] Disconnecting...');
        
        // Stop connection monitor
        if (this.state.connectionMonitor) {
            clearInterval(this.state.connectionMonitor);
            this.state.connectionMonitor = null;
        }
        
        this.cleanupConnection();
        this.updateStatus('disconnected', 'Disconnected');
    
        // Make sure all state flags are reset
        this.state.isInitiator = false;
        this.state.isConnected = false;
        this.state.isConnecting = false;
        this.state.offerCreated = false;
        this.state.answerReceived = false;
        this.state.signalConnected = false;
        this.state.retryCount = 0;
    },
    
    /**
     * Clean up existing connection and resources with improved logging
     */
    cleanupConnection: function() {
        console.log('[SimpleWebRTC] Cleaning up connection and resources');
        
        // Close data channel
        if (this.state.channel) {
            try {
                console.log('[SimpleWebRTC] Closing data channel:', this.state.channel.label);
                this.state.channel.close();
            } catch (e) {
                console.warn('[SimpleWebRTC] Error closing data channel:', e);
            }
            this.state.channel = null;
        }
        
        // Close connection
        if (this.state.connection) {
            try {
                console.log('[SimpleWebRTC] Closing peer connection');
                this.state.connection.close();
            } catch (e) {
                console.warn('[SimpleWebRTC] Error closing connection:', e);
            }
            this.state.connection = null;
        }
        
        // Reset state
        this.state.localCandidates = [];
        this.state.pendingCandidates = [];
    },
    
    /**
     * Handle errors with improved logging
     * @param {string} message Error message
     * @param {Error} error Error object
     */
    handleError: function(message, error) {
        console.error(`[SimpleWebRTC] Error: ${message}`, error);
        this.state.isConnecting = false;
        this.updateStatus('error', message);
        
        if (this.callbacks.onError) {
            this.callbacks.onError(message, error);
        }
    },
    
    /**
     * Update connection status with improved logging
     * @param {string} status Status code
     * @param {string} message Status message
     */
    updateStatus: function(status, message) {
        console.log(`[SimpleWebRTC] Status: ${status} - ${message}`);
        
        if (this.callbacks.onStatusChange) {
            this.callbacks.onStatusChange(status, message);
        }
    },
    
    /**
     * Generate a random ID
     * @returns {string} Random ID
     */
    generateId: function() {
        return Math.random().toString(36).substring(2, 10).toUpperCase();
    },
    
    /**
     * Add a remote ICE candidate
     * @param {Object} candidate ICE candidate
     * @returns {Promise<boolean>} Success status
     */
    addRemoteIceCandidate: async function(candidate) {
        try {
            console.log('[SimpleWebRTC] Adding remote ICE candidate');
            
            if (!this.state.connection) {
                console.log('[SimpleWebRTC] No connection yet, queueing candidate');
                this.state.pendingCandidates.push(candidate);
                return false;
            }
            
            // Check if remote description is set
            if (this.state.connection.remoteDescription) {
                await this.state.connection.addIceCandidate(new RTCIceCandidate(candidate));
                return true;
            } else {
                console.log('[SimpleWebRTC] Remote description not set yet, queueing candidate');
                this.state.pendingCandidates.push(candidate);
                return false;
            }
        } catch (error) {
            console.error('[SimpleWebRTC] Error adding remote ICE candidate:', error);
            return false;
        }
    },
    
    /**
     * Process any pending ICE candidates
     * @returns {Promise<number>} Number of processed candidates
     */
    processPendingCandidates: async function() {
        if (this.state.pendingCandidates.length === 0 || !this.state.connection) {
            return 0;
        }
        
        console.log('[SimpleWebRTC] Processing', this.state.pendingCandidates.length, 'pending ICE candidates');
        
        let processedCount = 0;
        // Process any pending candidates
        for (const candidate of this.state.pendingCandidates) {
            try {
                await this.state.connection.addIceCandidate(new RTCIceCandidate(candidate));
                processedCount++;
            } catch (e) {
                console.warn('[SimpleWebRTC] Error adding pending ICE candidate:', e);
            }
        }
        
        // Clear pending candidates
        this.state.pendingCandidates = [];
        console.log('[SimpleWebRTC] Processed', processedCount, 'pending ICE candidates');
        
        return processedCount;
    },
    
    /**
     * Get diagnostic information about the connection
     * @returns {Object} Diagnostic information
     */
    diagnosticInfo: function() {
        console.log('[SimpleWebRTC] Gathering diagnostic information');
        
        const connectionInfo = this.state.connection ? {
            iceGatheringState: this.state.connection.iceGatheringState,
            connectionState: this.state.connection.connectionState,
            iceConnectionState: this.state.connection.iceConnectionState,
            signalingState: this.state.connection.signalingState
        } : 'No connection';
        
        const channelInfo = this.state.channel ? {
            label: this.state.channel.label,
            readyState: this.state.channel.readyState,
            bufferedAmount: this.state.channel.bufferedAmount
        } : 'No channel';
        
        return {
            browserInfo: navigator.userAgent,
            webrtcSupport: !!window.RTCPeerConnection,
            connection: connectionInfo,
            dataChannel: channelInfo,
            candidatesGathered: this.state.localCandidates.length,
            pendingCandidates: this.state.pendingCandidates.length,
            state: {
                isInitiator: this.state.isInitiator,
                isConnected: this.state.isConnected,
                isConnecting: this.state.isConnecting,
                retryCount: this.state.retryCount
            },
            networkInfo: navigator.connection ? {
                type: navigator.connection.type,
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            } : 'N/A'
        };
    }
};