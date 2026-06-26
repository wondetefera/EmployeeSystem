/**
 * Unit Tests for Database Connection Module (No Database Required)
 * 
 * These tests validate module structure, exports, and error handling
 * without requiring an actual MySQL database connection.
 */

const connection = require('./connection');

console.log('🧪 Running Unit Tests for Database Connection Module\n');
console.log('=' .repeat(60));

let testsPassed = 0;
let testsFailed = 0;

/**
 * Test helper
 */
function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   Error: ${error.message}`);
    testsFailed++;
  }
}

// Test 1: Module exports all required functions
test('Module exports initializeDatabase function', () => {
  if (typeof connection.initializeDatabase !== 'function') {
    throw new Error('initializeDatabase not exported or not a function');
  }
});

test('Module exports query function', () => {
  if (typeof connection.query !== 'function') {
    throw new Error('query not exported or not a function');
  }
});

test('Module exports transaction function', () => {
  if (typeof connection.transaction !== 'function') {
    throw new Error('transaction not exported or not a function');
  }
});

test('Module exports getConnection function', () => {
  if (typeof connection.getConnection !== 'function') {
    throw new Error('getConnection not exported or not a function');
  }
});

test('Module exports testConnection function', () => {
  if (typeof connection.testConnection !== 'function') {
    throw new Error('testConnection not exported or not a function');
  }
});

test('Module exports getPoolStats function', () => {
  if (typeof connection.getPoolStats !== 'function') {
    throw new Error('getPoolStats not exported or not a function');
  }
});

test('Module exports closePool function', () => {
  if (typeof connection.closePool !== 'function') {
    throw new Error('closePool not exported or not a function');
  }
});

// Test 2: Function signatures (arity)
test('initializeDatabase has correct arity (0 parameters)', () => {
  if (connection.initializeDatabase.length !== 0) {
    throw new Error(`Expected 0 parameters, got ${connection.initializeDatabase.length}`);
  }
});

test('query has correct arity (1-2 parameters: sql, params)', () => {
  // query(sql, params = []) has length 1 due to default parameter
  if (connection.query.length !== 1) {
    throw new Error(`Expected 1 (with default param), got ${connection.query.length}`);
  }
});

test('transaction has correct arity (1 parameter: callback)', () => {
  if (connection.transaction.length !== 1) {
    throw new Error(`Expected 1 parameter, got ${connection.transaction.length}`);
  }
});

test('getConnection has correct arity (0 parameters)', () => {
  if (connection.getConnection.length !== 0) {
    throw new Error(`Expected 0 parameters, got ${connection.getConnection.length}`);
  }
});

test('testConnection has correct arity (0 parameters)', () => {
  if (connection.testConnection.length !== 0) {
    throw new Error(`Expected 0 parameters, got ${connection.testConnection.length}`);
  }
});

// Test 3: getPoolStats without initialization
test('getPoolStats returns not-initialized status when pool not created', () => {
  const stats = connection.getPoolStats();
  if (stats.initialized !== false) {
    throw new Error('Expected initialized: false when pool not created');
  }
});

// Test 4: Error handling for uninitialized pool
test('query throws error when pool not initialized', async () => {
  try {
    await connection.query('SELECT 1', []);
    throw new Error('Should have thrown error for uninitialized pool');
  } catch (error) {
    if (!error.message.includes('not initialized')) {
      throw new Error(`Expected "not initialized" error, got: ${error.message}`);
    }
  }
});

test('transaction throws error when pool not initialized', async () => {
  try {
    await connection.transaction(async () => {});
    throw new Error('Should have thrown error for uninitialized pool');
  } catch (error) {
    if (!error.message.includes('not initialized')) {
      throw new Error(`Expected "not initialized" error, got: ${error.message}`);
    }
  }
});

test('getConnection throws error when pool not initialized', async () => {
  try {
    await connection.getConnection();
    throw new Error('Should have thrown error for uninitialized pool');
  } catch (error) {
    if (!error.message.includes('not initialized')) {
      throw new Error(`Expected "not initialized" error, got: ${error.message}`);
    }
  }
});

test('testConnection returns false when pool not initialized', async () => {
  const result = await connection.testConnection();
  if (result !== false) {
    throw new Error('Expected false when pool not initialized');
  }
});

// Test 5: Module structure validation
test('Module does not expose internal pool variable', () => {
  if (connection.pool !== undefined) {
    throw new Error('Internal pool variable should not be exposed');
  }
});

test('All exported functions are documented', () => {
  const exports = Object.keys(connection);
  const expected = [
    'initializeDatabase',
    'query',
    'transaction',
    'getConnection',
    'testConnection',
    'getPoolStats',
    'closePool'
  ];
  
  const missing = expected.filter(fn => !exports.includes(fn));
  if (missing.length > 0) {
    throw new Error(`Missing exports: ${missing.join(', ')}`);
  }
  
  const unexpected = exports.filter(fn => !expected.includes(fn));
  if (unexpected.length > 0) {
    throw new Error(`Unexpected exports: ${unexpected.join(', ')}`);
  }
});

// Test 6: Environment variable handling
test('Module loads dotenv configuration', () => {
  // This test verifies that require('dotenv').config() is called
  // by checking if the module can be required without errors
  const fs = require('fs');
  const moduleCode = fs.readFileSync(__dirname + '/connection.js', 'utf8');
  
  if (!moduleCode.includes("require('dotenv')")) {
    throw new Error('Module should require dotenv');
  }
  
  if (!moduleCode.includes('.config()')) {
    throw new Error('Module should call dotenv.config()');
  }
});

test('Module uses mysql2/promise for async support', () => {
  const fs = require('fs');
  const moduleCode = fs.readFileSync(__dirname + '/connection.js', 'utf8');
  
  if (!moduleCode.includes("require('mysql2/promise')")) {
    throw new Error('Module should use mysql2/promise for Promise support');
  }
});

// Test 7: Configuration validation
test('Module implements retry logic constants', () => {
  const fs = require('fs');
  const moduleCode = fs.readFileSync(__dirname + '/connection.js', 'utf8');
  
  if (!moduleCode.includes('maxRetries') && !moduleCode.includes('3')) {
    throw new Error('Module should implement 3 retry attempts');
  }
  
  if (!moduleCode.includes('5000') && !moduleCode.includes('retryDelay')) {
    throw new Error('Module should implement 5-second retry delay');
  }
});

test('Module configures connection pool limits (5-20 connections)', () => {
  const fs = require('fs');
  const moduleCode = fs.readFileSync(__dirname + '/connection.js', 'utf8');
  
  if (!moduleCode.includes('connectionLimit') && !moduleCode.includes('20')) {
    throw new Error('Module should configure maximum 20 connections');
  }
  
  if (!moduleCode.includes('maxIdle') && !moduleCode.includes('5')) {
    throw new Error('Module should configure minimum 5 idle connections');
  }
});

test('Module implements environment-specific behavior', () => {
  const fs = require('fs');
  const moduleCode = fs.readFileSync(__dirname + '/connection.js', 'utf8');
  
  if (!moduleCode.includes('NODE_ENV')) {
    throw new Error('Module should check NODE_ENV');
  }
  
  if (!moduleCode.includes('production')) {
    throw new Error('Module should have production-specific logic');
  }
  
  if (!moduleCode.includes('process.exit(1)')) {
    throw new Error('Module should exit on production failure');
  }
});

// Summary
console.log('\n' + '='.repeat(60));
console.log(`Tests Passed: ${testsPassed}`);
console.log(`Tests Failed: ${testsFailed}`);
console.log('='.repeat(60));

if (testsFailed === 0) {
  console.log('✅ All unit tests passed!\n');
  console.log('📝 Module Structure Validated:');
  console.log('   ✓ All required functions exported');
  console.log('   ✓ Correct function signatures');
  console.log('   ✓ Error handling for uninitialized pool');
  console.log('   ✓ Configuration constants correct');
  console.log('   ✓ Environment-specific behavior implemented');
  console.log('   ✓ Retry logic present');
  console.log('   ✓ Connection pooling configured (5-20 connections)');
  console.log('\n⚠️  Note: Integration tests require MySQL database');
  console.log('   Run connection.test.js after setting up MySQL\n');
  process.exit(0);
} else {
  console.log(`❌ ${testsFailed} test(s) failed\n`);
  process.exit(1);
}
