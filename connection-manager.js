/**
 * Connection Manager for Mentalplayer
 * Integrates SimpleWebRTC with the main application
 */

const ConnectionManager = {
    // State
    webrtc: null,
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
        manualConnectionContainer: null,
        answerInputContainer: null
    },
    
    /**
     * Initialize the connection manager
     * @param {Object} options Configuration options
     */
    init: function(options = {}) {
        console.log('Initializing Connection Manager...');
        
        // Load SimpleWebRTC if not already available
        if (typeof SimpleWebRTC === 'undefined') {
            this.loadScript('./webrtc.js', () => {
                this.continueInit(options);
            });
        } else {
            this.continueInit(options);
        }
    },
    
    /**
     * Continue initialization after ensuring SimpleWebRTC is loaded
     * @param {Object} options Configuration options
     */
    continueInit: function(options) {
        // Set player info
        this.playerName = options.playerName || localStorage.getItem('playerName') || 'Player';
        this.elements.playerDisplay.textContent = this.playerName;
        
        // Update UI elements if they've changed
        this.updateUIElements();
        
        // Initialize WebRTC
        this.webrtc = SimpleWebRTC;
        this.playerId = this.webrtc.init({
            callbacks: {
                onConnected: () => this.handleConnected(),
                onDisconnected: () => this.handleDisconnected(),
                onMessage: (message) => this.handleMessage(message),
                onError: (message, error) => this.handleError(message, error),
                onStatusChange: (status, message) => this.updateConnectionStatus(status, message)
            }
        });
        
        // Update connection ID display
        if (this.elements.myConnectionId) {
            this.elements.myConnectionId.textContent = this.playerId;
        }
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('Connection Manager initialized with ID:', this.playerId);
    },
    
    /**
     * Update UI element references
     * This ensures we have the latest elements if they've been recreated
     */
    updateUIElements: function() {
        // Update basic elements
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
        // Find elements
        const createRoomButton = document.getElementById('create-room');
        const joinRoomButton = document.getElementById('join-room');
        const roomIdInput = document.getElementById('room-id');
        const invitePlayersButton = document.getElementById('invite-players');
        const copyMyIdButton = document.getElementById('copy-my-id');
        const connectToFriendButton = document.getElementById('connect-to-friend');
        const friendIdInput = document.getElementById('friend-id');
        
        // Create room button
        if (createRoomButton) {
            createRoomButton.addEventListener('click', () => this.createRoom());
        }
        
        // Join room button
        if (joinRoomButton) {
            joinRoomButton.addEventListener('click', () => {
                const roomId = roomIdInput ? roomIdInput.value.trim() : '';
                if (roomId) {
                    this.joinRoom(roomId);
                } else {
                    this.showManualConnectionInput();
                }
            });
        }
        
        // Invite players button
        if (invitePlayersButton) {
            invitePlayersButton.addEventListener('click', () => this.showInviteModal());
        }
        
        // Copy my ID button
        if (copyMyIdButton) {
            copyMyIdButton.addEventListener('click', () => {
                this.copyToClipboard(this.playerId);
                copyMyIdButton.textContent = 'Copied!';
                setTimeout(() => {
                    copyMyIdButton.innerHTML = '<i class="fas fa-copy"></i> Copy';
                }, 2000);
            });
        }
        
        // Connect to friend button
        if (connectToFriendButton && friendIdInput) {
            connectToFriendButton.addEventListener('click', () => {
                const friendId = friendIdInput.value.trim();
                if (friendId) {
                    this.joinRoom(friendId);
                } else {
                    alert('Please enter your friend\'s ID');
                }
            });
        }
    },
    
    /**
     * Create a new room as initiator
     */
    async createRoom() {
        // Ensure a game is selected
        if (!this.gameModule) {
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
        this.roomId = this.playerId; // Use player ID as room ID
        
        // Update UI
        this.updateRoomInfo();
        
        // Create WebRTC connection
        this.updateConnectionStatus('connecting', 'Creating room...');
        const connectionInfo = await this.webrtc.createConnection();
        
        if (connectionInfo) {
            // Show connection info for manual sharing
            this.showConnectionInfo(connectionInfo);
        } else {
            this.updateConnectionStatus('error', 'Failed to create room');
            alert('Failed to create room. Please try again.');
        }
    },
    
    /**
     * Join an existing room as responder
     * @param {string} roomId Room ID to join
     */
    async joinRoom(roomId) {
        if (!roomId) return;
        
        // Check if trying to join own room
        if (roomId === this.playerId) {
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
        
        // Try to join as a direct ID first
        this.updateConnectionStatus('connecting', 'Joining room...');
        
        // If it looks like a connection info object, parse it
        if (roomId.length > 20 && (roomId.includes('{') || roomId.includes('['))) {
            try {
                const connectionInfo = JSON.parse(roomId);
                await this.processConnectionInfo(connectionInfo);
                return;
            } catch (e) {
                console.log('Not a valid connection info object, trying as room ID');
            }
        }
        
        // Otherwise, show manual connection input
        this.showManualConnectionInput(roomId);
    },
    
    /**
     * Process connection info object
     * @param {Object} connectionInfo Connection information
     */
    async processConnectionInfo(connectionInfo) {
        if (!connectionInfo || !connectionInfo.type) {
            alert('Invalid connection information. Please try again.');
            return;
        }
        
        if (connectionInfo.type === 'offer') {
            // Process as an offer (join as responder)
            this.isRoomCreator = false;
            this.roomId = connectionInfo.initiatorId;
            
            // Update UI
            this.updateRoomInfo();
            
            // Join WebRTC connection
            const answerInfo = await this.webrtc.joinConnection(connectionInfo);
            
            if (answerInfo) {
                // Show answer info for manual sharing
                this.showAnswerInfo(answerInfo);
            } else {
                this.updateConnectionStatus('error', 'Failed to join room');
                alert('Failed to join room. Please try again.');
            }
        } else if (connectionInfo.type === 'answer') {
            // Process as an answer (as initiator)
            if (!this.isRoomCreator) {
                alert('Cannot process answer: not a room creator');
                return;
            }
            
            const result = await this.webrtc.processAnswer(connectionInfo);
            
            if (result) {
                this.updateConnectionStatus('connecting', 'Connection in progress...');
            } else {
                this.updateConnectionStatus('error', 'Failed to process answer');
                alert('Failed to process answer. Please try again.');
            }
        } else {
            alert('Unknown connection information type');
        }
    },
    
    /**
     * Leave the current room
     */
    leaveRoom() {
        // Disconnect WebRTC
        if (this.webrtc) {
            this.webrtc.disconnect();
        }
        
        // Reset state
        this.isRoomCreator = false;
        this.roomId = '';
        this.players = {};
        
        // Update UI
        if (this.elements.roomInfo) {
            this.elements.roomInfo.style.display = 'none';
        }
        
        // Update players list
        this.updatePlayersList();
        
        // Update connection status
        this.updateConnectionStatus('disconnected', 'Left room');
    },
    
    /**
     * Send data to connected peer
     * @param {Object} data Data to send
     * @returns {boolean} Success status
     */
    sendData(data) {
        if (!this.webrtc || !data) return false;
        
        return this.webrtc.sendData(data);
    },
    
    /**
     * Handle successful connection
     */
    handleConnected() {
        console.log('Connection established!');
        
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
            gameType: this.gameModule ? this.gameModule.type : null
        });
        
        // Update players list
        this.updatePlayersList();
        
        // Hide connection info
        this.hideConnectionInfo();
        
        // Show success notification
        this.showNotification('Connected!', 'Connection established successfully.', 'success');
    },
    
    /**
     * Handle disconnection
     */
    handleDisconnected() {
        console.log('Disconnected from peer');
        
        // Remove peer from players list
        const peerId = Object.keys(this.players).find(id => id !== this.playerId);
        if (peerId) {
            const playerName = this.players[peerId].name;
            delete this.players[peerId];
            this.updatePlayersList();
            
            // Show notification
            this.showNotification('Disconnected', `${playerName} has disconnected.`, 'warning');
        }
    },
    
    /**
     * Handle incoming messages
     * @param {Object} message Message data
     */
    handleMessage(message) {
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
                
                // If we're the room creator and they specified a game type, switch to it
                if (this.isRoomCreator && message.gameType && this.gameModule && this.gameModule.type !== message.gameType) {
                    this.selectGame(message.gameType);
                }
                break;
                
            case 'chat_message':
                this.addChatMessage(message.senderId, message.text);
                break;
                
            case 'game_data':
                // Pass to game module
                if (this.gameModule && this.gameModule.handleGameData) {
                    this.gameModule.handleGameData(message.data);
                }
                break;
                
            default:
                console.log('Unknown message type:', message.type);
                break;
        }
    },
    
    /**
     * Handle errors
     * @param {string} message Error message
     * @param {Error} error Error object
     */
    handleError(message, error) {
        console.error('Connection error:', message, error);
        
        // Show notification
        this.showNotification('Connection Error', message, 'error');
    },
    
    /**
     * Update connection status display
     * @param {string} status Status code
     * @param {string} message Status message
     */
    updateConnectionStatus(status, message) {
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
    updateRoomInfo() {
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
    updatePlayersList() {
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
    showConnectionInfo(connectionInfo) {
        // Create connection info container if it doesn't exist
        if (!document.getElementById('connection-info-container')) {
            const container = document.createElement('div');
            container.id = 'connection-info-container';
            container.className = 'manual-connection-container';
            
            const content = `
                <div class="connection-info-box">
                    <h3>Share this connection information</h3>
                    <p>Copy and share this text with the person you want to play with:</p>
                    <textarea id="connection-info-text" readonly rows="6" class="connection-text"></textarea>
                    <div class="connection-actions">
                        <button id="copy-connection-info" class="button primary-button">
                            <i class="fas fa-copy"></i> Copy
                        </button>
                        <button id="share-connection-info" class="button secondary-button">
                            <i class="fas fa-share-alt"></i> Share
                        </button>
                    </div>
                    <div id="answer-input-container">
                        <h3>Enter response from other player</h3>
                        <p>Paste the response you received from the other player:</p>
                        <textarea id="answer-input" rows="6" class="connection-text" placeholder="Paste answer here..."></textarea>
                        <button id="process-answer-button" class="button primary-button">Connect</button>
                    </div>
                </div>
            `;
            
            container.innerHTML = content;
            
            // Add to page after room info
            const roomInfo = document.getElementById('room-info');
            if (roomInfo && roomInfo.parentNode) {
                roomInfo.parentNode.insertBefore(container, roomInfo.nextSibling);
            } else {
                // Fallback - add to game container
                const gameContainer = document.getElementById('game-container');
                if (gameContainer) {
                    gameContainer.prepend(container);
                }
            }
            
            // Store reference to container
            this.elements.manualConnectionContainer = container;
            this.elements.answerInputContainer = document.getElementById('answer-input-container');
            
            // Set up event listeners
            document.getElementById('copy-connection-info').addEventListener('click', () => {
                const infoText = document.getElementById('connection-info-text');
                this.copyToClipboard(infoText.value);
                
                // Show success feedback
                const button = document.getElementById('copy-connection-info');
                const originalText = button.innerHTML;
                button.innerHTML = '<i class="fas fa-check"></i> Copied!';
                
                setTimeout(() => {
                    button.innerHTML = originalText;
                }, 2000);
            });
            
            document.getElementById('share-connection-info').addEventListener('click', () => {
                const infoText = document.getElementById('connection-info-text').value;
                this.shareText('Mentalplayer Connection', 'Join my game with this connection info:', infoText);
            });
            
            document.getElementById('process-answer-button').addEventListener('click', () => {
                const answerText = document.getElementById('answer-input').value.trim();
                if (answerText) {
                    try {
                        const answerInfo = JSON.parse(answerText);
                        this.processConnectionInfo(answerInfo);
                    } catch (e) {
                        alert('Invalid answer format. Please check and try again.');
                    }
                } else {
                    alert('Please paste the answer from the other player.');
                }
            });
        }
        
        // Update the connection info text
        const infoText = document.getElementById('connection-info-text');
        if (infoText) {
            infoText.value = JSON.stringify(connectionInfo);
        }
        
        // Show the container
        this.elements.manualConnectionContainer.style.display = 'block';
    },
    
    /**
     * Show answer info for responder
     * @param {Object} answerInfo Answer info to share
     */
    showAnswerInfo(answerInfo) {
        // Create answer info container if it doesn't exist
        if (!document.getElementById('answer-info-container')) {
            const container = document.createElement('div');
            container.id = 'answer-info-container';
            container.className = 'manual-connection-container';
            
            const content = `
                <div class="connection-info-box">
                    <h3>Share your response</h3>
                    <p>Copy and share this text with the person who invited you:</p>
                    <textarea id="answer-info-text" readonly rows="6" class="connection-text"></textarea>
                    <div class="connection-actions">
                        <button id="copy-answer-info" class="button primary-button">
                            <i class="fas fa-copy"></i> Copy
                        </button>
                        <button id="share-answer-info" class="button secondary-button">
                            <i class="fas fa-share-alt"></i> Share
                        </button>
                    </div>
                    <p class="connection-note">After sharing this, wait for the connection to be established.</p>
                </div>
            `;
            
            container.innerHTML = content;
            
            // Add to page after room info
            const roomInfo = document.getElementById('room-info');
            if (roomInfo && roomInfo.parentNode) {
                roomInfo.parentNode.insertBefore(container, roomInfo.nextSibling);
            } else {
                // Fallback - add to game container
                const gameContainer = document.getElementById('game-container');
                if (gameContainer) {
                    gameContainer.prepend(container);
                }
            }
            
            // Set up event listeners
            document.getElementById('copy-answer-info').addEventListener('click', () => {
                const infoText = document.getElementById('answer-info-text');
                this.copyToClipboard(infoText.value);
                
                // Show success feedback
                const button = document.getElementById('copy-answer-info');
                const originalText = button.innerHTML;
                button.innerHTML = '<i class="fas fa-check"></i> Copied!';
                
                setTimeout(() => {
                    button.innerHTML = originalText;
                }, 2000);
            });
            
            document.getElementById('share-answer-info').addEventListener('click', () => {
                const infoText = document.getElementById('answer-info-text').value;
                this.shareText('Mentalplayer Connection Response', 'Here is my response to join your game:', infoText);
            });
        }
        
        // Update the answer info text
        const infoText = document.getElementById('answer-info-text');
        if (infoText) {
            infoText.value = JSON.stringify(answerInfo);
        }
        
        // Show the container
        document.getElementById('answer-info-container').style.display = 'block';
    },
    
    /**
     * Hide connection info containers
     */
    hideConnectionInfo() {
        // Hide connection info
        const connectionInfoContainer = document.getElementById('connection-info-container');
        if (connectionInfoContainer) {
            connectionInfoContainer.style.display = 'none';
        }
        
        // Hide answer info
        const answerInfoContainer = document.getElementById('answer-info-container');
        if (answerInfoContainer) {
            answerInfoContainer.style.display = 'none';
        }
    },
    
    /**
     * Show manual connection input
     * @param {string} roomId Optional room ID to pre-fill
     */
    showManualConnectionInput(roomId = '') {
        // Show the manual connection modal
        const manualConnectionModal = document.getElementById('manual-connection-ui');
        if (manualConnectionModal) {
            // Update input if provided
            if (roomId) {
                const friendIdInput = document.getElementById('friend-id');
                if (friendIdInput) {
                    friendIdInput.value = roomId;
                }
            }
            
            manualConnectionModal.style.display = 'flex';
        } else {
            // Fallback to direct connection if modal not found
            if (roomId) {
                this.connectToRoom(roomId);
            } else {
                alert('Please enter a Room ID to connect.');
            }
        }
    },
    
    /**
     * Show invite modal
     */
    showInviteModal() {
        if (!this.roomId) {
            alert('Please create a room first.');
            return;
        }
        
        const inviteModal = document.getElementById('invite-modal');
        const inviteLink = document.getElementById('invite-link');
        
        if (inviteModal && inviteLink) {
            // Set the invite link - use URL with room ID for simplicity
            const url = new URL(window.location.href);
            url.searchParams.set('room', this.roomId);
            inviteLink.value = url.toString();
            
            // Show the modal
            inviteModal.style.display = 'flex';
        }
    },
    
    /**
     * Show troubleshooting guide
     */
    showTroubleshooting() {
        const troubleshootingModal = document.getElementById('connectivity-guide');
        if (troubleshootingModal) {
            troubleshootingModal.style.display = 'flex';
        }
    },
    
    /**
     * Add a chat message
     * @param {string} senderId Sender ID
     * @param {string} text Message text
     */
    addChatMessage(senderId, text) {
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
    sendChatMessage(text) {
        if (!text.trim()) return;
        
        // Add message to local chat
        this.addChatMessage(this.playerId, text);
        
        // Send to peer
        this.sendData({
            type: 'chat_message',
            text: text
        });
    },
    
    /**
     * Show a notification
     * @param {string} title Notification title
     * @param {string} message Notification message
     * @param {string} type Notification type (info, success, warning, error)
     */
    showNotification(title, message, type = 'info') {
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
    copyToClipboard(text) {
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
     * Share text via Web Share API or fallback to clipboard
     * @param {string} title Share title
     * @param {string} text Descriptive text
     * @param {string} data Data to share
     */
    shareText(title, text, data) {
        // Try to use Web Share API if available
        if (navigator.share) {
            navigator.share({
                title: title,
                text: text + '\n\n' + data
            }).catch(() => {
                // Fallback to clipboard
                this.copyToClipboard(data);
                alert('Connection info copied to clipboard. Please paste it to the other player.');
            });
        } else {
            // Fallback to clipboard
            this.copyToClipboard(data);
            alert('Connection info copied to clipboard. Please paste it to the other player.');
        }
    },
    
    /**
     * Load a script dynamically
     * @param {string} src Script source URL
     * @param {Function} callback Callback function when loaded
     */
    loadScript(src, callback) {
        const script = document.createElement('script');
        script.src = src;
        script.onload = callback;
        script.onerror = () => {
            console.error(`Failed to load script: ${src}`);
            alert(`Failed to load required script: ${src}. Please check your internet connection and try again.`);
        };
        document.head.appendChild(script);
    },
    
    /**
     * Play notification sound for new messages
     */
    playNotificationSound() {
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
     * @returns {string} Random color in hex format
     */
    getRandomColor() {
        const hue = Math.floor(Math.random() * 360);
        return `hsl(${hue}, 70%, 60%)`;
    },
    
    /**
     * Escape HTML to prevent XSS in chat
     * @param {string} text Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    /**
     * Select a game
     * @param {string} gameType Game type to select
     */
    selectGame(gameType) {
        // Find game module
        if (window.GameModules && window.GameModules[gameType]) {
            this.gameModule = window.GameModules[gameType];
            this.gameModule.init();
        } else {
            console.warn(`Game module not found: ${gameType}`);
        }
    }
};

// Create notification container
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
});

// Expose globally
window.ConnectionManager = ConnectionManager;
/**
 * Connection Manager for Mentalplayer
 * Integrates SimpleWebRTC with the main application
 */

const ConnectionManager = {
    // State
    webrtc: null,
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
        manualConnectionContainer: null,
        answerInputContainer: null
    },
    
    /**
     * Initialize the connection manager
     * @param {Object} options Configuration options
     */
    init: function(options = {}) {
        console.log('Initializing Connection Manager...');
        
        // Load SimpleWebRTC if not already available
        if (typeof SimpleWebRTC === 'undefined') {
            this.loadScript('./webrtc.js', () => {
                this.continueInit(options);
            });
        } else {
            this.continueInit(options);
        }
    },
    
    /**
     * Continue initialization after ensuring SimpleWebRTC is loaded
     * @param {Object} options Configuration options
     */
    continueInit: function(options) {
        // Set player info
        this.playerName = options.playerName || localStorage.getItem('playerName') || 'Player';
        this.elements.playerDisplay.textContent = this.playerName;
        
        // Update UI elements if they've changed
        this.updateUIElements();
        
        // Initialize WebRTC
        this.webrtc = SimpleWebRTC;
        this.playerId = this.webrtc.init({
            callbacks: {
                onConnected: () => this.handleConnected(),
                onDisconnected: () => this.handleDisconnected(),
                onMessage: (message) => this.handleMessage(message),
                onError: (message, error) => this.handleError(message, error),
                onStatusChange: (status, message) => this.updateConnectionStatus(status, message)
            }
        });
        
        // Update connection ID display
        if (this.elements.myConnectionId) {
            this.elements.myConnectionId.textContent = this.playerId;
        }
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('Connection Manager initialized with ID:', this.playerId);
    },
    
    /**
     * Update UI element references
     * This ensures we have the latest elements if they've been recreated
     */
    updateUIElements: function() {
        // Update basic elements
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
        // Find elements
        const createRoomButton = document.getElementById('create-room');
        const joinRoomButton = document.getElementById('join-room');
        const roomIdInput = document.getElementById('room-id');
        const invitePlayersButton = document.getElementById('invite-players');
        const copyMyIdButton = document.getElementById('copy-my-id');
        const connectToFriendButton = document.getElementById('connect-to-friend');
        const friendIdInput = document.getElementById('friend-id');
        
        // Create room button
        if (createRoomButton) {
            createRoomButton.addEventListener('click', () => this.createRoom());
        }
        
        // Join room button
        if (joinRoomButton) {
            joinRoomButton.addEventListener('click', () => {
                const roomId = roomIdInput ? roomIdInput.value.trim() : '';
                if (roomId) {
                    this.joinRoom(roomId);
                } else {
                    this.showManualConnectionInput();
                }
            });
        }
        
        // Invite players button
        if (invitePlayersButton) {
            invitePlayersButton.addEventListener('click', () => this.showInviteModal());
        }
        
        // Copy my ID button
        if (copyMyIdButton) {
            copyMyIdButton.addEventListener('click', () => {
                this.copyToClipboard(this.playerId);
                copyMyIdButton.textContent = 'Copied!';
                setTimeout(() => {
                    copyMyIdButton.innerHTML = '<i class="fas fa-copy"></i> Copy';
                }, 2000);
            });
        }
        
        // Connect to friend button
        if (connectToFriendButton && friendIdInput) {
            connectToFriendButton.addEventListener('click', () => {
                const friendId = friendIdInput.value.trim();
                if (friendId) {
                    this.joinRoom(friendId);
                } else {
                    alert('Please enter your friend\'s ID');
                }
            });
        }
    },
    
    /**
     * Create a new room as initiator
     */
    async createRoom: function() {
        // Ensure a game is selected
        if (!this.gameModule) {
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
        this.roomId = this.playerId; // Use player ID as room ID
        
        // Update UI
        this.updateRoomInfo();
        
        // Create WebRTC connection
        this.updateConnectionStatus('connecting', 'Creating room...');
        const connectionInfo = await this.webrtc.createConnection();
        
        if (connectionInfo) {
            // Show connection info for manual sharing
            this.showConnectionInfo(connectionInfo);
        } else {
            this.updateConnectionStatus('error', 'Failed to create room');
            alert('Failed to create room. Please try again.');
        }
    },
    
    /**
     * Join an existing room as responder
     * @param {string} roomId Room ID to join
     */
    async joinRoom: function(roomId) {
        if (!roomId) return;
        
        // Check if trying to join own room
        if (roomId === this.playerId) {
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
        
        // Try to join as a direct ID first
        this.updateConnectionStatus('connecting', 'Joining room...');
        
        // If it looks like a connection info object, parse it
        if (roomId.length > 20 && (roomId.includes('{') || roomId.includes('['))) {
            try {
                const connectionInfo = JSON.parse(roomId);
                await this.processConnectionInfo(connectionInfo);
                return;
            } catch (e) {
                console.log('Not a valid connection info object, trying as room ID');
            }
        }
        
        // Otherwise, show manual connection input
        this.showManualConnectionInput(roomId);
    },
    
    /**
     * Process connection info object
     * @param {Object} connectionInfo Connection information
     */
    async processConnectionInfo: function(connectionInfo) {
        if (!connectionInfo || !connectionInfo.type) {
            alert('Invalid connection information. Please try again.');
            return;
        }
        
        if (connectionInfo.type === 'offer') {
            // Process as an offer (join as responder)
            this.isRoomCreator = false;
            this.roomId = connectionInfo.initiatorId;
            
            // Update UI
            this.updateRoomInfo();
            
            // Join WebRTC connection
            const answerInfo = await this.webrtc.joinConnection(connectionInfo);
            
            if (answerInfo) {
                // Show answer info for manual sharing
                this.showAnswerInfo(answerInfo);
            } else {
                this.updateConnectionStatus('error', 'Failed to join room');
                alert('Failed to join room. Please try again.');
            }
        } else if (connectionInfo.type === 'answer') {
            // Process as an answer (as initiator)
            if (!this.isRoomCreator) {
                alert('Cannot process answer: not a room creator');
                return;
            }
            
            const result = await this.webrtc.processAnswer(connectionInfo);
            
            if (result) {
                this.updateConnectionStatus('connecting', 'Connection in progress...');
            } else {
                this.updateConnectionStatus('error', 'Failed to process answer');
                alert('Failed to process answer. Please try again.');
            }
        } else {
            alert('Unknown connection information type');
        }
    },
    
    /**
     * Leave the current room
     */
    leaveRoom: function() {
        // Disconnect WebRTC
        if (this.webrtc) {
            this.webrtc.disconnect();
        }
        
        // Reset state
        this.isRoomCreator = false;
        this.roomId = '';
        this.players = {};
        
        // Update UI
        if (this.elements.roomInfo) {
            this.elements.roomInfo.style.display = 'none';
        }
        
        // Update players list
        this.updatePlayersList();
        
        // Update connection status
        this.updateConnectionStatus('disconnected', 'Left room');
    },
    
    /**
     * Send data to connected peer
     * @param {Object} data Data to send
     * @returns {boolean} Success status
     */
    sendData: function(data) {
        if (!this.webrtc || !data) return false;
        
        return this.webrtc.sendData(data);
    },
    
    /**
     * Handle successful connection
     */
    handleConnected: function() {
        console.log('Connection established!');
        
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
            gameType: this.gameModule ? this.gameModule.type : null
        });
        
        // Update players list
        this.updatePlayersList();
        
        // Hide connection info
        this.hideConnectionInfo();
        
        // Show success notification
        this.showNotification('Connected!', 'Connection established successfully.', 'success');
    },
    
    /**
     * Handle disconnection