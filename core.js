/**
 * MentalPlayer - Main Application Core
 * A modular multiplayer puzzle game platform
 * 
 * @version 2.0.0
 */

// Create main namespace
const MentalPlayer = (() => {
    // Private members
    
    // Application state
    const state = {
        user: {
            id: '',
            name: '',
        },
        connection: {
            status: 'disconnected', // disconnected, connecting, connected, error
            roomId: '',
            isHost: false,
            peers: {}
        },
        activeGame: {
            id: null,
            instance: null,
            config: {}
        },
        ui: {
            initialized: false,
            currentView: 'gameSelect' // gameSelect, gameActive
        }
    };
    
    // Element references (populated during init)
    const elements = {
        // Main sections
        gameSelect: null,
        gameGrid: null,
        gameContainer: null,
        sidePanel: null,
        
        // Game elements
        gameControls: null,
        gameTitle: null,
        activeGameContent: null,
        
        // User & connection
        playerDisplay: null,
        connectionStatus: null,
        
        // Room controls
        roomIdInput: null,
        createRoomBtn: null,
        joinRoomBtn: null,
        inviteBtn: null,
        backBtn: null,
        
        // Room info
        roomInfo: null,
        currentRoomId: null,
        playersContainer: null,
        
        // Chat
        chatMessages: null,
        chatInput: null,
        sendMessageBtn: null,
        
        // Modals
        entryModal: null,
        playerNameInput: null,
        continueBtn: null,
        gameOverModal: null
    };
    
    /**
     * Initialize the application
     */
    function init() {
        console.log('[MentalPlayer] Initializing application...');
        
        // Set random ID for this user
        state.user.id = generateId();
        
        // Initialize element references
        initElementReferences();
        
        // Set up event listeners
        setupEventListeners();
        
        // Check for saved user data
        loadUserData();
        
        // Check URL for room invites
        checkUrlForInvite();
        
        // Set UI initialization flag
        state.ui.initialized = true;
        
        console.log('[MentalPlayer] Initialization complete');
    }
    
    /**
     * Initialize element references for easier access
     */
    function initElementReferences() {
        // Main sections
        elements.gameSelect = document.getElementById('game-select');
        elements.gameGrid = document.getElementById('game-grid');
        elements.gameContainer = document.getElementById('game-container');
        elements.sidePanel = document.getElementById('side-panel');
        
        // Game elements
        elements.gameControls = document.getElementById('game-controls');
        elements.gameTitle = document.getElementById('current-game-title');
        elements.activeGameContent = document.getElementById('active-game-content');
        
        // User & connection elements
        elements.playerDisplay = document.getElementById('player-display');
        elements.connectionStatus = document.getElementById('connection-status');
        
        // Room controls
        elements.roomIdInput = document.getElementById('room-id');
        elements.createRoomBtn = document.getElementById('create-room');
        elements.joinRoomBtn = document.getElementById('join-room');
        elements.inviteBtn = document.getElementById('invite-players');
        elements.backBtn = document.getElementById('back-to-games');
        
        // Room info
        elements.roomInfo = document.getElementById('room-info');
        elements.currentRoomId = document.getElementById('current-room-id');
        elements.playersContainer = document.getElementById('players-container');
        
        // Chat
        elements.chatMessages = document.getElementById('chat-messages');
        elements.chatInput = document.getElementById('chat-input');
        elements.sendMessageBtn = document.getElementById('send-message');
        
        // Modals
        elements.entryModal = document.getElementById('entry-modal');
        elements.playerNameInput = document.getElementById('player-name-input');
        elements.continueBtn = document.getElementById('continue-button');
        elements.gameOverModal = document.getElementById('game-over-modal');
        elements.inviteModal = document.getElementById('invite-modal');
        elements.inviteLink = document.getElementById('invite-link');
        elements.copyLinkBtn = document.getElementById('copy-link');
        elements.closeInviteModalBtn = document.getElementById('close-invite-modal');
        
        // Other modal buttons
        elements.closeGameOverBtn = document.getElementById('close-game-over-modal');
        elements.retryConnectionBtn = document.getElementById('retry-connection-button');
        elements.closeConnectionErrorBtn = document.getElementById('close-connection-error-modal');
        elements.showTroubleshootingBtn = document.getElementById('show-troubleshooting');
        elements.closeConnectivityGuideBtn = document.getElementById('close-connectivity-guide');
        
        // Footer links
        elements.privacyLink = document.getElementById('privacy-link');
        elements.aboutLink = document.getElementById('about-link');
    }
    
    /**
     * Set up event listeners for UI elements
     */
    function setupEventListeners() {
        // Player name entry
        if (elements.continueBtn) {
            elements.continueBtn.addEventListener('click', handleNameSubmit);
        }
        if (elements.playerNameInput) {
            elements.playerNameInput.addEventListener('keypress', e => {
                if (e.key === 'Enter') handleNameSubmit();
            });
        }
        
        // Game navigation
        if (elements.backBtn) {
            elements.backBtn.addEventListener('click', () => {
                showView('gameSelect');
            });
        }
        
        // Room controls
        if (elements.createRoomBtn) {
            elements.createRoomBtn.addEventListener('click', createRoom);
        }
        if (elements.joinRoomBtn) {
            elements.joinRoomBtn.addEventListener('click', joinRoom);
        }
        if (elements.inviteBtn) {
            elements.inviteBtn.addEventListener('click', showInviteModal);
        }
        
        // Room ID input
        if (elements.roomIdInput) {
            elements.roomIdInput.addEventListener('keypress', e => {
                if (e.key === 'Enter') joinRoom();
            });
        }
        
        // Chat
        if (elements.sendMessageBtn) {
            elements.sendMessageBtn.addEventListener('click', sendChatMessage);
        }
        if (elements.chatInput) {
            elements.chatInput.addEventListener('keypress', e => {
                if (e.key === 'Enter') sendChatMessage();
            });
        }
        
        // Modal buttons
        if (elements.closeGameOverBtn) {
            elements.closeGameOverBtn.addEventListener('click', () => {
                if (elements.gameOverModal) {
                    elements.gameOverModal.style.display = 'none';
                }
            });
        }
        
        if (elements.copyLinkBtn) {
            elements.copyLinkBtn.addEventListener('click', copyInviteLink);
        }
        
        if (elements.closeInviteModalBtn) {
            elements.closeInviteModalBtn.addEventListener('click', () => {
                if (elements.inviteModal) {
                    elements.inviteModal.style.display = 'none';
                }
            });
        }
        
        // Share buttons
        document.querySelectorAll('.share-button').forEach(btn => {
            btn.addEventListener('click', () => {
                const shareType = btn.dataset.share;
                if (shareType && typeof window[`shareVia${shareType.charAt(0).toUpperCase() + shareType.slice(1)}`] === 'function') {
                    window[`shareVia${shareType.charAt(0).toUpperCase() + shareType.slice(1)}`]();
                }
            });
        });
        
        // Troubleshooting guide
        if (elements.showTroubleshootingBtn) {
            elements.showTroubleshootingBtn.addEventListener('click', () => {
                const guide = document.getElementById('connectivity-guide');
                if (guide) guide.style.display = 'flex';
            });
        }
        
        if (elements.closeConnectivityGuideBtn) {
            elements.closeConnectivityGuideBtn.addEventListener('click', () => {
                const guide = document.getElementById('connectivity-guide');
                if (guide) guide.style.display = 'none';
            });
        }
        
        // Footer links
        if (elements.privacyLink) {
            elements.privacyLink.addEventListener('click', event => {
                event.preventDefault();
                showPrivacyPolicy();
            });
        }
        
        if (elements.aboutLink) {
            elements.aboutLink.addEventListener('click', event => {
                event.preventDefault();
                showAbout();
            });
        }
        
        // Click outside modals to close - with special handling for the entry modal
        window.addEventListener('click', event => {
            if (event.target.classList.contains('modal')) {
                // Don't allow clicking outside for name entry modal
                const modalId = event.target.id;
                if (modalId !== 'entry-modal') {
                    // Only non-essential modals can be closed by clicking outside
                    event.target.style.display = 'none';
                } else {
                    // Add a subtle shake effect to indicate the modal can't be dismissed
                    const modalContent = document.querySelector('#entry-modal .modal-content');
                    if (modalContent) {
                        modalContent.classList.add('shake-effect');
                        setTimeout(() => {
                            modalContent.classList.remove('shake-effect');
                        }, 500);
                    }
                }
            }
        });
    }
    
    /**
     * Set up dynamic game cards from the registry
     */
    function setupGameCards() {
        // Clear existing game cards
        if (elements.gameGrid) {
            elements.gameGrid.innerHTML = '';
        }
        
        // Get games from registry
        const games = window.GameRegistry ? window.GameRegistry.getRegisteredGames() : [];
        
        // Add game cards
        games.forEach(game => {
            const card = createGameCard(game);
            if (elements.gameGrid) {
                elements.gameGrid.appendChild(card);
            }
        });
        
        // Add placeholder cards for upcoming games
        const comingSoonCard = document.createElement('div');
        comingSoonCard.className = 'game-card coming-soon';
        comingSoonCard.innerHTML = `
            <div class="game-icon">🎮</div>
            <h3>Coming Soon</h3>
            <p>More multiplayer games on the way!</p>
        `;
        
        if (elements.gameGrid) {
            elements.gameGrid.appendChild(comingSoonCard.cloneNode(true));
            elements.gameGrid.appendChild(comingSoonCard.cloneNode(true));
        }
    }
    
    /**
     * Create a game card element
     * @param {Object} game Game definition from registry
     * @returns {HTMLElement} Game card element
     */
    function createGameCard(game) {
        const card = document.createElement('div');
        card.className = 'game-card';
        card.dataset.game = game.id;
        
        card.innerHTML = `
            <div class="game-icon">${game.icon || '🎮'}</div>
            <h3>${game.name || game.id}</h3>
            <p>${game.description || 'A multiplayer puzzle game'}</p>
        `;
        
        // Add click handler to load the game
        card.addEventListener('click', () => {
            loadGame(game.id);
        });
        
        return card;
    }
    
    /**
     * Load a game
     * @param {string} gameId Game identifier
     */
    function loadGame(gameId) {
        console.log(`[MentalPlayer] Loading game: ${gameId}`);
        
        // Check if game exists in registry
        if (!window.GameRegistry || !window.GameRegistry.getGame(gameId)) {
            console.error(`[MentalPlayer] Game not found: ${gameId}`);
            showNotification('Error', `Game "${gameId}" not found`, 'error');
            return;
        }
        
        // Get game module from registry
        const gameModule = window.GameRegistry.getGame(gameId);
        
        // Update state
        state.activeGame.id = gameId;
        state.activeGame.instance = gameModule;
        
        // Switch to game view
        showView('gameActive');
        
        // Update game title
        if (elements.gameTitle) {
            elements.gameTitle.textContent = gameModule.name || gameId;
        }
        
        // Clear previous game content
        if (elements.activeGameContent) {
            elements.activeGameContent.innerHTML = '';
        }
        
        // Initialize game in container
        if (typeof gameModule.init === 'function') {
            gameModule.init(elements.activeGameContent, {
                // Pass context to game module
                state: state,
                connection: window.ConnectionManager,
                sendMessage: (type, data) => {
                    // Broadcast game message to other players
                    if (window.ConnectionManager) {
                        window.ConnectionManager.sendData({
                            type: type,
                            gameId: gameId,
                            data: data
                        });
                    }
                }
            });
        }
        
        // Update game controls
        updateGameControls(gameModule);
        
        // Notify peers about game switch if in a room
        if (state.connection.status === 'connected' && window.ConnectionManager) {
            window.ConnectionManager.sendData({
                type: 'game_switch',
                gameId: gameId
            });
        }
    }
    
    /**
     * Update game-specific controls
     * @param {Object} gameModule Game module from registry
     */
    function updateGameControls(gameModule) {
        // Clear existing controls
        if (elements.gameControls) {
            elements.gameControls.innerHTML = '';
        }
        
        // If game has custom controls, add them
        if (gameModule.controls) {
            // Add game-specific control elements
            const controlsContainer = document.createElement('div');
            controlsContainer.className = 'game-specific-controls';
            controlsContainer.innerHTML = gameModule.controls;
            
            if (elements.gameControls) {
                elements.gameControls.appendChild(controlsContainer);
            }
            
            // Set up control events if needed
            if (typeof gameModule.setupControls === 'function') {
                gameModule.setupControls(controlsContainer);
            }
        }
    }
    
    /**
     * Switch between main views (game selection vs active game)
     * @param {string} viewName View name to show ('gameSelect' or 'gameActive')
     */
    function showView(viewName) {
        if (!state.ui.initialized) return;
        
        // Handle connection closure if going from game to selection
        if (state.ui.currentView === 'gameActive' && viewName === 'gameSelect' && state.connection.status === 'connected') {
            // Ask for confirmation
            if (!confirm('Leaving the game will disconnect you from the current room. Continue?')) {
                return;
            }
            
            // Clean up connection if user confirms
            leaveRoom();
        }
        
        // Update state
        state.ui.currentView = viewName;
        
        // Update visibility
        if (elements.gameSelect) {
            elements.gameSelect.style.display = viewName === 'gameSelect' ? 'block' : 'none';
        }
        
        if (elements.gameContainer) {
            elements.gameContainer.style.display = viewName === 'gameActive' ? 'block' : 'none';
        }
        
        if (elements.sidePanel) {
            elements.sidePanel.style.display = viewName === 'gameActive' ? 'flex' : 'none';
        }
        
        // Refresh game cards if showing selection
        if (viewName === 'gameSelect') {
            setupGameCards();
            
            // Reset active game
            state.activeGame.id = null;
            state.activeGame.instance = null;
        }
    }
    
    /**
     * Handle player name submission
     */
    function handleNameSubmit() {
        if (!elements.playerNameInput) return;
        
        const name = elements.playerNameInput.value.trim();
        if (!name) {
            showNotification('Error', 'Please enter your name to continue', 'error');
            return;
        }
        
        // Save name
        state.user.name = name;
        saveUserData();
        
        // Update UI
        updatePlayerDisplay();
        
        // Close modal
        if (elements.entryModal) {
            elements.entryModal.style.display = 'none';
        }
        
        // Initialize game cards
        setupGameCards();
        
        // Initialize connection manager if available
        if (window.ConnectionManager && typeof window.ConnectionManager.init === 'function') {
            window.ConnectionManager.init({
                userId: state.user.id,
                userName: state.user.name,
                // Connect state updating
                onStateChange: connectionStateChanged
            });
        }
        
        // Check URL for invite
        checkUrlForInvite(true);
        
        // Welcome notification
        showNotification('Welcome', 'Select a game to start playing!', 'success');
    }
    
    /**
     * Update the player display with current name
     */
    function updatePlayerDisplay() {
        if (!elements.playerDisplay) return;
        
        if (state.user.name) {
            elements.playerDisplay.innerHTML = `
                <span>${state.user.name}</span>
                <button id="change-name-button" class="small-button" title="Change Name">
                    <i class="fas fa-edit"></i>
                </button>
            `;
            
            // Add event listener for name change
            const changeNameBtn = document.getElementById('change-name-button');
            if (changeNameBtn) {
                changeNameBtn.addEventListener('click', showChangeNameDialog);
            }
        } else {
            elements.playerDisplay.textContent = 'Not logged in';
        }
    }
    
    /**
     * Show dialog to change player name
     */
    function showChangeNameDialog() {
        // Don't allow name change while in a room
        if (state.connection.status === 'connected') {
            showNotification('Not Allowed', 'You cannot change your name while in a room', 'warning');
            return;
        }
        
        const newName = prompt('Enter your new name:', state.user.name);
        if (newName && newName.trim()) {
            state.user.name = newName.trim();
            saveUserData();
            updatePlayerDisplay();
            
            // Update name in connection manager
            if (window.ConnectionManager && typeof window.ConnectionManager.updateUserInfo === 'function') {
                window.ConnectionManager.updateUserInfo({
                    userName: state.user.name
                });
            }
            
            showNotification('Name Updated', `Your name has been changed to ${state.user.name}`, 'success');
        }
    }
    
    /**
     * Create a new game room
     */
    function createRoom() {
        if (!state.activeGame.id) {
            showNotification('Select Game', 'Please select a game first', 'warning');
            return;
        }
        
        if (window.ConnectionManager && typeof window.ConnectionManager.createRoom === 'function') {
            window.ConnectionManager.createRoom();
        } else {
            console.error('[MentalPlayer] ConnectionManager not available');
            showNotification('Error', 'Connection system not available. Please refresh the page', 'error');
        }
    }
    
    /**
     * Join an existing room
     */
    function joinRoom() {
        if (!state.activeGame.id) {
            showNotification('Select Game', 'Please select a game first', 'warning');
            return;
        }
        
        const roomId = elements.roomIdInput ? elements.roomIdInput.value.trim() : '';
        if (!roomId) {
            showNotification('Room ID Required', 'Please enter a Room ID to join', 'warning');
            return;
        }
        
        if (window.ConnectionManager && typeof window.ConnectionManager.joinRoom === 'function') {
            window.ConnectionManager.joinRoom(roomId);
        } else {
            console.error('[MentalPlayer] ConnectionManager not available');
            showNotification('Error', 'Connection system not available. Please refresh the page', 'error');
        }
    }
    
    /**
     * Leave the current room
     */
    function leaveRoom() {
        if (window.ConnectionManager && typeof window.ConnectionManager.leaveRoom === 'function') {
            window.ConnectionManager.leaveRoom();
        }
    }
    
    /**
     * Show the invite modal
     */
    function showInviteModal() {
        if (state.connection.status !== 'connected') {
            showNotification('Not Connected', 'Please create a room first', 'warning');
            return;
        }
        
        // Generate invite link
        const url = new URL(window.location.href);
        
        // Remove any existing parameters
        url.search = '';
        
        // Add room ID
        url.searchParams.set('room', state.connection.roomId);
        
        // Add game ID
        if (state.activeGame.id) {
            url.searchParams.set('game', state.activeGame.id);
        }
        
        // Update invite link
        if (elements.inviteLink) {
            elements.inviteLink.value = url.toString();
        }
        
        // Show modal
        if (elements.inviteModal) {
            elements.inviteModal.style.display = 'flex';
        }
    }
    
    /**
     * Copy the invite link to clipboard
     */
    function copyInviteLink() {
        if (!elements.inviteLink) return;
        
        elements.inviteLink.select();
        document.execCommand('copy');
        
        // Visual feedback
        if (elements.copyLinkBtn) {
            const originalHtml = elements.copyLinkBtn.innerHTML;
            elements.copyLinkBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            
            setTimeout(() => {
                elements.copyLinkBtn.innerHTML = originalHtml;
            }, 2000);
        }
        
        showNotification('Copied', 'Link copied to clipboard', 'success');
    }
    
    /**
     * Share invite via WhatsApp
     */
    function shareViaWhatsApp() {
        if (!elements.inviteLink) return;
        
        const text = `Join me for a game on Mentalplayer! ${elements.inviteLink.value}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
    
    /**
     * Share invite via Email
     */
    function shareViaEmail() {
        if (!elements.inviteLink) return;
        
        const subject = "Join me on Mentalplayer";
        const body = `I'm playing a game on Mentalplayer and would like you to join! Click this link to join my room: ${elements.inviteLink.value}`;
        window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    }
    
    /**
     * Share invite via Facebook
     */
    function shareViaFacebook() {
        if (!elements.inviteLink) return;
        
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(elements.inviteLink.value)}`, '_blank', 'width=600,height=400');
    }
    
    /**
     * Share invite via Twitter
     */
    function shareViaTwitter() {
        if (!elements.inviteLink) return;
        
        const text = "Join me for a game on Mentalplayer!";
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(elements.inviteLink.value)}`, '_blank', 'width=600,height=400');
    }
    
    /**
     * Check URL for room invitation
     * @param {boolean} autoJoin Whether to automatically join room if found
     */
    function checkUrlForInvite(autoJoin = false) {
        const params = new URLSearchParams(window.location.search);
        const roomId = params.get('room');
        const gameId = params.get('game');
        
        // Update room ID input if present
        if (roomId && elements.roomIdInput) {
            elements.roomIdInput.value = roomId;
        }
        
        // Load game if specified
        if (gameId && autoJoin) {
            loadGame(gameId);
            
            // Join room after a delay to let game initialize
            if (roomId) {
                setTimeout(() => {
                    joinRoom();
                }, 1000);
            }
        }
    }
    
    /**
     * Send chat message
     */
    function sendChatMessage() {
        if (!elements.chatInput) return;
        
        const message = elements.chatInput.value.trim();
        if (!message) return;
        
        if (state.connection.status !== 'connected') {
            showNotification('Not Connected', 'You need to be in a room to send messages', 'warning');
            return;
        }
        
        console.log('[MentalPlayer] Sending chat message:', message);
        
        // Send message via connection manager
        if (window.ConnectionManager && typeof window.ConnectionManager.sendData === 'function') {
            window.ConnectionManager.sendData({
                type: 'chat_message',
                message: message
            });
            
            // Add to local chat immediately (this is important)
            addChatMessage(state.user.id, state.user.name, message);
            
            // Clear input
            elements.chatInput.value = '';
        }
    }
    
    /**
     * Add message to chat display
     * @param {string} userId User ID of sender
     * @param {string} userName User name of sender
     * @param {string} message Message text
     */
    function addChatMessage(userId, userName, message) {
        if (!elements.chatMessages) return;
    
        console.log(`[MentalPlayer] Adding chat message from ${userName}(${userId}): ${message}`);
    
        // Create message element
        const messageEl = document.createElement('div');
    
        if (userId === 'system') {
            // System message
            messageEl.className = 'system-message';
            messageEl.innerHTML = `<div class="message-text">${message}</div>`;
        } else {
            // User message
            const isOwnMessage = userId === state.user.id;
            messageEl.className = `chat-message ${isOwnMessage ? 'own-message' : 'peer-message'}`;
        
            // Add sender name for peer messages
            let html = '';
            if (!isOwnMessage) {
                // Try to get color from connection manager
                let color = '#808080';
                if (window.ConnectionManager && window.ConnectionManager.getPeerColor) {
                    color = window.ConnectionManager.getPeerColor(userId) || color;
                }
            
                html += `<div class="message-sender" style="color: ${color}">${userName}</div>`;
            }
        
            html += `<div class="message-text">${message}</div>`;
            messageEl.innerHTML = html;
        }
    
        // Add to chat
        elements.chatMessages.appendChild(messageEl);
    
        // Scroll to bottom
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }
    
    /**
     * Handle connection state changes
     * @param {Object} connectionState New connection state
     */
    function connectionStateChanged(connectionState) {
        console.log('[MentalPlayer] Connection state changed:', connectionState);
        
        // Update local state
        state.connection.status = connectionState.status;
        state.connection.roomId = connectionState.roomId;
        state.connection.isHost = connectionState.isHost;
        state.connection.peers = {...connectionState.peers};
        
        // Update connection status display
        updateConnectionStatus();
        
        // Update room info
        updateRoomInfo();
        
        // Update players list
        updatePlayersList();
        
        // Update active game if needed
        if (state.activeGame.instance && typeof state.activeGame.instance.onConnectionStateChanged === 'function') {
            state.activeGame.instance.onConnectionStateChanged(connectionState);
        }
    }
    
    /**
     * Update connection status display
     */
    function updateConnectionStatus() {
        if (!elements.connectionStatus) return;
        
        // Update class
        elements.connectionStatus.className = `connection-status ${state.connection.status}`;
        
        // Update text
        const statusText = state.connection.status.charAt(0).toUpperCase() + state.connection.status.slice(1);
        elements.connectionStatus.textContent = statusText;
    }
    
    /**
     * Update room info display
     */
    function updateRoomInfo() {
        if (!elements.roomInfo || !elements.currentRoomId) return;
        
        if (state.connection.roomId) {
            elements.roomInfo.style.display = 'block';
            elements.currentRoomId.textContent = state.connection.roomId;
        } else {
            elements.roomInfo.style.display = 'none';
        }
    }
    
    /**
     * Update players list display
     */
    function updatePlayersList() {
        if (!elements.playersContainer) return;
        
        console.log('[MentalPlayer] Updating players list:', state.connection.peers);
        
        // Clear existing players
        elements.playersContainer.innerHTML = '';
        
        // Add self
        const selfEl = document.createElement('div');
        selfEl.className = 'player current-player';
        
        // Get own color
        let ownColor = '#4a6fa5';
        if (window.ConnectionManager && window.ConnectionManager.getSelfColor) {
            ownColor = window.ConnectionManager.getSelfColor() || ownColor;
        }
        
        selfEl.innerHTML = `
            <div class="player-color" style="background-color: ${ownColor}"></div>
            <span>${state.user.name} (You)${state.connection.isHost ? ' (Host)' : ''}</span>
        `;
        elements.playersContainer.appendChild(selfEl);
        
        // Add peers
        Object.values(state.connection.peers).forEach(peer => {
            // Skip self (avoid duplicates)
            if (peer.id === state.user.id) return;
            
            const peerEl = document.createElement('div');
            peerEl.className = 'player';
            peerEl.innerHTML = `
                <div class="player-color" style="background-color: ${peer.color || '#808080'}"></div>
                <span>${peer.name}${peer.isHost ? ' (Host)' : ''}</span>
            `;
            elements.playersContainer.appendChild(peerEl);
        });
    }
    
    /**
     * Show privacy policy modal
     */
    function showPrivacyPolicy() {
        // Create modal from template
        const template = document.getElementById('modal-template');
        if (!template) return;
        
        const modal = template.content.cloneNode(true);
        const modalEl = modal.querySelector('.modal');
        const titleEl = modal.querySelector('.modal-title');
        const bodyEl = modal.querySelector('.modal-body');
        const buttonsEl = modal.querySelector('.modal-buttons');
        
        // Set content
        titleEl.textContent = 'Privacy Policy';
        bodyEl.innerHTML = `
            <h3>Information Collection</h3>
            <p>Mentalplayer uses cookies to store your chosen display name for convenience. No other personal information is collected or stored on our servers.</p>
            
            <h3>Peer-to-Peer Connections</h3>
            <p>This application uses direct peer-to-peer connections through WebRTC technology. Your connection ID is temporarily generated when you use the application but is not permanently stored.</p>
            
            <h3>Chat Messages</h3>
            <p>Chat messages are sent directly between peers and are not stored or monitored. Please be respectful in your communications with other players.</p>
            
            <h3>Analytics</h3>
            <p>Basic anonymous usage statistics may be collected to improve the application's performance and features.</p>
            
            <h3>Updates to This Policy</h3>
            <p>This policy may be updated from time to time. Please check back periodically for changes.</p>
        `;
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-button primary-button';
        closeBtn.textContent = 'Close';
        closeBtn.addEventListener('click', () => {
            modalEl.style.display = 'none';
            setTimeout(() => modalEl.remove(), 300);
        });
        buttonsEl.appendChild(closeBtn);
        
        // Add to document and show
        document.body.appendChild(modal);
        modalEl.style.display = 'flex';
    }
    
    /**
     * Show about modal
     */
    function showAbout() {
        // Create modal from template
        const template = document.getElementById('modal-template');
        if (!template) return;
        
        const modal = template.content.cloneNode(true);
        const modalEl = modal.querySelector('.modal');
        const titleEl = modal.querySelector('.modal-title');
        const bodyEl = modal.querySelector('.modal-body');
        const buttonsEl = modal.querySelector('.modal-buttons');
        
        // Set content
        titleEl.textContent = 'About Mentalplayer';
        bodyEl.innerHTML = `
            <p>Mentalplayer is a multiplayer gaming platform that lets you play classic games with friends using peer-to-peer technology.</p>
            
            <h3>How It Works</h3>
            <p>Mentalplayer uses WebRTC technology for direct peer-to-peer connections, allowing you to play with friends without a central server handling the gameplay.</p>
            
            <h3>Games</h3>
            <p>Currently featuring Minesweeper with more games coming soon!</p>
            
            <h3>Version</h3>
            <p>2.0.0 (March 2025)</p>
        `;
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-button primary-button';
        closeBtn.textContent = 'Close';
        closeBtn.addEventListener('click', () => {
            modalEl.style.display = 'none';
            setTimeout(() => modalEl.remove(), 300);
        });
        buttonsEl.appendChild(closeBtn);
        
        // Add to document and show
        document.body.appendChild(modal);
        modalEl.style.display = 'flex';
    }
    
    /**
     * Show notification
     * @param {string} title Notification title
     * @param {string} message Notification message
     * @param {string} type Notification type (info, success, warning, error)
     */
    function showNotification(title, message, type = 'info') {
        // Create notification container if not exists
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            document.body.appendChild(container);
        }
        
        // Create notification element
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
        
        // Add close handler
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.add('notification-hiding');
            setTimeout(() => notification.remove(), 300);
        });
        
        // Add to container
        container.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.add('notification-hiding');
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }
    
    /**
     * Generate random ID for player
     * @returns {string} Random ID
     */
    function generateId() {
        return Math.random().toString(36).substring(2, 10).toUpperCase();
    }
    
    /**
     * Save user data to localStorage
     */
    function saveUserData() {
        if (window.localStorage) {
            localStorage.setItem('mentalplayer_username', state.user.name);
        }
    }
    
    /**
     * Load user data from localStorage
     */
    function loadUserData() {
        if (window.localStorage) {
            const savedName = localStorage.getItem('mentalplayer_username');
            if (savedName) {
                state.user.name = savedName;
                
                // Auto-fill name input
                if (elements.playerNameInput) {
                    elements.playerNameInput.value = savedName;
                }
            }
        }
    }
    
    /**
     * Handle game message from peers
     * @param {string} peerId ID of the sending peer
     * @param {Object} data Message data
     */
    function handleGameMessage(peerId, data) {
        console.log(`[MentalPlayer] Received game message from ${peerId}:`, data);
        
        // Route message to active game if available
        if (state.activeGame.instance && typeof state.activeGame.instance.handleMessage === 'function') {
            state.activeGame.instance.handleMessage(peerId, data);
        }
    }
    
    // Export public methods
    return {
        init,
        loadGame,
        showNotification,
        addChatMessage,
        handleGameMessage,
        shareViaWhatsApp,
        shareViaEmail,
        shareViaFacebook,
        shareViaTwitter,
        
        // Provide access to active game for connection manager
        get activeGame() {
            return state.activeGame;
        }
    };
})();

// Make these functions available globally for the share buttons
window.shareViaWhatsApp = MentalPlayer.shareViaWhatsApp;
window.shareViaEmail = MentalPlayer.shareViaEmail;
window.shareViaFacebook = MentalPlayer.shareViaFacebook;
window.shareViaTwitter = MentalPlayer.shareViaTwitter;