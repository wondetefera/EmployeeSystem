/**
 * Diagnostic Utilities Module
 * 
 * Provides utilities for formatting diagnostic information about database
 * connection attempts, masking credentials, and creating structured error objects.
 * 
 * Purpose:
 * - Format connection diagnostic information consistently across the module
 * - Mask sensitive credentials (passwords) in all output
 * - Create structured error objects with actionable guidance
 * - Support troubleshooting of database connectivity issues
 */

/**
 * Mask sensitive credentials in configuration
 * Replaces password with "***" to prevent exposure in logs
 * 
 * @param {Object} config - Database configuration object
 * @returns {Object} - Configuration with masked password
 * 
 * @example
 * const masked = maskCredentials({ password: 'secret', user: 'admin' })
 * // Returns: { password: '***', user: 'admin' }
 */
function maskCredentials(config) {
  const masked = { ...config };
  if (masked.password) {
    masked.password = '***';
  }
  return masked;
}

/**
 * Format diagnostic information from a connection attempt
 * Creates structured output showing configuration and error details
 * with credentials properly masked
 * 
 * @param {Object} config - Database configuration
 * @param {Error|null} error - Connection error (null if successful)
 * @param {Object|null} dnsResult - Result from DNS resolution test
 * @param {Object|null} networkCheck - Result from network connectivity check
 * @returns {String} - Formatted diagnostic information for logging
 * 
 * @example
 * const info = formatDiagnosticInfo(config, error, dnsResult, networkCheck)
 * console.log(info)
 * // Outputs formatted diagnostic block with masked credentials
 */
function formatDiagnosticInfo(config, error, dnsResult, networkCheck) {
  const masked = maskCredentials(config);
  
  const lines = [
    '=====================================',
    'CONNECTION DIAGNOSTIC INFORMATION:',
    '====================================='
  ];
  
  // Configuration section
  lines.push(`Hostname: ${config.host || 'NOT SET'}`);
  lines.push(`Port: ${config.port || 'NOT SET'}`);
  lines.push(`Database: ${config.database || 'NOT SET'}`);
  lines.push(`User: ${config.user || 'NOT SET'}`);
  lines.push(`Password: ${masked.password}`);
  lines.push(`SSL: ${config.ssl ? 'ENABLED' : 'DISABLED'}`);
  
  // DNS Resolution section (if provided)
  if (dnsResult) {
    lines.push('');
    lines.push('DNS Resolution:');
    if (dnsResult.success) {
      lines.push(`  ✓ Successfully resolved to: ${dnsResult.ipAddress}`);
    } else {
      lines.push(`  ✗ Resolution failed`);
      lines.push(`    Error Code: ${dnsResult.errorCode || 'UNKNOWN'}`);
      lines.push(`    Error Message: ${dnsResult.errorMessage || 'Unknown error'}`);
    }
  }
  
  // Network Connectivity section (if provided)
  if (networkCheck) {
    lines.push('');
    lines.push('Network Connectivity:');
    if (networkCheck.reachable) {
      lines.push(`  ✓ Reachable (Response time: ${networkCheck.responseTime}ms)`);
    } else {
      lines.push(`  ✗ Unreachable`);
      if (networkCheck.error) {
        lines.push(`    Error: ${networkCheck.error}`);
      }
    }
  }
  
  // Error section (if provided)
  if (error) {
    lines.push('');
    lines.push('Connection Error:');
    lines.push(`  Code: ${error.code || 'UNKNOWN'}`);
    lines.push(`  Message: ${error.message || 'Unknown error'}`);
    if (error.sqlState) {
      lines.push(`  SQL State: ${error.sqlState}`);
    }
  }
  
  lines.push('=====================================');
  
  return lines.join('\n');
}

/**
 * Create a structured error object for connection failures
 * Includes categorization and client-safe messages
 * 
 * @param {Error} error - The connection error
 * @param {String} hostname - The attempted hostname
 * @param {String} errorCategory - Category of error (e.g., 'ENOTFOUND', 'TIMEOUT')
 * @returns {Object} - Structured error object
 * 
 * @example
 * const structured = formatConnectionError(error, 'db.example.com', 'ENOTFOUND')
 * console.log(structured)
 * // Returns: { code, message, hostname, category, suggestions: [...] }
 */
function formatConnectionError(error, hostname, errorCategory = 'UNKNOWN') {
  const errorObject = {
    code: error.code || 'UNKNOWN',
    message: error.message || 'Unknown error',
    hostname: hostname,
    category: errorCategory,
    timestamp: new Date().toISOString(),
    suggestions: []
  };
  
  // Provide specific suggestions based on error category
  if (errorCategory === 'ENOTFOUND') {
    errorObject.suggestions = [
      'Verify hostname spelling matches your Aiven dashboard',
      'Confirm that the Aiven service exists and is active',
      'Check that your network can reach Aiven servers',
      'Verify environment variable DB_HOST is set correctly',
      'If using Render, update environment variables in dashboard'
    ];
  } else if (errorCategory === 'ECONNREFUSED') {
    errorObject.suggestions = [
      'Verify database is running and accepting connections on port ' + (error.port || 'unknown'),
      'Check firewall rules allow connections to the database',
      'Verify Aiven security group/network settings',
      'Confirm credentials are correct'
    ];
  } else if (errorCategory === 'ETIMEDOUT') {
    errorObject.suggestions = [
      'Database connection is timing out - network may be slow',
      'Verify hostname is resolvable and network connectivity',
      'Check if Aiven service is overloaded',
      'Try increasing connection timeout'
    ];
  } else if (errorCategory === 'ER_ACCESS_DENIED_ERROR') {
    errorObject.suggestions = [
      'Verify database username and password are correct',
      'Confirm user has permission to access the database',
      'Check that credentials match what\'s configured in Aiven'
    ];
  } else {
    errorObject.suggestions = [
      'Review diagnostic information above',
      'Check Aiven dashboard for service status',
      'Verify network connectivity to Aiven',
      'Review connection logs for additional details'
    ];
  }
  
  return errorObject;
}

/**
 * Format suggestions for display
 * Converts suggestion array to formatted string
 * 
 * @param {Array} suggestions - Array of suggestion strings
 * @returns {String} - Formatted suggestions for logging
 */
function formatSuggestions(suggestions) {
  if (!suggestions || suggestions.length === 0) {
    return '';
  }
  
  const lines = ['Suggested troubleshooting steps:'];
  suggestions.forEach((suggestion, index) => {
    lines.push(`  ${index + 1}. ${suggestion}`);
  });
  
  return lines.join('\n');
}

// Export all functions
module.exports = {
  maskCredentials,
  formatDiagnosticInfo,
  formatConnectionError,
  formatSuggestions
};
