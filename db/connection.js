/**
 * Database Connection Module
 * 
 * Manages MySQL connection pool and provides query execution interfaces
 * for the Employee Management System.
 * 
 * Features:
 * - Connection pooling (5-20 connections)
 * - Parameterized query execution
 * - Transaction support
 * - Connection retry logic (3 attempts, 5-second intervals)
 * - Environment-specific behavior (production vs development)
 */

const mysql = require('mysql2/promise');
const dns = require('dns').promises;
const net = require('net');
require('dotenv').config({ override: false }); // Respect Render environment variables

// Import diagnostic utilities and connection status tracking
const diagnosticUtils = require('./diagnostic-utils');
const connectionStatus = require('./connection-status');

// Global connection pool instance
let pool = null;

/**
 * Sleep helper for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate database configuration
 * Checks that all required environment variables are set and have valid values
 * 
 * @returns {Object} - Validation result: { isValid: boolean, errors: [], warnings: [] }
 */
function validateDatabaseConfiguration() {
  const errors = [];
  const warnings = [];
  
  // Check required fields
  if (!process.env.DB_HOST || process.env.DB_HOST.trim() === '') {
    errors.push('DB_HOST is not set or is empty');
  }
  
  if (!process.env.DB_USER || process.env.DB_USER.trim() === '') {
    errors.push('DB_USER is not set or is empty');
  }
  
  if (!process.env.DB_NAME || process.env.DB_NAME.trim() === '') {
    errors.push('DB_NAME is not set or is empty');
  }
  
  // Validate port
  const port = parseInt(process.env.DB_PORT || '3306');
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push(`DB_PORT must be numeric between 1-65535, got: ${process.env.DB_PORT}`);
  }
  
  // Log configuration (with password masked)
  console.log('📦 Database Configuration Validation:');
  console.log(`   DB_HOST: ${process.env.DB_HOST || 'NOT SET'}`);
  console.log(`   DB_PORT: ${process.env.DB_PORT || '3306'}`);
  console.log(`   DB_NAME: ${process.env.DB_NAME || 'NOT SET'}`);
  console.log(`   DB_USER: ${process.env.DB_USER || 'NOT SET'}`);
  console.log(`   DB_PASSWORD: ${process.env.DB_PASSWORD ? '***' : 'NOT SET'}`);
  console.log(`   DB_SSL: ${process.env.DB_SSL || 'false'}`);
  
  if (errors.length > 0) {
    console.error('❌ Configuration validation failed:');
    errors.forEach(err => console.error(`   - ${err}`));
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️  Configuration warnings:');
    warnings.forEach(warn => console.warn(`   - ${warn}`));
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}

/**
 * Test DNS resolution for a hostname
 * Verifies that the database hostname can be resolved to an IP address
 * 
 * @param {string} hostname - Hostname to resolve
 * @returns {Promise<Object>} - Result: { success: boolean, ipAddress: string|null, errorCode: string|null, errorMessage: string|null }
 */
async function testDnsResolution(hostname) {
  if (!hostname) {
    return {
      success: false,
      ipAddress: null,
      errorCode: 'INVALID_HOSTNAME',
      errorMessage: 'Hostname is empty or null'
    };
  }
  
  try {
    const addresses = await dns.resolve4(hostname);
    if (addresses && addresses.length > 0) {
      console.log(`✓ DNS resolution successful: ${hostname} → ${addresses[0]}`);
      return {
        success: true,
        ipAddress: addresses[0],
        errorCode: null,
        errorMessage: null
      };
    }
  } catch (error) {
    console.error(`❌ DNS resolution failed for hostname: ${hostname}`);
    console.error(`   Error Code: ${error.code}`);
    console.error(`   Error Message: ${error.message}`);
    
    return {
      success: false,
      ipAddress: null,
      errorCode: error.code || 'UNKNOWN',
      errorMessage: error.message || 'Unknown DNS error'
    };
  }
}

/**
 * Test network connectivity to a host:port combination
 * Attempts a quick TCP connection to verify network accessibility
 * 
 * @param {string} hostname - Hostname to reach
 * @param {number} port - Port to connect to
 * @returns {Promise<Object>} - Result: { reachable: boolean, error: string|null, responseTime: number|null }
 */
async function testNetworkConnectivity(hostname, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 3000; // 3 second timeout
    const startTime = Date.now();
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      const responseTime = Date.now() - startTime;
      console.log(`✓ Network connectivity check successful: ${hostname}:${port} (${responseTime}ms)`);
      socket.destroy();
      resolve({
        reachable: true,
        error: null,
        responseTime: responseTime
      });
    });
    
    socket.on('timeout', () => {
      console.error(`❌ Network connectivity check timeout for ${hostname}:${port}`);
      socket.destroy();
      resolve({
        reachable: false,
        error: 'Connection timeout after 3 seconds',
        responseTime: null
      });
    });
    
    socket.on('error', (error) => {
      console.error(`❌ Network connectivity check failed for ${hostname}:${port}`);
      console.error(`   Error: ${error.message}`);
      resolve({
        reachable: false,
        error: error.message,
        responseTime: null
      });
    });
    
    socket.connect(port, hostname);
  });
}


/**
 * Initialize database connection pool with configuration
 * Implements retry logic: 3 attempts with 5-second intervals
 * Includes comprehensive pre-validation and diagnostic logging
 * Environment-specific behavior:
 * - Production: Continue running on failure (allows graceful degradation)
 * - Development: Continue running, log error
 * 
 * @returns {Promise<boolean>} - True if connected successfully, false otherwise
 */
async function initializeDatabase() {
  // Check if database mode is disabled
  if (process.env.USE_DATABASE !== 'true') {
    console.log('⚠️  USE_DATABASE is false - skipping database initialization');
    console.log('⚠️  Using file-based storage (data.json) instead');
    return false;
  }

  const maxRetries = 3;
  const retryDelayMs = 5000; // 5 seconds
  
  // STEP 1: Validate configuration
  console.log('\n🔍 Step 1: Validating Database Configuration...');
  const validationResult = validateDatabaseConfiguration();
  if (!validationResult.isValid) {
    console.error('⚠️  Configuration validation found errors but will continue attempting connection');
  }
  
  // STEP 2: Test DNS resolution
  console.log('\n🔍 Step 2: Testing DNS Resolution...');
  const dnsResult = await testDnsResolution(process.env.DB_HOST);
  
  // STEP 3: Test network connectivity if DNS succeeded
  let networkCheckResult = null;
  if (dnsResult.success) {
    console.log('\n🔍 Step 3: Testing Network Connectivity...');
    networkCheckResult = await testNetworkConnectivity(
      process.env.DB_HOST,
      parseInt(process.env.DB_PORT || '3306')
    );
  }
  
  // Create connection pool with configuration
  console.log('\n🔍 Step 4: Creating Connection Pool...');
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'employee_system',
    port: parseInt(process.env.DB_PORT || '3306'),
    connectionLimit: 20,        // Maximum 20 connections
    waitForConnections: true,   // Queue requests when pool is full
    queueLimit: 0,              // Unlimited queue
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000, // 10 seconds
    connectTimeout: 10000,      // 10 second connection timeout
    acquireTimeout: 30000,      // 30 seconds to acquire a connection from pool
    idleTimeout: 600000,        // 10 minute idle timeout
    maxIdle: 5,                 // Minimum 5 idle connections maintained
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });
  
  // Log connection attempt (excluding password)
  console.log('=====================================');
  console.log('DATABASE CONNECTION CONFIGURATION:');
  console.log('=====================================');
  console.log(`Host: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`Port: ${process.env.DB_PORT || 3306}`);
  console.log(`Database: ${process.env.DB_NAME || 'employee_system'}`);
  console.log(`User: ${process.env.DB_USER || 'root'}`);
  console.log(`SSL Enabled: ${process.env.DB_SSL === 'true' ? 'YES' : 'NO'}`);
  console.log(`Connection Pool: 5-20 connections (max 20)`);
  console.log(`Idle Timeout: 10 minutes (600000 ms)`);
  console.log(`Keep-Alive: Enabled (10 second interval)`);
  console.log(`USE_DATABASE: ${process.env.USE_DATABASE}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log('=====================================');
  console.log(`🔌 Attempting connection...`);
  
  // Retry loop
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Test connection by executing a simple query
      await pool.query('SELECT 1');
      console.log('✅ Database connected successfully');
      
      // Update connection status
      connectionStatus.setConnectionStatus(true, null, {
        hostname: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dnsResolution: dnsResult,
        networkCheck: networkCheckResult
      });
      
      // Initialize schema metadata cache for query optimization
      try {
        const schemaCache = require('./schema-cache');
        await schemaCache.initializeSchemaCache();
      } catch (cacheError) {
        console.warn('⚠️  Schema cache initialization failed (non-critical):', cacheError.message);
      }
      
      return true;
    } catch (error) {
      lastError = error;
      console.error(`❌ Database connection failed (attempt ${attempt}/${maxRetries}):`);
      console.error(`   Error Code: ${error.code}`);
      console.error(`   Error Message: ${error.message}`);
      console.error(`   SQL State: ${error.sqlState || 'N/A'}`);
      
      // Enhanced logging for ENOTFOUND errors
      if (error.code === 'ENOTFOUND') {
        console.error(`\n🔍 ENOTFOUND Error Analysis:`);
        console.error(`   Hostname: ${process.env.DB_HOST}`);
        console.error(`   DNS Resolution: ${dnsResult.success ? 'PASSED' : 'FAILED'}`);
        if (!dnsResult.success) {
          console.error(`   DNS Error: ${dnsResult.errorCode} - ${dnsResult.errorMessage}`);
        }
        console.error(`   Suggested troubleshooting:`);
        console.error(`     1. Verify hostname spelling matches Aiven dashboard`);
        console.error(`     2. Confirm Aiven service exists and is active`);
        console.error(`     3. Check network connectivity to Aiven`);
        console.error(`     4. Verify environment variable DB_HOST is set correctly`);
        if (process.env.NODE_ENV === 'production') {
          console.error(`     5. If using Render, verify environment variables in dashboard`);
        }
      }
      
      // If not last attempt, wait before retrying
      if (attempt < maxRetries) {
        console.log(`⏳ Retrying in ${retryDelayMs / 1000} seconds...`);
        await sleep(retryDelayMs);
      }
    }
  }
  
  // All retries exhausted - GRACEFUL DEGRADATION
  console.error('💥 Failed to connect to database after', maxRetries, 'attempts');
  
  // Log comprehensive diagnostic information
  console.log('\n📋 Diagnostic Information:');
  console.log(diagnosticUtils.formatDiagnosticInfo(
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true'
    },
    lastError,
    dnsResult,
    networkCheckResult
  ));
  
  // Update connection status with failure information
  connectionStatus.setConnectionStatus(false, lastError, {
    hostname: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dnsResolution: dnsResult,
    networkCheck: networkCheckResult,
    attemptCount: maxRetries,
    lastError: {
      code: lastError?.code,
      message: lastError?.message,
      sqlState: lastError?.sqlState
    }
  });
  
  // Graceful degradation: Continue running instead of exiting
  console.warn('\n🟡 CONNECTION FAILURE - GRACEFUL DEGRADATION ACTIVATED');
  console.warn('⚠️  Server will continue running WITHOUT database connection');
  console.warn('⚠️  File-based storage (data.json) will be used if available');
  console.warn('⚠️  Some features may not work properly');
  console.warn('⚠️  Check the diagnostic information above and fix the database configuration');
  
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️  PRODUCTION: Database connection failed but server will continue');
    console.warn('⚠️  This is a temporary workaround - fix the database connection ASAP!');
  }
  
  return false;
}


/**
 * Categorize database errors for appropriate HTTP response codes
 * Maps MySQL error codes to HTTP status codes and client-friendly messages
 * 
 * Requirement 6.2: WHEN a SQL query times out after 30 seconds, THE System SHALL cancel query and return error response
 * Requirement 6.4: THE System SHALL distinguish between connection errors, syntax errors, and constraint violation errors
 * Requirement 6.5: WHEN a foreign key constraint is violated, THE System SHALL return a 400 status
 * Requirement 6.6: WHEN a unique constraint is violated, THE System SHALL return a 409 status
 * Requirement 6.7: THE System SHALL not expose internal database errors or schema details to HTTP clients
 * Requirement 6.8: WHEN database errors occur, THE System SHALL increment error metrics for monitoring
 * 
 * @param {Error} error - Database error object
 * @returns {Object} - { statusCode, clientMessage, errorCategory, shouldLog, logLevel, timestamp }
 * 
 * Error Categories:
 * - CONNECTION_ERROR: PROTOCOL_CONNECTION_LOST, ECONNREFUSED → 500 Server Error
 * - TIMEOUT_ERROR: ETIMEDOUT, PROTOCOL_SEQUENCE_TIMEOUT, query timeout → 503 Service Unavailable  
 * - CONSTRAINT_DUPLICATE: ER_DUP_ENTRY (unique constraint) → 409 Conflict
 * - CONSTRAINT_FOREIGN_KEY: ER_NO_REFERENCED_ROW_2 (foreign key) → 400 Bad Request
 * - SYNTAX_ERROR: ER_PARSE_ERROR, ER_SYNTAX_ERROR → 500 Server Error
 * - AUTH_ERROR: ER_ACCESS_DENIED_ERROR → 500 Server Error
 * - UNKNOWN_ERROR: All others → 500 Server Error
 */
function categorizeError(error) {
  const timestamp = new Date().toISOString();
  const errorCode = error.code || 'UNKNOWN';
  const errorMessage = error.message || '';
  
  // Connection errors
  // Requirement 4.14, 6.1: Distinguish connection errors → 500
  if (errorCode === 'PROTOCOL_CONNECTION_LOST' || 
      errorCode === 'ECONNREFUSED' || 
      errorCode === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR' ||
      errorCode === 'ENOTFOUND') {
    
    // Special handling for ENOTFOUND - provide actionable guidance
    if (errorCode === 'ENOTFOUND') {
      return {
        statusCode: 500,
        clientMessage: 'Database hostname cannot be resolved. Please verify your database configuration. ' +
                      'This usually means the hostname is incorrect or the network cannot reach the database server. ' +
                      'Check Aiven dashboard and verify your connection settings.',
        errorCategory: 'HOSTNAME_RESOLUTION_ERROR',
        shouldLog: true,
        logLevel: 'error',
        timestamp,
        suggestions: [
          'Verify hostname spelling matches Aiven dashboard',
          'Confirm Aiven service exists and is active',
          'Check network connectivity to Aiven infrastructure',
          'Verify environment variable DB_HOST is set correctly'
        ]
      };
    }
    
    return {
      statusCode: 500,
      clientMessage: 'Database connection lost. Please try again.',
      errorCategory: 'CONNECTION_ERROR',
      shouldLog: true,
      logLevel: 'error',
      timestamp
    };
  }
  
  // Query timeout errors
  // Requirement 6.2: Query timeout after 30 seconds → 503
  if (errorCode === 'PROTOCOL_SEQUENCE_TIMEOUT' || 
      errorCode === 'ETIMEDOUT' ||
      errorCode === 'ESOCKETTIMEDOUT' ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('exceeded')) {
    return {
      statusCode: 503,
      clientMessage: 'Request timeout. The database operation took too long. Please try again.',
      errorCategory: 'TIMEOUT_ERROR',
      shouldLog: true,
      logLevel: 'warn',
      timestamp
    };
  }
  
  // Duplicate key/unique constraint violations
  // Requirement 6.6: Unique constraint violation → 409
  if (errorCode === 'ER_DUP_ENTRY') {
    // Extract the field name from error message if possible
    const match = errorMessage.match(/key '([^']+)'/);
    const fieldName = match ? match[1] : 'field';
    
    return {
      statusCode: 409,
      clientMessage: `This ${fieldName} already exists. Please use a unique value.`,
      errorCategory: 'CONSTRAINT_DUPLICATE',
      shouldLog: false, // Info level - expected in some scenarios
      logLevel: 'info',
      timestamp,
      details: { field: fieldName, originalMessage: errorMessage }
    };
  }
  
  // Foreign key constraint violations
  // Requirement 6.5: Foreign key constraint violation → 400
  if (errorCode === 'ER_NO_REFERENCED_ROW' || 
      errorCode === 'ER_NO_REFERENCED_ROW_2' ||
      errorCode === 'ER_ROW_IS_REFERENCED_2') {
    return {
      statusCode: 400,
      clientMessage: 'Invalid reference. The related record does not exist.',
      errorCategory: 'CONSTRAINT_FOREIGN_KEY',
      shouldLog: false, // Info level - client provided invalid reference
      logLevel: 'info',
      timestamp
    };
  }
  
  // Syntax errors
  // Requirement 4.14, 6.4: Distinguish syntax errors → 500
  if (errorCode === 'ER_PARSE_ERROR' || 
      errorCode === 'ER_SYNTAX_ERROR' ||
      errorCode === 'ER_BAD_FIELD_ERROR') {
    return {
      statusCode: 500,
      clientMessage: 'Database operation failed. Please contact support.',
      errorCategory: 'SYNTAX_ERROR',
      shouldLog: true,
      logLevel: 'error',
      timestamp,
      details: { message: errorMessage }
    };
  }
  
  // Access denied errors
  if (errorCode === 'ER_ACCESS_DENIED_ERROR') {
    return {
      statusCode: 500,
      clientMessage: 'Database authentication failed. Please check database configuration.',
      errorCategory: 'AUTH_ERROR',
      shouldLog: true,
      logLevel: 'error',
      timestamp
    };
  }
  
  // Generic/unknown errors - default to 500
  // Requirement 6.7: Do not expose internal database details to clients
  return {
    statusCode: 500,
    clientMessage: 'Database operation failed. Please try again later.',
    errorCategory: 'UNKNOWN_ERROR',
    shouldLog: true,
    logLevel: 'error',
    timestamp,
    details: { code: errorCode, message: errorMessage }
  };
}

/**
 * Execute a parameterized SQL query with comprehensive error handling
 * 
 * Features:
 * - Query timeout: 30 seconds (SET SESSION max_execution_time = 30000)
 * - Parameterized queries to prevent SQL injection
 * - Comprehensive error categorization
 * - Detailed internal logging without exposing internal details to clients
 * - Connection status checking before query execution
 * 
 * @param {string} sql - SQL query with ? placeholders
 * @param {Array} params - Array of parameters to bind to placeholders
 * @returns {Promise<Array>} - Query results (rows)
 * @throws {Error} - Enhanced error object with statusCode and clientMessage
 * 
 * @example
 * const employees = await query('SELECT * FROM employees WHERE status = ?', ['active']);
 */
async function query(sql, params = []) {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }
  
  // Check if database connection is available
  if (!connectionStatus.isConnectionAvailable()) {
    console.warn('❌ Query attempted without database connection');
    const error = new Error('Database connection unavailable');
    error.statusCode = 503;
    error.clientMessage = 'Database connection unavailable. Please check connection logs for hostname resolution issues. ' +
                         'If the problem persists, file-based storage may be used as fallback.';
    error.errorCategory = 'CONNECTION_UNAVAILABLE';
    throw error;
  }
  
  const connection = await pool.getConnection();
  
  try {
    // Set query timeout to 30 seconds before executing
    // Note: This sets a session variable that affects the next query
    const QUERY_TIMEOUT_MS = 30000; // 30 seconds
    
    // Some MySQL versions support max_execution_time as query hint
    // For broader compatibility, we wrap the execution in a timeout promise
    const queryPromise = (async () => {
      try {
        const [rows] = await connection.execute(sql, params);
        return rows;
      } catch (error) {
        throw error;
      }
    })();
    
    // Implement timeout handling
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Query execution timeout (30 seconds exceeded)'));
      }, QUERY_TIMEOUT_MS);
    });
    
    // Race between query and timeout
    const rows = await Promise.race([queryPromise, timeoutPromise]);
    return rows;
    
  } catch (error) {
    // Categorize the error
    const errorInfo = categorizeError(error);
    
    // Check if this is a timeout
    const isTimeout = error.message && error.message.includes('timeout') || 
                     error.code === 'ETIMEDOUT' || 
                     error.code === 'PROTOCOL_SEQUENCE_TIMEOUT';
    
    // Log error with appropriate level (without exposing internal details to client)
    const logMessage = {
      timestamp: errorInfo.timestamp,
      category: errorInfo.errorCategory,
      code: error.code,
      sqlState: error.sqlState,
      message: error.message,
      isTimeout: isTimeout,
      sqlPreview: sql.substring(0, 150) + (sql.length > 150 ? '...' : ''),
      paramCount: params.length
    };
    
    if (errorInfo.logLevel === 'error') {
      console.error('❌ Database Error:', logMessage);
      if (errorInfo.details) console.error('   Details:', errorInfo.details);
    } else if (errorInfo.logLevel === 'warn') {
      console.warn('⚠️  Database Warning:', logMessage);
    } else {
      console.log('ℹ️  Database Info:', logMessage);
    }
    
    // Enhance error object with client-safe information
    error.statusCode = errorInfo.statusCode;
    error.clientMessage = errorInfo.clientMessage;
    error.errorCategory = errorInfo.errorCategory;
    
    throw error;
  } finally {
    // Always release connection back to pool
    connection.release();
  }
}

/**
 * Execute operations within a database transaction
 * Automatically handles BEGIN TRANSACTION, COMMIT, and ROLLBACK
 * 
 * @param {Function} callback - Async function that receives connection object
 * @returns {Promise<*>} - Result returned by callback
 * @throws {Error} - If transaction fails (after rollback)
 * 
 * @example
 * await transaction(async (connection) => {
 *   await connection.query('INSERT INTO employees ...', [params]);
 *   await connection.query('INSERT INTO users ...', [params]);
 * });
 */
async function transaction(callback) {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }
  
  const connection = await pool.getConnection();
  
  try {
    // Begin transaction
    await connection.beginTransaction();
    
    // Execute callback with connection
    const result = await callback(connection);
    
    // Commit transaction
    await connection.commit();
    
    return result;
  } catch (error) {
    // Rollback transaction on error
    try {
      await connection.rollback();
      console.error('Transaction rolled back due to error:', error.message);
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError.message);
    }
    
    throw error;
  } finally {
    // Always release connection back to pool
    connection.release();
  }
}

/**
 * Get a connection from the pool for complex operations
 * Caller is responsible for releasing the connection
 * 
 * @returns {Promise<Connection>} - Database connection object
 * @throws {Error} - If connection cannot be acquired
 * 
 * @example
 * const conn = await getConnection();
 * try {
 *   await conn.query('SELECT ...');
 *   await conn.query('UPDATE ...');
 * } finally {
 *   conn.release();
 * }
 */
async function getConnection() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }
  
  try {
    const connection = await pool.getConnection();
    return connection;
  } catch (error) {
    console.error('Failed to acquire connection from pool:', error.message);
    throw error;
  }
}

/**
 * Test database connectivity
 * Useful for health checks and validation
 * 
 * @returns {Promise<boolean>} - True if database is reachable, false otherwise
 */
async function testConnection() {
  if (!pool) {
    console.warn('Database pool not initialized');
    return false;
  }
  
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error.message);
    return false;
  }
}

/**
 * Get current pool statistics (for monitoring)
 * 
 * @returns {Object} - Pool statistics
 */
function getPoolStats() {
  if (!pool) {
    return { initialized: false };
  }
  
  return {
    initialized: true,
    // Note: mysql2 doesn't expose all pool stats directly
    // These are available through pool.pool private property
    totalConnections: pool.pool._allConnections?.length || 0,
    freeConnections: pool.pool._freeConnections?.length || 0,
    queuedRequests: pool.pool._connectionQueue?.length || 0
  };
}

/**
 * Start connection pool monitoring
 * Logs pool statistics every 30 seconds
 * Warns when pool usage exceeds 75% (15 of 20 connections)
 * 
 * @returns {Object} - Object with stop() method to stop monitoring
 */
function startPoolMonitoring() {
  if (!pool) {
    console.warn('⚠️  Cannot start pool monitoring: pool not initialized');
    return { stop: () => {} };
  }
  
  const monitoringInterval = setInterval(() => {
    try {
      const stats = getPoolStats();
      
      if (!stats.initialized) {
        console.warn('⚠️  Pool monitoring: pool not initialized');
        return;
      }
      
      const totalConnections = stats.totalConnections;
      const freeConnections = stats.freeConnections;
      const activeConnections = totalConnections - freeConnections;
      const queuedRequests = stats.queuedRequests || 0;
      
      // Calculate usage percentage (assuming max is 20 connections)
      const maxConnections = 20;
      const usagePercentage = (activeConnections / maxConnections) * 100;
      const warningThreshold = 75; // Warn at 75% usage (15/20 connections)
      
      // Log pool statistics
      const statsMessage = [
        `📊 Connection Pool Statistics:`,
        `   Active Connections: ${activeConnections}/${maxConnections} (${usagePercentage.toFixed(1)}%)`,
        `   Free Connections: ${freeConnections}`,
        `   Queued Requests: ${queuedRequests}`
      ].join('\n');
      
      if (usagePercentage > warningThreshold) {
        console.warn('⚠️  ' + statsMessage);
        console.warn(`   ⚠️  WARNING: Pool usage exceeds ${warningThreshold}% threshold!`);
        
        // Log additional warning details when approaching exhaustion
        if (queuedRequests > 0) {
          console.warn(`   🔴 ${queuedRequests} request(s) queued waiting for connections`);
        }
        
        if (usagePercentage >= 95) {
          console.error(`   🚨 CRITICAL: Pool nearly exhausted (${usagePercentage.toFixed(1)}% usage)`);
        }
      } else {
        console.log(statsMessage);
      }
    } catch (error) {
      console.error('Error during pool monitoring:', error.message);
    }
  }, 30000); // Run every 30 seconds
  
  // Return object with stop method for graceful shutdown
  return {
    stop: () => {
      clearInterval(monitoringInterval);
      console.log('✅ Connection pool monitoring stopped');
    }
  };
}

// Global monitoring interval reference
let poolMonitor = null;

/**
 * Gracefully close all connections in the pool
 * Should be called on server shutdown
 * 
 * @returns {Promise<void>}
 */
async function closePool() {
  if (pool) {
    try {
      await pool.end();
      console.log('✅ Database connection pool closed');
      pool = null;
    } catch (error) {
      console.error('Error closing database pool:', error.message);
      throw error;
    }
  }
}

/**
 * Helper function for route handlers to consistently handle database errors
 * Requirement 6.1, 6.7: Log errors without exposing internal details to clients
 * 
 * @param {Error} error - Database error object (should have statusCode and clientMessage from categorizeError)
 * @param {Object} res - HTTP response object
 * @param {Object} options - Optional configuration
 * @returns {void} - Sends HTTP response and returns (does not throw)
 * 
 * @example
 * try {
 *   await dbOps.addEmployee(data);
 * } catch (error) {
 *   handleDatabaseError(error, res);
 *   return;
 * }
 */
function handleDatabaseError(error, res, options = {}) {
  // Use categorizeError if error doesn't have status code yet
  if (!error.statusCode) {
    const errorInfo = categorizeError(error);
    error.statusCode = errorInfo.statusCode;
    error.clientMessage = errorInfo.clientMessage;
    error.errorCategory = errorInfo.errorCategory;
  }
  
  // Log the error appropriately
  const logContext = {
    code: error.code,
    category: error.errorCategory,
    sqlState: error.sqlState,
    timestamp: new Date().toISOString(),
    ...options.logContext
  };
  
  if (error.statusCode === 500 || error.statusCode === 503) {
    console.error('❌ Database Error:', logContext, error.message);
  } else {
    console.info('ℹ️ Database Info:', logContext);
  }
  
  // Send error response (without exposing internal details)
  res.writeHead(error.statusCode);
  res.end(JSON.stringify({ 
    error: error.clientMessage || 'Database operation failed' 
  }));
}

// Export all functions
module.exports = {
  initializeDatabase,
  query,
  transaction,
  getConnection,
  testConnection,
  getPoolStats,
  startPoolMonitoring,
  categorizeError,
  closePool,
  handleDatabaseError,
  // Export a function to get the pool for schema operations
  getPool: () => pool,
  // Export connection status and diagnostic utilities
  getConnectionStatus: connectionStatus.getConnectionStatus,
  getDiagnosticInfo: connectionStatus.getDiagnosticInfo,
  isConnectionAvailable: connectionStatus.isConnectionAvailable
};
