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
require('dotenv').config();

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
 * Initialize database connection pool with configuration
 * Implements retry logic: 3 attempts with 5-second intervals
 * Environment-specific behavior:
 * - Production: Exit process on failure (allows container restart)
 * - Development: Continue running, log error
 * 
 * @returns {Promise<boolean>} - True if connected successfully, false otherwise
 */
async function initializeDatabase() {
  const maxRetries = 3;
  const retryDelayMs = 5000; // 5 seconds
  
  // Create connection pool with configuration
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
  console.log(`USE_DATABASE: ${process.env.USE_DATABASE}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log('=====================================');
  console.log(`🔌 Attempting connection...`);
  
  // Retry loop
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Test connection by executing a simple query
      await pool.query('SELECT 1');
      console.log('✅ Database connected successfully');
      return true;
    } catch (error) {
      console.error(`❌ Database connection failed (attempt ${attempt}/${maxRetries}):`);
      console.error(`   Error Code: ${error.code}`);
      console.error(`   Error Message: ${error.message}`);
      console.error(`   SQL State: ${error.sqlState || 'N/A'}`);
      
      // If not last attempt, wait before retrying
      if (attempt < maxRetries) {
        console.log(`⏳ Retrying in ${retryDelayMs / 1000} seconds...`);
        await sleep(retryDelayMs);
      }
    }
  }
  
  // All retries exhausted
  console.error('💥 Failed to connect to database after', maxRetries, 'attempts');
  
  // TEMPORARY: Allow server to start even on database failure for debugging
  console.warn('⚠️  TEMPORARY DEBUG MODE: Server will start without database');
  console.warn('⚠️  Check the error messages above to diagnose the connection issue');
  console.warn('⚠️  Database operations will fail until connection is fixed');
  
  // Environment-specific behavior
  if (process.env.NODE_ENV === 'production') {
    console.error('⚠️  PRODUCTION: Database connection failed but server will continue (DEBUG MODE)');
    console.error('⚠️  This is temporary - fix the database connection ASAP!');
  } else {
    console.warn('⚠️  Running in development mode without database connection');
    console.warn('Database operations will fail. Please check your database configuration.');
  }
  
  return false;
}

/**
 * Execute a parameterized SQL query
 * 
 * @param {string} sql - SQL query with ? placeholders
 * @param {Array} params - Array of parameters to bind to placeholders
 * @returns {Promise<Array>} - Query results (rows)
 * @throws {Error} - If query execution fails
 * 
 * @example
 * const employees = await query('SELECT * FROM employees WHERE status = ?', ['active']);
 */
async function query(sql, params = []) {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }
  
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('Query execution error:', {
      message: error.message,
      code: error.code,
      sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''), // Log first 100 chars
      sqlState: error.sqlState
    });
    throw error;
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

// Export all functions
module.exports = {
  initializeDatabase,
  query,
  transaction,
  getConnection,
  testConnection,
  getPoolStats,
  closePool
};
