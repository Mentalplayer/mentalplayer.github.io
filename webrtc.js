/**
 * SimpleWebRTC - A streamlined WebRTC implementation for Mentalplayer
 * This provides a reliable peer-to-peer connection with manual signaling
 */

// Main WebRTC controller object
const SimpleWebRTC = {
    // Configuration
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            // Add these free TURN servers for testing
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            }
        ],
        iceCandidatePoolSize: 10
    },
    
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
        pendingCandidates: []
    },
    
    // Event callbacks
    callbacks: {
        onConnected: null,
        onDisconnected: null,
        onMessage: null,
        onError: null,
        onStatusChange: null,
        onNewIceCandidate: null  // New callback for trickle ICE
    },
    
    /**
     * Initialize WebRTC - call this after user interaction
     * @param {Object} options Configuration options
     */
    init: function(options = {}) {
        console.log('Initializing SimpleWebRTC...');
        
        // Merge options with defaults
        this.config = { ...this.config, ...options.config };
        this.callbacks = { ...this.callbacks, ...options.callbacks };
        
        // Generate a local ID if not provided
        this.state.localId = options.localId || this.generateId();
        
        // Update status
        this.updateStatus('initialized', 'WebRTC initialized');
        
        return this.state.localId;
    },
    
    /**
     * Create a connection as the initiator (room creator)
     */
    createConnection: async function() {
        try {
            console.log('Creating connection as initiator...');
            
            // Set state
            this.state.isInitiator = true;
            this.state.isConnecting = true;
            this.updateStatus('connecting', 'Creating connection...');
            
            // Clean up existing connection if any
            this.cleanupConnection();
            
            // Create new RTCPeerConnection
            this.state.connection = new RTCPeerConnection({
                iceServers: this.config.iceServers,
                iceCandidatePoolSize: this.config.iceCandidatePoolSize
            });
            
            // Set up connection event handlers
            this.setupConnectionHandlers();
            
            // Create data channel as initiator
            this.state.channel = this.state.connection.createDataChannel('gameChannel', {
                ordered: true
            });
            
            // Set up data channel handlers
            this.setupChannelHandlers(this.state.channel);
            
            // Create offer
            const offer = await this.state.connection.createOffer();
            await this.state.connection.setLocalDescription(offer);
            
            this.state.offerCreated = true;
            
            // Wait for ICE gathering to complete or timeout
            const offerWithCandidates = await this.waitForIceCandidates();
            
            // Return the offer with connection details
            return {
                type: 'offer',
                initiatorId: this.state.localId,
                offer: this.state.connection.localDescription,
                candidates: this.state.localCandidates
            };
        } catch (error) {
            console.error('Error creating connection:', error);
            this.handleError('Failed to create connection', error);
            return null;
        }
    },
    
    /**
     * Join a connection as the responder
     * @param {Object} connectionInfo Connection info from initiator
     */
    joinConnection: async function(connectionInfo) {
        try {
            console.log('Joining connection as responder...');
            
            // Set state
            this.state.isInitiator = false;
            this.state.isConnecting = true;
            this.state.peerId = connectionInfo.initiatorId;
            this.updateStatus('connecting', 'Joining connection...');
            
            // Clean up existing connection if any
            this.cleanupConnection();
            
            // Create new RTCPeerConnection
            this.state.connection = new RTCPeerConnection({
                iceServers: this.config.iceServers,
                iceCandidatePoolSize: this.config.iceCandidatePoolSize
            });
            
            // Set up connection event handlers
            this.setupConnectionHandlers();
            
            // Set remote description from offer
            const offerDesc = new RTCSessionDescription(connectionInfo.offer);
            await this.state.connection.setRemoteDescription(offerDesc);
            
            // Add ICE candidates from initiator
            if (connectionInfo.candidates && Array.isArray(connectionInfo.candidates)) {
                for (const candidate of connectionInfo.candidates) {
                    try {
                        await this.state.connection.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (e) {
                        console.warn('Error adding ICE candidate:', e);
                    }
                }
            }
            
            // Create answer
            const answer = await this.state.connection.createAnswer();
            await this.state.connection.setLocalDescription(answer);
            
            // Wait for ICE gathering to complete or timeout
            const answerWithCandidates = await this.waitForIceCandidates();
            
            // Return the answer with connection details
            return {
                type: 'answer',
                responderId: this.state.localId,
                answer: this.state.connection.localDescription,
                candidates: this.state.localCandidates
            };
        } catch (error) {
            console.error('Error joining connection:', error);
            this.handleError('Failed to join connection', error);
            return null;
        }
    },
    
    /**
     * Process answer from responder
     * @param {Object} answerInfo Answer info from responder
     */
    processAnswer: async function(answerInfo) {
        try {
            console.log('Processing answer from responder...');
            
            if (!this.state.connection) {
                throw new Error('No active connection to process answer');
            }
            
            // Set peer ID
            this.state.peerId = answerInfo.responderId;
            
            // Set remote description from answer
            const answerDesc = new RTCSessionDescription(answerInfo.answer);
            await this.state.connection.setRemoteDescription(answerDesc);
            
            // Add ICE candidates from responder
            if (answerInfo.candidates && Array.isArray(answerInfo.candidates)) {
                for (const candidate of answerInfo.candidates) {
                    try {
                        await this.state.connection.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (e) {
                        console.warn('Error adding ICE candidate:', e);
                    }
                }
            }
            
            this.state.answerReceived = true;
            this.updateStatus('connecting', 'Connection in progress...');
            
            return true;
        } catch (error) {
            console.error('Error processing answer:', error);
            this.handleError('Failed to process answer', error);
            return false;
        }
    },
    
    /**
     * Add an ICE candidate received from peer
     * @param {Object} candidate ICE candidate
     */
    addRemoteIceCandidate: async function(candidate) {
        try {
            if (!this.state.connection) {
                // Queue the candidate to be added when connection is created
                this.state.pendingCandidates.push(candidate);
                return false;
            }
            
            // Check if remote description is set
            if (this.state.connection.remoteDescription) {
                await this.state.connection.addIceCandidate(new RTCIceCandidate(candidate));
                return true;
            } else {
                // Queue the candidate to be added when remote description is set
                this.state.pendingCandidates.push(candidate);
                return false;
            }
        } catch (error) {
            console.error('Error adding remote ICE candidate:', error);
            return false;
        }
    },
    
    /**
     * Process any pending ICE candidates
     */
    processPendingCandidates: async function() {
        if (this.state.pendingCandidates.length === 0 || !this.state.connection) return;
        
        // Process any pending candidates
        for (const candidate of this.state.pendingCandidates) {
            try {
                await this.state.connection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                console.warn('Error adding pending ICE candidate:', e);
            }
        }
        
        // Clear pending candidates
        this.state.pendingCandidates = [];
    },
    
    /**
     * Send data through the connection
     * @param {Object} data Data to send
     */
    sendData: function(data) {
        try {
            if (!this.state.channel || this.state.channel.readyState !== 'open') {
                console.warn('Data channel not open, cannot send data');
                return false;
            }
            
            // Add sender ID to data
            const fullData = {
                ...data,
                senderId: this.state.localId
            };
            
            // Send as JSON string
            this.state.channel.send(JSON.stringify(fullData));
            return true;
        } catch (error) {
            console.error('Error sending data:', error);
            return false;
        }
    },
    
    /**
     * Disconnect and clean up resources
     */
    disconnect: function() {
        console.log('Disconnecting...');
        this.cleanupConnection();
        this.updateStatus('disconnected', 'Disconnected');
    },
    
    /**
     * Generate a random ID
     * @returns {string} Random ID
     */
    generateId: function() {
        return Math.random().toString(36).substring(2, 10).toUpperCase();
    },
    
    /**
     * Set up handlers for peer connection events
     */
    setupConnectionHandlers: function() {
        const connection = this.state.connection;
        
        // ICE candidate event
        connection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('New ICE candidate:', event.candidate);
                this.state.localCandidates.push(event.candidate);
                
                // Notify for trickle ICE if callback is set
                if (this.callbacks.onNewIceCandidate) {
                    this.callbacks.onNewIceCandidate(event.candidate);
                }
            } else {
                console.log('ICE candidate gathering complete');
            }
        };
        
        // ICE connection state change
        connection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', connection.iceConnectionState);
            
            switch (connection.iceConnectionState) {
                case 'connected':
                case 'completed':
                    if (!this.state.isConnected) {
                        this.state.isConnected = true;
                        this.state.isConnecting = false;
                        this.updateStatus('connected', 'Connection established');
                        
                        if (this.callbacks.onConnected) {
                            this.callbacks.onConnected();
                        }
                    }
                    break;
                    
                case 'disconnected':
                    this.updateStatus('disconnected', 'Connection lost');
                    this.handleReconnect();
                    break;
                    
                case 'failed':
                    this.updateStatus('error', 'Connection failed');
                    this.handleReconnect();
                    break;
                    
                case 'closed':
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
            console.log('Connection state:', connection.connectionState);
            
            switch (connection.connectionState) {
                case 'connected':
                    this.state.isConnected = true;
                    this.state.isConnecting = false;
                    this.state.retryCount = 0; // Reset retry count on successful connection
                    this.updateStatus('connected', 'Connection established');
                    break;
                    
                case 'disconnected':
                case 'failed':
                    this.handleReconnect();
                    break;
                    
                case 'closed':
                    this.state.isConnected = false;
                    this.state.isConnecting = false;
                    this.updateStatus('disconnected', 'Connection closed');
                    break;
            }
        };
        
        // Data channel event (for responder)
        if (!this.state.isInitiator) {
            connection.ondatachannel = (event) => {
                console.log('Received data channel');
                this.state.channel = event.channel;
                this.setupChannelHandlers(this.state.channel);
            };
        }
    },
    
    /**
     * Set up handlers for data channel events
     * @param {RTCDataChannel} channel Data channel
     */
    setupChannelHandlers: function(channel) {
        console.log('Setting up data channel handlers for', channel.label);
        
        channel.binaryType = 'arraybuffer';  // Optimize for binary data if needed
        
        channel.onopen = () => {
            console.log('Data channel open:', channel.label);
            this.state.isConnected = true;
            this.state.isConnecting = false;
            this.updateStatus('connected', 'Data channel open');
            
            // Send an initial ping to confirm connection
            this.sendData({
                type: 'ping',
                timestamp: Date.now()
            });
            
            if (this.callbacks.onConnected) {
                this.callbacks.onConnected();
            }
        };
        
        channel.onclose = () => {
            console.log('Data channel closed');
            this.state.isConnected = false;
            this.updateStatus('disconnected', 'Data channel closed');
            
            if (this.callbacks.onDisconnected) {
                this.callbacks.onDisconnected();
            }
        };
        
        channel.onerror = (error) => {
            console.error('Data channel error:', error);
            this.handleError('Data channel error', error);
        };
        
        channel.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                
                if (this.callbacks.onMessage) {
                    this.callbacks.onMessage(message);
                }
            } catch (error) {
                console.error('Error handling message:', error);
            }
        };
    },
    
    /**
     * Wait for ICE candidates to be gathered
     * @returns {Promise} Promise that resolves when ICE gathering is complete or times out
     */
    waitForIceCandidates: function() {
        return new Promise((resolve) => {
            const candidates = [];
            let iceGatheringTimeout;
            
            const checkComplete = () => {
                if (this.state.connection.iceGatheringState === 'complete') {
                    clearTimeout(iceGatheringTimeout);
                    resolve({
                        description: this.state.connection.localDescription,
                        candidates: this.state.localCandidates
                    });
                }
            };
            
            // Set a longer timeout (10 seconds)
            iceGatheringTimeout = setTimeout(() => {
                console.log('ICE gathering timed out, using available candidates:', this.state.localCandidates.length);
                resolve({
                    description: this.state.connection.localDescription,
                    candidates: this.state.localCandidates
                });
            }, 10000);
            
            // Also check current state
            this.state.connection.onicegatheringstatechange = checkComplete;
            
            // Check immediately in case gathering is already complete
            checkComplete();
        });
    },
    
    /**
     * Clean up existing connection and resources
     */
    cleanupConnection: function() {
        // Close data channel
        if (this.state.channel) {
            try {
                this.state.channel.close();
            } catch (e) {
                console.warn('Error closing data channel:', e);
            }
            this.state.channel = null;
        }
        
        // Close connection
        if (this.state.connection) {
            try {
                this.state.connection.close();
            } catch (e) {
                console.warn('Error closing connection:', e);
            }
            this.state.connection = null;
        }
        
        // Reset state
        this.state.isConnected = false;
        this.state.isConnecting = false;
        this.state.localCandidates = [];
        this.state.offerCreated = false;
        this.state.answerReceived = false;
        this.state.pendingCandidates = [];
    },
    
    /**
     * Handle reconnection attempts
     */
    handleReconnect: function() {
        // Only attempt reconnect if we've successfully connected before
        if (this.state.offerCreated || this.state.answerReceived) {
            if (this.state.retryCount < this.state.maxRetries) {
                this.state.retryCount++;
                this.updateStatus('connecting', `Reconnecting (attempt ${this.state.retryCount})...`);
                
                // Try to reconnect after a delay
                setTimeout(() => {
                    if (this.state.isInitiator) {
                        this.createConnection();
                    }
                }, 2000);
            } else {
                this.updateStatus('error', 'Reconnection failed');
                this.handleError('Maximum reconnection attempts reached', null);
            }
        }
    },
    
    /**
     * Handle errors
     * @param {string} message Error message
     * @param {Error} error Error object
     */
    handleError: function(message, error) {
        this.state.isConnecting = false;
        this.updateStatus('error', message);
        
        if (this.callbacks.onError) {
            this.callbacks.onError(message, error);
        }
    },
    
    /**
     * Update connection status
     * @param {string} status Status code
     * @param {string} message Status message
     */
    updateStatus: function(status, message) {
        console.log(`WebRTC Status: ${status} - ${message}`);
        
        if (this.callbacks.onStatusChange) {
            this.callbacks.onStatusChange(status, message);
        }
    },
    
    /**
     * Get diagnostic information about the connection
     * @returns {Object} Diagnostic information
     */
    diagnosticInfo: function() {
        return {
            browserInfo: navigator.userAgent,
            webrtcSupport: !!window.RTCPeerConnection,
            iceGatheringState: this.state.connection ? this.state.connection.iceGatheringState : 'N/A',
            connectionState: this.state.connection ? this.state.connection.connectionState : 'N/A',
            iceConnectionState: this.state.connection ? this.state.connection.iceConnectionState : 'N/A',
            signallingState: this.state.connection ? this.state.connection.signalingState : 'N/A',
            candidatesGathered: this.state.localCandidates.length,
            dataChannelState: this.state.channel ? this.state.channel.readyState : 'N/A',
            networkInfo: navigator.connection ? {
                type: navigator.connection.type,
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            } : 'N/A'
        };
    }
};

// Export for use in other modules
if (typeof module !== 'undefined') {
    module.exports = SimpleWebRTC;
}