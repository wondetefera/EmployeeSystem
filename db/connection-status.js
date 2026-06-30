/**
 * Connection Status Tracking Module
 * 
 * Tracks the current state of the database connection for other modules
 * to query and make fallback decisions (e.g., use file-based storage).
 * 
 * Purpose:
 * - Maintain connection status state
 * - Allow other modules to check if database is available
 * - Track last error and diagnostic information
 * - Support graceful degradation when database fails
 */

// Module-level state tracking
let connectionStatus = {
  isConnected: false,
  lastError: null,
  diagnosticInfo: {},
  timestamp: null
};

/**
 * Get current connection status
 * Other modules use this to check if database is available
 * 
 * @returns {Object} - Current connection status
 *   {
 *     isConnected: boolean,
 *     lastError: Error|null,
 *     diagnosticInfo: Object,
 *     timestamp: Date|null
 *   }
 * 
 * @example
 * const status = getConnectionStatus()
 * if (!status.isConnected) {
 *   // Use file-based storage fallback
 * }
 */
function getConnectionStatus() {
  return {
    isConnected: connectionStatus.isConnected,
    lastError: connectionStatus.lastError,
    diagnosticInfo: { ...connectionStatus.diagnosticInfo },
    timestamp: connectionStatus.timestamp
  };
}

/**
 * Update connection status
 * Called by connection.js when connection succeeds or fails
 * 
 * @param {boolean} isConnected - Whether connection is active
 * @param {Error|null} error - Last connection error (null if successful)
 * @param {Object} diagnostics - Diagnostic information about the connection attempt
 * 
 * @example
 * setConnectionStatus(true, null, { hostname: 'db.example.com' })
 * setConnectionStatus(false, error, { hostname, dnsResolution: 'failed' })
 */
function setConnectionStatus(isConnected, error = null, diagnostics = {}) {
  connectionStatus = {
    isConnected: isConnected,
    lastError: error,
    diagnosticInfo: diagnostics,
    timestamp: new Date()
  };
  
  // Log status change
  if (isConnected) {
    console.log('✅ Connection status updated: CONNECTED');
  } else {
    console.log('🟡 Connection status updated: DISCONNECTED');
    if (error) {
      console.log(`   Last error: ${error.code || 'UNKNOWN'} - ${error.message || 'Unknown'}`);
    }
  }
}

/**
 * Check if database connection is available
 * Convenience method for simple boolean check
 * 
 * @returns {boolean} - True if connection is active, false otherwise
 * 
 * @example
 * if (isConnectionAvailable()) {
 *   // Use database queries
 * } else {
 *   // Use file-based storage fallback
 * }
 */
function isConnectionAvailable() {
  return connectionStatus.isConnected === true;
}

/**
 * Get diagnostic information from last connection attempt
 * Useful for troubleshooting and error reporting
 * 
 * @returns {Object} - Diagnostic information
 * 
 * @example
 * const diags = getDiagnosticInfo()
 * console.log('Database hostname:', diags.hostname)
 */
function getDiagnosticInfo() {
  return { ...connectionStatus.diagnosticInfo };
}

/**
 * Reset connection status to initial state
 * Useful for testing or re-initialization
 * 
 * @internal
 */
function resetConnectionStatus() {
  connectionStatus = {
    isConnected: false,
    lastError: null,
    diagnosticInfo: {},
    timestamp: null
  };
}

// Export all functions
module.exports = {
  getConnectionStatus,
  setConnectionStatus,
  isConnectionAvailable,
  getDiagnosticInfo,
  resetConnectionStatus // Internal use only
};
