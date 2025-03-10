/**
 * Mentalplayer - Connection Utilities
 * 
 * Provides additional connection monitoring, diagnostic, and recovery tools
 * for better reliability of the WebRTC-based multiplayer system.
 */

/**
 * Enhanced notification system
 * Use when ConnectionManager might not be available or initialized
 */
function showNotification(title, message, type = 'info') {
    console.log(`[Notification] ${type}: ${title} - ${message}`);
    
    // Try using ConnectionManager's showNotification if available
    if (typeof ConnectionManager !== 'undefined' && 
        typeof ConnectionManager.showNotification === 'function') {
        try {
            ConnectionManager.showNotification(title, message, type);
            return;
        } catch (e) {
            console.warn('[Notification] Failed to use ConnectionManager.showNotification:', e);
            // Fall back to our implementation
        }
    }
    
    // Create container if not exists
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 300px;
        `;
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
 * Connection recovery system
 * Detects and attempts to fix disconnected states
 */
function setupConnectionRecovery() {
    console.log('[ConnectionRecovery] Setting up connection recovery monitor');
    
    // Check every 5 seconds for connection issues
    const recoveryInterval = setInterval(() => {
        if (typeof ConnectionManager === 'undefined' || typeof SimpleWebRTC === 'undefined') {
            return; // Can't do anything without these components
        }
        
        // If we're in a room but SimpleWebRTC says we're disconnected
        if (ConnectionManager.roomId && 
            !SimpleWebRTC.state.isConnected && 
            !SimpleWebRTC.state.isConnecting) {
            
            console.warn('[ConnectionRecovery] Detected connection mismatch:',
                'ConnectionManager says in room, but SimpleWebRTC is disconnected');
            
            // Only attempt recovery if we haven't tried recently
            const now = Date.now();
            const lastRecoveryAttempt = window._lastRecoveryAttempt || 0;
            
            if (now - lastRecoveryAttempt > 30000) { // Only try every 30 seconds
                window._lastRecoveryAttempt = now;
                
                console.log('[ConnectionRecovery] Attempting to recover connection');
                showNotification(
                    'Connection Issue', 
                    'Attempting to recover connection...', 
                    'warning'
                );
                
                // Try to reinitialize connection
                if (ConnectionManager.isRoomCreator) {
                    SimpleWebRTC.createConnection();
                } else if (ConnectionManager.roomId) {
                    // For responder, show rejoin option
                    showNotification(
                        'Connection Lost', 
                        'You may need to rejoin the room.', 
                        'warning'
                    );
                }
            }
        }
    }, 5000);
    
    // Store interval ID for cleanup if needed
    window._connectionRecoveryInterval = recoveryInterval;
}

/**
 * Connection testing function
 * Helps users diagnose connection issues
 */
function testConnection() {
    console.log('[ConnectionTest] Running connection test');
    
    if (typeof SimpleWebRTC === 'undefined') {
        showNotification('Test Failed', 'WebRTC component not loaded', 'error');
        return false;
    }
    
    const results = {
        webrtcAvailable: !!window.RTCPeerConnection,
        simpleWebRTCLoaded: !!SimpleWebRTC,
        connectionManagerLoaded: !!ConnectionManager,
        inRoom: ConnectionManager ? !!ConnectionManager.roomId : false,
        connected: SimpleWebRTC ? SimpleWebRTC.state.isConnected : false,
        stunServerReachable: false,
        turnServerReachable: false
    };
    
    // Test STUN server reachability
    const stunTest = new Promise((resolve) => {
        try {
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });
            
            let resolved = false;
            
            // Listen for ICE candidates
            pc.onicecandidate = (e) => {
                if (!resolved && e.candidate) {
                    resolved = true;
                    results.stunServerReachable = true;
                    resolve();
                    pc.close();
                }
            };
            
            // Create data channel to trigger ICE gathering
            pc.createDataChannel('test');
            pc.createOffer().then(offer => pc.setLocalDescription(offer));
            
            // Timeout after 5 seconds
            setTimeout(() => {
                if (!resolved) {
                    resolve();
                    pc.close();
                }
            }, 5000);
        } catch (e) {
            console.error('[ConnectionTest] Error testing STUN server:', e);
            resolve();
        }
    });
    
    // Show the results after the tests complete
    stunTest.then(() => {
        console.log('[ConnectionTest] Results:', results);
        
        let message = '';
        let type = 'info';
        
        if (!results.webrtcAvailable) {
            message = 'WebRTC is not supported in your browser. Try Chrome, Firefox, or Edge.';
            type = 'error';
        } else if (!results.simpleWebRTCLoaded || !results.connectionManagerLoaded) {
            message = 'Connection components failed to load. Try refreshing the page.';
            type = 'error';
        } else if (!results.stunServerReachable) {
            message = 'Unable to reach STUN servers. Your network may be blocking WebRTC connections.';
            type = 'warning';
        } else if (results.inRoom && !results.connected) {
            message = 'In room but not connected. Try rejoining the room.';
            type = 'warning';
        } else if (results.connected) {
            message = 'Connection looks good! You are connected to a peer.';
            type = 'success';
        } else {
            message = 'WebRTC seems to be working. Create or join a room to connect with others.';
            type = 'info';
        }
        
        showNotification('Connection Test', message, type);
        
        // Add a diagnostic button to the page if not already present
        let diagnosticButton = document.getElementById('connection-diagnostic-button');
        if (!diagnosticButton) {
            diagnosticButton = document.createElement('button');
            diagnosticButton.id = 'connection-diagnostic-button';
            diagnosticButton.className = 'button secondary-button';
            diagnosticButton.style.position = 'fixed';
            diagnosticButton.style.bottom = '10px';
            diagnosticButton.style.right = '10px';
            diagnosticButton.style.zIndex = '1000';
            diagnosticButton.innerHTML = '<i class="fas fa-network-wired"></i> Test Connection';
            diagnosticButton.addEventListener('click', testConnection);
            document.body.appendChild(diagnosticButton);
        }
    });
    
    return results;
}

/**
 * Add state synchronization functions to app.js
 */
function setupStateSyncEvents() {
    console.log('[App] Setting up event-based state synchronization');
    
    if (typeof ConnectionManager === 'undefined' || typeof AppState === 'undefined') {
        console.warn('[App] ConnectionManager or AppState not available for state sync');
        return;
    }
    
    // Sync on room creation/joining
    const originalCreateRoom = ConnectionManager.createRoom;
    ConnectionManager.createRoom = function() {
        const result = originalCreateRoom.apply(this, arguments);
        syncStates();
        return result;
    };
    
    const originalJoinRoom = ConnectionManager.joinRoom;
    ConnectionManager.joinRoom = function() {
        const result = originalJoinRoom.apply(this, arguments);
        syncStates();
        return result;
    };
    
    // Sync on connection events
    if (ConnectionManager.callbacks) {
        const originalOnConnected = ConnectionManager.callbacks.onConnected;
        ConnectionManager.callbacks.onConnected = function() {
            if (originalOnConnected) originalOnConnected.apply(this, arguments);
            syncStates();
        };
        
        const originalOnDisconnected = ConnectionManager.callbacks.onDisconnected;
        ConnectionManager.callbacks.onDisconnected = function() {
            if (originalOnDisconnected) originalOnDisconnected.apply(this, arguments);
            syncStates();
        };
    }
    
    // Initial sync
    syncStates();
}

/**
 * Sync app and connection manager states
 * This ensures both components have consistent state
 */
function syncStates() {
    if (typeof ConnectionManager === 'undefined' || typeof AppState === 'undefined') {
        console.warn('[App] ConnectionManager or AppState not available for state sync');
        return;
    }
    
    // Create a deep copy of current states for comparison
    const prevAppState = JSON.stringify({
        playerId: AppState.playerId,
        roomId: AppState.roomId,
        isRoomCreator: AppState.isRoomCreator,
        playerCount: Object.keys(AppState.players).length,
        currentGame: AppState.currentGame
    });
    
    // Update AppState from ConnectionManager
    AppState.playerId = ConnectionManager.playerId;
    AppState.roomId = ConnectionManager.roomId;
    AppState.isRoomCreator = ConnectionManager.isRoomCreator;
    AppState.players = {...ConnectionManager.players};
    
    // Update ConnectionManager from AppState
    ConnectionManager.playerName = AppState.playerName;
    
    // Update game module reference
    if (AppState.currentGame && AppState.gameModules[AppState.currentGame]) {
        ConnectionManager.gameModule = AppState.gameModules[AppState.currentGame];
    }
    
    // Check if state has changed
    const currentAppState = JSON.stringify({
        playerId: AppState.playerId,
        roomId: AppState.roomId,
        isRoomCreator: AppState.isRoomCreator,
        playerCount: Object.keys(AppState.players).length,
        currentGame: AppState.currentGame
    });
    
    // Only log if state has changed to reduce console noise
    if (prevAppState !== currentAppState) {
        console.log('[App] State sync complete:', {
            playerId: AppState.playerId,
            roomId: AppState.roomId,
            isRoomCreator: AppState.isRoomCreator,
            playerCount: Object.keys(AppState.players).length,
            currentGame: AppState.currentGame
        });
    }
}

/**
 * Enhanced script loading function with retry logic and error handling
 */
function loadScriptsSequentially(scripts, callback, retryCount = 3, currentIndex = 0, failedScripts = []) {
    if (currentIndex >= scripts.length) {
        if (failedScripts.length > 0) {
            console.error(`Failed to load scripts: ${failedScripts.join(', ')}`);
            
            // Show error to user for critical scripts
            const criticalScripts = ['./webrtc.js', './connection-manager.js'];
            const criticalFailed = failedScripts.some(script => criticalScripts.includes(script));
            
            if (criticalFailed) {
                showScriptLoadError(failedScripts);
            }
        }
        
        if (callback) callback(failedScripts.length === 0);
        return;
    }

    const script = document.createElement('script');
    script.src = scripts[currentIndex];
    
    // Set timeout for script loading
    const timeoutId = setTimeout(() => {
        console.error(`Script loading timed out: ${scripts[currentIndex]}`);
        script.onload = script.onerror = null; // Remove event handlers
        
        // Add to failed scripts and continue
        failedScripts.push(scripts[currentIndex]);
        loadScriptsSequentially(scripts, callback, retryCount, currentIndex + 1, failedScripts);
    }, 10000); // 10 second timeout
    
    script.onload = function() {
        console.log(`Loaded script: ${scripts[currentIndex]}`);
        clearTimeout(timeoutId);
        
        // Mark as loaded in global tracking
        if (typeof window !== 'undefined') {
            window._scriptsLoaded = window._scriptsLoaded || {};
            window._scriptsLoaded[scripts[currentIndex].replace('./', '').replace('.js', '')] = true;
        }
        
        // Continue to next script
        loadScriptsSequentially(scripts, callback, retryCount, currentIndex + 1, failedScripts);
    };
    
    script.onerror = function() {
        clearTimeout(timeoutId);
        console.error(`Failed to load script: ${scripts[currentIndex]}`);
        
        // Try to retry loading this script
        if (retryCount > 0) {
            console.log(`Retrying script load (${retryCount} attempts left): ${scripts[currentIndex]}`);
            loadScriptsSequentially(scripts, callback, retryCount - 1, currentIndex, failedScripts);
        } else {
            // Add to failed scripts and continue
            failedScripts.push(scripts[currentIndex]);
            loadScriptsSequentially(scripts, callback, retryCount, currentIndex + 1, failedScripts);
        }
    };
    
    document.body.appendChild(script);
}

/**
 * Show error message for script loading failures
 */
function showScriptLoadError(failedScripts) {
    const errorModal = document.createElement('div');
    errorModal.className = 'modal';
    errorModal.style.display = 'flex';
    
    errorModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Loading Error</h2>
            </div>
            <div class="modal-body">
                <p>Failed to load required scripts:</p>
                <ul>
                    ${failedScripts.map(script => `<li>${script}</li>`).join('')}
                </ul>
                <p>This may be due to network issues or browser restrictions.</p>
            </div>
            <div class="modal-buttons">
                <button id="retry-loading" class="modal-button primary-button">Retry</button>
                <button id="reload-page" class="modal-button secondary-button">Reload Page</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(errorModal);
    
    // Add event listeners
    document.getElementById('retry-loading').addEventListener('click', function() {
        errorModal.style.display = 'none';
        loadScriptsSequentially(failedScripts, function(success) {
            if (success) {
                initializeAfterScriptLoad();
            }
        });
    });
    
    document.getElementById('reload-page').addEventListener('click', function() {
        window.location.reload(true);
    });
}

/**
 * Initialize all connection utilities and recovery systems
 */
function initConnectionUtilities() {
    // Set up connection recovery system after a short delay
    setTimeout(setupConnectionRecovery, 5000);
    
    // Add connection test button after page is fully loaded
    setTimeout(function() {
        // Create a floating test connection button
        const testButton = document.createElement('button');
        testButton.id = 'connection-diagnostic-button';
        testButton.className = 'button secondary-button';
        testButton.style.position = 'fixed';
        testButton.style.bottom = '10px';
        testButton.style.right = '10px';
        testButton.style.zIndex = '1000';
        testButton.innerHTML = '<i class="fas fa-network-wired"></i> Test Connection';
        testButton.addEventListener('click', testConnection);
        document.body.appendChild(testButton);
    }, 3000);
    
    // Check for incomplete components and try to recover if needed
    if (typeof ConnectionManager === 'undefined' || 
        typeof SimpleWebRTC === 'undefined' || 
        typeof MinesweeperGame === 'undefined') {
        
        console.warn('[App] Some components are missing, may need to reload scripts');
        
        // Add a recovery button
        const recoveryButton = document.createElement('button');
        recoveryButton.className = 'button primary-button';
        recoveryButton.style.position = 'fixed';
        recoveryButton.style.top = '70px';
        recoveryButton.style.right = '20px';
        recoveryButton.style.zIndex = '9999';
        recoveryButton.innerHTML = '<i class="fas fa-sync"></i> Reload Components';
        recoveryButton.addEventListener('click', function() {
            location.reload(true);
        });
        document.body.appendChild(recoveryButton);
        
        // Show notification
        showNotification(
            'Component Error', 
            'Some game components failed to load. Click "Reload Components" to fix.', 
            'warning'
        );
    }
    
    // Call setupStateSyncEvents if both AppState and ConnectionManager exist
    if (typeof AppState !== 'undefined' && typeof ConnectionManager !== 'undefined') {
        setupStateSyncEvents();
    }
}

// Add handlers for MinesweeperGame to support chunk requests
function enhanceMinesweeperGame() {
    if (typeof MinesweeperGame === 'undefined') {
        console.warn('[ConnectionUtilities] MinesweeperGame not available for enhancement');
        return;
    }
    
    // Add handler for missing chunks requests
    const originalHandlePeerMessage = MinesweeperGame.handlePeerMessage;
    
    MinesweeperGame.handlePeerMessage = function(peerId, data) {
        if (data.type === 'minesweeper_request_chunks') {
            handleMissingChunksRequest(peerId, data);
            return;
        }
        
        // Call original handler for other message types
        return originalHandlePeerMessage.call(this, peerId, data);
    };
    
    // Add function to handle missing chunk requests
    window.handleMissingChunksRequest = function(peerId, data) {
        if (!data.missingChunks || !Array.isArray(data.missingChunks)) return;
        
        console.log('[MinesweeperGame] Received request for missing chunks:', data.missingChunks);
        
        // Only the room creator should respond to chunk requests
        if (!AppState.isRoomCreator) return;
        
        if (!ConnectionManager || typeof ConnectionManager.sendData !== 'function') {
            console.error('[MinesweeperGame] ConnectionManager not available for sending chunks');
            return;
        }
        
        // Re-send the requested chunks
        for (const chunkIndex of data.missingChunks) {
            const startCell = chunkIndex * 50; // Use same chunk size as in sendGameState
            const endCell = Math.min(startCell + 50, MinesweeperGame.state.rows * MinesweeperGame.state.cols);
            const chunkBoardState = [];
            
            for (let cellIndex = startCell; cellIndex < endCell; cellIndex++) {
                const row = Math.floor(cellIndex / MinesweeperGame.state.cols);
                const col = cellIndex % MinesweeperGame.state.cols;
                chunkBoardState.push({
                    row: row,
                    col: col,
                    state: {
                        isRevealed: MinesweeperGame.state.boardState[row][col].isRevealed,
                        isFlagged: MinesweeperGame.state.boardState[row][col].isFlagged
                    }
                });
            }
            
            // Add a small delay between sending chunks to prevent overwhelming the connection
            setTimeout(() => {
                ConnectionManager.sendData({
                    type: 'minesweeper_board_chunk',
                    chunkIndex: chunkIndex,
                    totalChunks: Math.ceil(MinesweeperGame.state.rows * MinesweeperGame.state.cols / 50),
                    boardChunk: chunkBoardState,
                    timestamp: Date.now(),
                    sequence: chunkIndex + 1,
                    isResend: true // Mark as a resend
                });
                console.log(`[MinesweeperGame] Resent missing chunk ${chunkIndex}`);
            }, chunkIndex * 50); // Stagger the resends
        }
    };
}

// Add to window.onload handler
window.addEventListener('load', function() {
    console.log('[ConnectionUtilities] Initializing connection utilities');
    initConnectionUtilities();
    
    // Try to enhance MinesweeperGame for chunk handling after a short delay
    setTimeout(enhanceMinesweeperGame, 1000);
    
    // Make test function available globally for debugging
    window.testConnection = testConnection;
});