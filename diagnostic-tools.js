// Create a diagnostic panel
function createDiagnosticPanel() {
    const panel = document.createElement('div');
    panel.id = 'diagnostic-panel';
    panel.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px;
        border-radius: 5px;
        font-family: monospace;
        font-size: 12px;
        z-index: 10000;
        max-width: 400px;
        max-height: 300px;
        overflow: auto;
    `;
    
    panel.innerHTML = `
        <h3 style="margin: 0 0 10px 0;">Diagnostic Info</h3>
        <div id="diagnostic-content">Loading...</div>
        <div style="margin-top: 10px;">
            <button id="refresh-diagnostic" style="background: #4a6fa5; color: white; border: none; padding: 5px; cursor: pointer; margin-right: 5px;">Refresh</button>
            <button id="close-diagnostic" style="background: #888; color: white; border: none; padding: 5px; cursor: pointer;">Close</button>
            <button id="reinit-connection" style="background: #47A447; color: white; border: none; padding: 5px; cursor: pointer; margin-left: 5px;">Reinitialize</button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Add event listeners
    document.getElementById('refresh-diagnostic').addEventListener('click', updateDiagnosticInfo);
    document.getElementById('close-diagnostic').addEventListener('click', () => panel.remove());
    document.getElementById('reinit-connection').addEventListener('click', reinitializeConnection);
    
    // Initial update
    updateDiagnosticInfo();
    
    return panel;
}

// Update the diagnostic information
function updateDiagnosticInfo() {
    const content = document.getElementById('diagnostic-content');
    if (!content) return;
    
    let info = `
        <div>ConnectionManager defined: ${typeof ConnectionManager !== 'undefined'}</div>
        <div>SimpleWebRTC defined: ${typeof SimpleWebRTC !== 'undefined'}</div>
        <div>AppState defined: ${typeof AppState !== 'undefined'}</div>
        <div>MinesweeperGame defined: ${typeof MinesweeperGame !== 'undefined'}</div>
        <hr>
    `;
    
    // Check ConnectionManager details if available
    if (typeof ConnectionManager !== 'undefined') {
        info += `
            <div>ConnectionManager.playerId: ${ConnectionManager.playerId || 'Not set'}</div>
            <div>ConnectionManager.isRoomCreator: ${ConnectionManager.isRoomCreator}</div>
            <div>ConnectionManager.roomId: ${ConnectionManager.roomId || 'Not set'}</div>
            <div>Players count: ${Object.keys(ConnectionManager.players || {}).length}</div>
        `;
        
        // Add WebRTC info if available
        if (typeof SimpleWebRTC !== 'undefined') {
            info += `
                <div>WebRTC state:</div>
                <div>- isConnected: ${SimpleWebRTC.state?.isConnected}</div>
                <div>- isConnecting: ${SimpleWebRTC.state?.isConnecting}</div>
                <div>- isInitiator: ${SimpleWebRTC.state?.isInitiator}</div>
                <div>- connection: ${SimpleWebRTC.state?.connection ? 'Created' : 'Null'}</div>
                <div>- channel: ${SimpleWebRTC.state?.channel ? 'Created' : 'Null'}</div>
            `;
        }
    }
    
    // Add AppState info if available
    if (typeof AppState !== 'undefined') {
        info += `
            <hr>
            <div>AppState:</div>
            <div>- playerName: ${AppState.playerName || 'Not set'}</div>
            <div>- playerId: ${AppState.playerId || 'Not set'}</div>
            <div>- currentGame: ${AppState.currentGame || 'None'}</div>
            <div>- roomId: ${AppState.roomId || 'Not set'}</div>
            <div>- isRoomCreator: ${AppState.isRoomCreator}</div>
        `;
    }
    
    // Add browser WebRTC support info
    info += `
        <hr>
        <div>Browser WebRTC Support:</div>
        <div>- RTCPeerConnection: ${typeof RTCPeerConnection !== 'undefined'}</div>
        <div>- getUserMedia: ${typeof navigator.mediaDevices?.getUserMedia !== 'undefined'}</div>
        <div>- Navigator Platform: ${navigator.platform}</div>
        <div>- User Agent: ${navigator.userAgent.substring(0, 50)}...</div>
    `;
    
    content.innerHTML = info;
}

// Reinitialize the ConnectionManager
function reinitializeConnection() {
    if (typeof ConnectionManager === 'undefined') {
        alert('ConnectionManager is not defined. Cannot reinitialize.');
        return;
    }
    
    const playerName = localStorage.getItem('playerName');
    if (!playerName) {
        alert('No player name found. Please enter your name first.');
        return;
    }
    
    try {
        // If ConnectionManager has a disconnect method, call it first
        if (typeof ConnectionManager.disconnect === 'function') {
            ConnectionManager.disconnect();
        }
        
        // Reinitialize
        ConnectionManager.init({
            playerName: playerName
        });
        
        // Update diagnostic info
        updateDiagnosticInfo();
        
        alert('ConnectionManager reinitialized successfully!');
    } catch (error) {
        alert('Error reinitializing ConnectionManager: ' + error.message);
        console.error('Reinitialization error:', error);
    }
}

// Test script loading by adding a global flag
window._scriptsLoaded = window._scriptsLoaded || {};

// Add this to the end of each script file
// In webrtc.js
if (typeof window !== 'undefined') {
    window._scriptsLoaded.webrtc = true;
}

// In connection-manager.js
if (typeof window !== 'undefined') {
    window._scriptsLoaded.connectionManager = true;
}

// In game-modules.js
if (typeof window !== 'undefined') {
    window._scriptsLoaded.gameModules = true;
}

// In minesweeper.js
if (typeof window !== 'undefined') {
    window._scriptsLoaded.minesweeper = true;
}

// In app.js
if (typeof window !== 'undefined') {
    window._scriptsLoaded.app = true;
}

// Add a "Show Diagnostics" button to the page
function addDiagnosticsButton() {
    const button = document.createElement('button');
    button.innerHTML = 'Show Diagnostics';
    button.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 10px;
        background: #4a6fa5;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        z-index: 10000;
    `;
    
    button.addEventListener('click', () => {
        if (document.getElementById('diagnostic-panel')) {
            document.getElementById('diagnostic-panel').remove();
        } else {
            createDiagnosticPanel();
        }
    });
    
    document.body.appendChild(button);
}

// Call this to add the diagnostics button to the page
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(addDiagnosticsButton, 1000);
    });
}