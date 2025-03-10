// This file is intentionally empty.
// WebRTC functionality has been moved to connection-manager.js which uses PeerJS.
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