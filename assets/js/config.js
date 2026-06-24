/**
 * Client-side Configuration Manager
 * Handles dynamic server configuration for network deployment
 */

class ConfigManager {
    constructor() {
        this.config = null;
        this.serverUrl = null;
        this.initialized = false;
    }

    /**
     * Initialize configuration from server or localStorage
     */
    async init() {
        if (this.initialized) return this.config;

        try {
            // Try to load from current server first
            await this.loadFromServer();
        } catch (error) {
            console.warn('Could not load config from server, using defaults:', error);
            // Fallback to default configuration
            this.setDefaultConfig();
        }

        this.initialized = true;
        return this.config;
    }

    /**
     * Load configuration from server
     */
    async loadFromServer() {
        const response = await fetch('/api/server-info');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        if (result.success) {
            this.config = result.data;
            this.updateServerUrl();
            this.saveToLocalStorage();
        } else {
            throw new Error(result.error || 'Failed to load configuration');
        }
    }

    /**
     * Set default configuration
     */
    setDefaultConfig() {
        this.config = {
            server: {
                host: 'localhost',
                port: 8080,
                allowExternalConnections: false
            },
            system: {
                name: 'Employee Management System',
                version: '1.0.0',
                timezone: 'local'
            },
            features: {
                notifications: true,
                overtime: true,
                leaveManagement: true,
                attendanceTracking: true
            }
        };
        this.updateServerUrl();
        this.saveToLocalStorage();
    }

    /**
     * Update server URL based on configuration
     */
    updateServerUrl() {
        if (this.config && this.config.server) {
            const { host, port } = this.config.server;
            this.serverUrl = `http://${host}:${port}`;
        } else {
            this.serverUrl = `http://localhost:8080`;
        }
    }

    /**
     * Get server URL for API calls
     */
    getServerUrl() {
        return this.serverUrl || `http://localhost:8080`;
    }

    /**
     * Get API endpoint URL
     */
    getApiUrl(endpoint) {
        const baseUrl = this.getServerUrl();
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return `${baseUrl}${cleanEndpoint}`;
    }

    /**
     * Get configuration value
     */
    get(path, defaultValue = null) {
        if (!this.config) return defaultValue;

        const keys = path.split('.');
        let value = this.config;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }

        return value;
    }

    /**
     * Save configuration to localStorage
     */
    saveToLocalStorage() {
        try {
            localStorage.setItem('ems_config', JSON.stringify({
                config: this.config,
                serverUrl: this.serverUrl,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.warn('Could not save config to localStorage:', error);
        }
    }

    /**
     * Load configuration from localStorage
     */
    loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem('ems_config');
            if (stored) {
                const data = JSON.parse(stored);
                
                // Check if stored config is not too old (24 hours)
                const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
                if (Date.now() - data.timestamp < maxAge) {
                    this.config = data.config;
                    this.serverUrl = data.serverUrl;
                    return true;
                }
            }
        } catch (error) {
            console.warn('Could not load config from localStorage:', error);
        }
        return false;
    }

    /**
     * Clear stored configuration
     */
    clearStoredConfig() {
        try {
            localStorage.removeItem('ems_config');
        } catch (error) {
            console.warn('Could not clear stored config:', error);
        }
    }

    /**
     * Test server connectivity
     */
    async testConnection() {
        try {
            const response = await fetch(this.getApiUrl('/api/user'), {
                method: 'GET',
                credentials: 'include'
            });
            
            return {
                success: response.ok,
                status: response.status,
                message: response.ok ? 'Connection successful' : `HTTP ${response.status}`
            };
        } catch (error) {
            return {
                success: false,
                status: 0,
                message: error.message
            };
        }
    }

    /**
     * Update configuration (admin only)
     */
    async updateConfig(newConfig) {
        try {
            const response = await fetch(this.getApiUrl('/api/config'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(newConfig)
            });

            const result = await response.json();
            
            if (result.success) {
                this.config = result.data;
                this.updateServerUrl();
                this.saveToLocalStorage();
            }

            return result;
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Create global configuration manager instance
window.configManager = new ConfigManager();

/**
 * Enhanced fetch function that uses configured server URL
 */
window.fetchApi = async function(endpoint, options = {}) {
    // Ensure config is initialized
    await window.configManager.init();
    
    // Build full URL
    const url = window.configManager.getApiUrl(endpoint);
    
    // Set default options with Firefox-specific headers
    const defaultOptions = {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest', // Firefox compatibility
            ...options.headers
        }
    };
    
    // Merge options
    const finalOptions = { ...defaultOptions, ...options };
    
    try {
        console.log(`🌐 Making API request to: ${url}`);
        const response = await fetch(url, finalOptions);
        console.log(`📡 Response status: ${response.status}`);
        return response;
    } catch (error) {
        console.error('❌ API request failed:', error);
        
        // Firefox-specific error handling
        if (error.name === 'NetworkError' || error.message.includes('NetworkError')) {
            throw new Error('Connection error. Please check server configuration.');
        } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            throw new Error('Server unreachable. Please verify the server is running and accessible.');
        }
        
        throw error;
    }
};

/**
 * Initialize configuration on page load
 */
document.addEventListener('DOMContentLoaded', async function() {
    try {
        await window.configManager.init();
        console.log('Configuration initialized:', window.configManager.getServerUrl());
        
        // Update any existing server references in the page
        updatePageServerReferences();
        
    } catch (error) {
        console.error('Failed to initialize configuration:', error);
    }
});

/**
 * Update server references in the current page
 */
function updatePageServerReferences() {
    const serverUrl = window.configManager.getServerUrl();
    
    // Update any elements with data-server-url attribute
    document.querySelectorAll('[data-server-url]').forEach(element => {
        element.textContent = serverUrl;
    });
    
    // Update any links that need the server URL
    document.querySelectorAll('a[href^="/"]').forEach(link => {
        if (link.getAttribute('data-absolute-url') === 'true') {
            const path = link.getAttribute('href');
            link.href = serverUrl + path;
        }
    });
}

/**
 * Test server connectivity with detailed Firefox debugging
 */
window.testServerConnection = async function() {
    console.log('🔍 Testing server connection...');
    
    try {
        // Test 1: Basic server info
        console.log('📡 Test 1: Fetching server info...');
        const serverInfoResponse = await fetch('/api/server-info');
        console.log('Server info response:', serverInfoResponse.status, serverInfoResponse.statusText);
        
        if (!serverInfoResponse.ok) {
            throw new Error(`Server info failed: ${serverInfoResponse.status}`);
        }
        
        const serverInfo = await serverInfoResponse.json();
        console.log('✅ Server info:', serverInfo);
        
        // Test 2: User authentication check
        console.log('📡 Test 2: Checking authentication...');
        const userResponse = await fetchApi('/api/user');
        console.log('User response:', userResponse.status, userResponse.statusText);
        
        // Test 3: Leave balance (if authenticated)
        if (userResponse.ok) {
            console.log('📡 Test 3: Testing leave balance API...');
            const balanceResponse = await fetchApi('/api/leave-balance');
            console.log('Balance response:', balanceResponse.status, balanceResponse.statusText);
        }
        
        return {
            success: true,
            message: 'All connection tests passed',
            details: {
                serverInfo: serverInfo,
                userAuth: userResponse.ok,
                timestamp: new Date().toISOString()
            }
        };
        
    } catch (error) {
        console.error('❌ Connection test failed:', error);
        return {
            success: false,
            message: error.message,
            error: error
        };
    }
};

/**
 * Utility function to show connection status
 */
window.showConnectionStatus = async function() {
    const result = await window.configManager.testConnection();
    
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.innerHTML = `
            <div class="alert ${result.success ? 'alert-success' : 'alert-danger'}">
                <i class="fas ${result.success ? 'fa-check-circle' : 'fa-exclamation-triangle'} me-2"></i>
                Server Connection: ${result.message}
            </div>
        `;
    }
    
    return result;
};

/**
 * Export for use in other modules
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigManager;
}