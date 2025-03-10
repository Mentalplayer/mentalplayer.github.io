/**
 * Game Registry for MentalPlayer
 * Manages registration and access to available game modules
 * 
 * @version 2.0.0
 */

const GameRegistry = (() => {
    // Private storage for registered games
    const games = {};
    
    // Required methods for game modules
    const requiredMethods = [
        'init',        // Initialize the game
        'reset',       // Reset/restart the game
        'handleMessage' // Handle incoming messages from peers
    ];
    
    // Optional methods for game modules
    const optionalMethods = [
        'onConnectionStateChanged', // Called when connection state changes
        'setupControls',           // Set up game-specific controls
        'getState',                // Get current game state for sharing
        'setState',                // Set game state from received data
        'cleanup'                  // Clean up resources when game is unloaded
    ];
    
    /**
     * Register a new game
     * @param {string} id Unique identifier for the game
     * @param {Object} gameModule Game module implementation
     * @returns {boolean} Success status
     */
    function registerGame(id, gameModule) {
        // Validate ID
        if (!id || typeof id !== 'string') {
            console.error('[GameRegistry] Invalid game ID');
            return false;
        }
        
        // Check if already registered
        if (games[id]) {
            console.warn(`[GameRegistry] Game '${id}' is already registered`);
            return false;
        }
        
        // Validate required methods
        const missingMethods = requiredMethods.filter(method => typeof gameModule[method] !== 'function');
        if (missingMethods.length > 0) {
            console.error(`[GameRegistry] Game '${id}' is missing required methods: ${missingMethods.join(', ')}`);
            return false;
        }
        
        // Add game to registry
        games[id] = {
            id,
            name: gameModule.name || id,
            description: gameModule.description || 'A multiplayer puzzle game',
            icon: gameModule.icon || '🎮',
            module: gameModule,
            timestamp: Date.now()
        };
        
        console.log(`[GameRegistry] Registered game: ${id}`);
        return true;
    }
    
    /**
     * Get a registered game module
     * @param {string} id Game identifier
     * @returns {Object|null} Game module or null if not found
     */
    function getGame(id) {
        if (!games[id]) {
            console.warn(`[GameRegistry] Game '${id}' not found`);
            return null;
        }
        
        return games[id].module;
    }
    
    /**
     * Get metadata for a registered game
     * @param {string} id Game identifier
     * @returns {Object|null} Game metadata or null if not found
     */
    function getGameMetadata(id) {
        if (!games[id]) {
            console.warn(`[GameRegistry] Game '${id}' not found`);
            return null;
        }
        
        // Return metadata without the module implementation
        const { module, ...metadata } = games[id];
        return metadata;
    }
    
    /**
     * Get metadata for all registered games
     * @returns {Array<Object>} Array of game metadata
     */
    function getRegisteredGames() {
        return Object.values(games).map(game => {
            const { module, ...metadata } = game;
            return metadata;
        });
    }
    
    /**
     * Check if a game is registered
     * @param {string} id Game identifier
     * @returns {boolean} True if game is registered
     */
    function isGameRegistered(id) {
        return !!games[id];
    }
    
    /**
     * Unregister a game
     * @param {string} id Game identifier
     * @returns {boolean} Success status
     */
    function unregisterGame(id) {
        if (!games[id]) {
            console.warn(`[GameRegistry] Cannot unregister: Game '${id}' not found`);
            return false;
        }
        
        // Run cleanup if available
        if (typeof games[id].module.cleanup === 'function') {
            try {
                games[id].module.cleanup();
            } catch (error) {
                console.error(`[GameRegistry] Error during cleanup of game '${id}': ${error.message}`);
            }
        }
        
        // Remove from registry
        delete games[id];
        console.log(`[GameRegistry] Unregistered game: ${id}`);
        return true;
    }
    
    /**
     * Create a game module skeleton for new games
     * @param {string} id Game identifier
     * @returns {Object} Game module skeleton
     */
    function createGameSkeleton(id) {
        return {
            id,
            name: id.charAt(0).toUpperCase() + id.slice(1), // Capitalized ID as default name
            description: 'A multiplayer puzzle game',
            icon: '🎮',
            
            // Required methods
            init: function(container, context) {
                console.log(`[${id}] Initializing game`);
                // Game initialization code goes here
            },
            
            reset: function() {
                console.log(`[${id}] Resetting game`);
                // Game reset code goes here
            },
            
            handleMessage: function(peerId, message) {
                console.log(`[${id}] Received message from peer: ${peerId}`);
                // Handle incoming peer messages
            },
            
            // Optional methods
            onConnectionStateChanged: function(state) {
                console.log(`[${id}] Connection state changed: ${state.status}`);
                // Handle connection state changes
            },
            
            setupControls: function(controlsContainer) {
                console.log(`[${id}] Setting up controls`);
                // Setup game-specific controls
            },
            
            getState: function() {
                console.log(`[${id}] Getting game state`);
                // Return current game state for sharing
                return {};
            },
            
            setState: function(state) {
                console.log(`[${id}] Setting game state`);
                // Set game state from received data
            },
            
            cleanup: function() {
                console.log(`[${id}] Cleaning up resources`);
                // Clean up resources when game is unloaded
            }
        };
    }
    
    /**
     * Validate a game module
     * @param {Object} gameModule Game module to validate
     * @returns {Object} Validation result {valid: boolean, missingMethods: string[]}
     */
    function validateGameModule(gameModule) {
        const missingMethods = requiredMethods.filter(method => typeof gameModule[method] !== 'function');
        
        return {
            valid: missingMethods.length === 0,
            missingMethods
        };
    }
    
    // Public API
    return {
        registerGame,
        getGame,
        getGameMetadata,
        getRegisteredGames,
        isGameRegistered,
        unregisterGame,
        createGameSkeleton,
        validateGameModule,
        
        // Constants
        get requiredMethods() {
            return [...requiredMethods];
        },
        
        get optionalMethods() {
            return [...optionalMethods];
        }
    };
})();

// Make GameRegistry available globally
window.GameRegistry = GameRegistry;