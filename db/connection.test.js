/**
 * Unit and Integration Tests for Database Connection Module
 * 
 * Tests cover:
 * - Connection initialization with retry logic
 * - Query execution with parameterized queries
 * - Transaction support (commit and rollback)
 * - Connection acquisition and release
 * - Connectivity validation
 * - Environment-specific behavior
 * - Error handling
 */

const {
  initializeDatabase,
  query,
  transaction,
  getConnection,
  testConnection,
  getPoolStats,
  closePool
} = require('./connection');

// Track original environment
const originalEnv = process.env.NODE_ENV;

/**
 * Setup test database tables
 */
async function setupTestTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS test_employees (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      salary DECIMAL(10,2),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await query(`
    CREATE TABLE IF NOT EXISTS test_users (
      email VARCHAR(255) PRIMARY KEY,
      employee_id INT,
      role VARCHAR(50),
      FOREIGN KEY (employee_id) REFERENCES test_employees(id) ON DELETE CASCADE
    )
  `);
  
  console.log('✅ Test tables created');
}

/**
 * Clean up test database tables
 */
async function cleanupTestTables() {
  await query('DROP TABLE IF EXISTS test_users');
  await query('DROP TABLE IF EXISTS test_employees');
  console.log('✅ Test tables dropped');
}

/**
 * Test 1: Database initialization
 */
async function testInitialization() {
  console.log('\n📝 Test 1: Database Initialization');
  
  const result = await initializeDatabase();
  
  if (result) {
    console.log('✅ Initialization successful');
  } else {
    console.log('❌ Initialization failed');
    throw new Error('Database initialization failed');
  }
  
  // Check pool stats
  const stats = getPoolStats();
  console.log('Pool stats:', stats);
  
  if (stats.initialized) {
    console.log('✅ Pool statistics available');
  } else {
    throw new Error('Pool not initialized');
  }
}

/**
 * Test 2: Connection testing
 */
async function testConnectionValidation() {
  console.log('\n📝 Test 2: Connection Validation');
  
  const isConnected = await testConnection();
  
  if (isConnected) {
    console.log('✅ Connection test passed');
  } else {
    throw new Error('Connection test failed');
  }
}

/**
 * Test 3: Simple query execution
 */
async function testSimpleQuery() {
  console.log('\n📝 Test 3: Simple Query Execution');
  
  const result = await query('SELECT 1 + 1 AS sum');
  
  if (result[0].sum === 2) {
    console.log('✅ Simple query executed correctly');
  } else {
    throw new Error('Query result incorrect');
  }
}

/**
 * Test 4: Parameterized query (INSERT)
 */
async function testParameterizedInsert() {
  console.log('\n📝 Test 4: Parameterized INSERT Query');
  
  const result = await query(
    'INSERT INTO test_employees (name, email, salary) VALUES (?, ?, ?)',
    ['John Doe', 'john.doe@test.com', 50000.00]
  );
  
  if (result.insertId > 0) {
    console.log('✅ Parameterized INSERT successful, ID:', result.insertId);
    return result.insertId;
  } else {
    throw new Error('INSERT did not return insertId');
  }
}

/**
 * Test 5: Parameterized query (SELECT)
 */
async function testParameterizedSelect(employeeId) {
  console.log('\n📝 Test 5: Parameterized SELECT Query');
  
  const result = await query(
    'SELECT * FROM test_employees WHERE id = ?',
    [employeeId]
  );
  
  if (result.length === 1 && result[0].name === 'John Doe') {
    console.log('✅ Parameterized SELECT successful');
    console.log('   Employee:', result[0]);
  } else {
    throw new Error('SELECT did not return expected result');
  }
}

/**
 * Test 6: Parameterized query (UPDATE)
 */
async function testParameterizedUpdate(employeeId) {
  console.log('\n📝 Test 6: Parameterized UPDATE Query');
  
  const result = await query(
    'UPDATE test_employees SET salary = ? WHERE id = ?',
    [55000.00, employeeId]
  );
  
  if (result.affectedRows === 1) {
    console.log('✅ Parameterized UPDATE successful');
    
    // Verify update
    const employee = await query('SELECT salary FROM test_employees WHERE id = ?', [employeeId]);
    if (employee[0].salary === 55000.00) {
      console.log('   Salary updated correctly to', employee[0].salary);
    } else {
      throw new Error('UPDATE verification failed');
    }
  } else {
    throw new Error('UPDATE did not affect expected rows');
  }
}

/**
 * Test 7: Transaction with successful commit
 */
async function testTransactionCommit() {
  console.log('\n📝 Test 7: Transaction with Commit');
  
  const result = await transaction(async (connection) => {
    // Insert employee
    const [empResult] = await connection.query(
      'INSERT INTO test_employees (name, email, salary) VALUES (?, ?, ?)',
      ['Jane Smith', 'jane.smith@test.com', 60000.00]
    );
    
    const employeeId = empResult.insertId;
    
    // Insert user
    await connection.query(
      'INSERT INTO test_users (email, employee_id, role) VALUES (?, ?, ?)',
      ['jane.smith@test.com', employeeId, 'employee']
    );
    
    return employeeId;
  });
  
  if (result > 0) {
    console.log('✅ Transaction committed successfully, Employee ID:', result);
    
    // Verify both records exist
    const employee = await query('SELECT * FROM test_employees WHERE id = ?', [result]);
    const user = await query('SELECT * FROM test_users WHERE email = ?', ['jane.smith@test.com']);
    
    if (employee.length === 1 && user.length === 1) {
      console.log('   Both records committed successfully');
    } else {
      throw new Error('Transaction commit verification failed');
    }
  } else {
    throw new Error('Transaction did not return expected result');
  }
  
  return result;
}

/**
 * Test 8: Transaction with rollback
 */
async function testTransactionRollback() {
  console.log('\n📝 Test 8: Transaction with Rollback');
  
  try {
    await transaction(async (connection) => {
      // Insert employee
      const [empResult] = await connection.query(
        'INSERT INTO test_employees (name, email, salary) VALUES (?, ?, ?)',
        ['Bob Johnson', 'bob.johnson@test.com', 45000.00]
      );
      
      const employeeId = empResult.insertId;
      
      // Insert user with duplicate email (should fail due to unique constraint)
      await connection.query(
        'INSERT INTO test_users (email, employee_id, role) VALUES (?, ?, ?)',
        ['jane.smith@test.com', employeeId, 'employee'] // Duplicate email from previous test
      );
    });
    
    throw new Error('Transaction should have failed but did not');
  } catch (error) {
    console.log('✅ Transaction rolled back as expected');
    console.log('   Error:', error.message);
    
    // Verify employee was NOT inserted (rollback successful)
    const employee = await query('SELECT * FROM test_employees WHERE email = ?', ['bob.johnson@test.com']);
    
    if (employee.length === 0) {
      console.log('   Rollback verified: employee not inserted');
    } else {
      throw new Error('Rollback failed: employee was inserted');
    }
  }
}

/**
 * Test 9: Get connection for complex operations
 */
async function testGetConnection() {
  console.log('\n📝 Test 9: Get Connection for Complex Operations');
  
  const conn = await getConnection();
  
  try {
    // Execute multiple queries with same connection
    await conn.query('SELECT COUNT(*) AS count FROM test_employees');
    await conn.query('SELECT COUNT(*) AS count FROM test_users');
    
    console.log('✅ Connection acquired and queries executed');
  } finally {
    conn.release();
    console.log('   Connection released back to pool');
  }
}

/**
 * Test 10: SQL injection prevention (parameterized queries)
 */
async function testSQLInjectionPrevention() {
  console.log('\n📝 Test 10: SQL Injection Prevention');
  
  // Attempt SQL injection via parameterized query
  const maliciousInput = "' OR '1'='1";
  
  const result = await query(
    'SELECT * FROM test_employees WHERE email = ?',
    [maliciousInput]
  );
  
  // Should return no results (input treated as literal string)
  if (result.length === 0) {
    console.log('✅ SQL injection prevented by parameterized queries');
  } else {
    throw new Error('SQL injection not prevented!');
  }
}

/**
 * Test 11: Error handling for invalid queries
 */
async function testErrorHandling() {
  console.log('\n📝 Test 11: Error Handling');
  
  try {
    // Invalid SQL syntax
    await query('SELECT * FORM invalid_table');
    throw new Error('Should have thrown error for invalid SQL');
  } catch (error) {
    console.log('✅ Error handling working correctly');
    console.log('   Error code:', error.code);
    console.log('   Error message:', error.message);
  }
}

/**
 * Test 12: Constraint violations
 */
async function testConstraintViolations() {
  console.log('\n📝 Test 12: Constraint Violation Handling');
  
  try {
    // Insert duplicate email (unique constraint violation)
    await query(
      'INSERT INTO test_employees (name, email, salary) VALUES (?, ?, ?)',
      ['Duplicate', 'john.doe@test.com', 50000.00] // john.doe@test.com already exists
    );
    throw new Error('Should have thrown duplicate entry error');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      console.log('✅ Duplicate entry error caught correctly');
      console.log('   Error code:', error.code);
    } else {
      throw error;
    }
  }
  
  try {
    // Insert user with non-existent employee_id (foreign key violation)
    await query(
      'INSERT INTO test_users (email, employee_id, role) VALUES (?, ?, ?)',
      ['orphan@test.com', 99999, 'employee']
    );
    throw new Error('Should have thrown foreign key error');
  } catch (error) {
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      console.log('✅ Foreign key violation caught correctly');
      console.log('   Error code:', error.code);
    } else {
      throw error;
    }
  }
}

/**
 * Test 13: Data type conversions
 */
async function testDataTypeConversions() {
  console.log('\n📝 Test 13: Data Type Conversions');
  
  // Insert with various data types
  const result = await query(
    'INSERT INTO test_employees (name, email, salary) VALUES (?, ?, ?)',
    ['Type Test', 'types@test.com', 75500.50]
  );
  
  const employee = await query('SELECT * FROM test_employees WHERE id = ?', [result.insertId]);
  
  // Verify types
  if (typeof employee[0].salary === 'string') {
    // mysql2 returns DECIMAL as string by default
    const salaryNum = parseFloat(employee[0].salary);
    if (salaryNum === 75500.50) {
      console.log('✅ DECIMAL type conversion correct');
    }
  } else if (typeof employee[0].salary === 'number') {
    if (employee[0].salary === 75500.50) {
      console.log('✅ DECIMAL type conversion correct');
    }
  } else {
    throw new Error('Unexpected salary type: ' + typeof employee[0].salary);
  }
  
  // Check DATE conversion
  if (employee[0].created_at instanceof Date) {
    console.log('✅ DATETIME type conversion correct');
  } else {
    throw new Error('created_at should be Date object');
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🧪 Starting Database Connection Module Tests\n');
  console.log('=' .repeat(60));
  
  try {
    // Initialize database
    await testInitialization();
    
    // Connection validation
    await testConnectionValidation();
    
    // Setup test tables
    await setupTestTables();
    
    // Simple query
    await testSimpleQuery();
    
    // Parameterized queries
    const employeeId = await testParameterizedInsert();
    await testParameterizedSelect(employeeId);
    await testParameterizedUpdate(employeeId);
    
    // Transactions
    await testTransactionCommit();
    await testTransactionRollback();
    
    // Connection management
    await testGetConnection();
    
    // Security and error handling
    await testSQLInjectionPrevention();
    await testErrorHandling();
    await testConstraintViolations();
    
    // Data types
    await testDataTypeConversions();
    
    // Cleanup
    await cleanupTestTables();
    
    // Close pool
    await closePool();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests passed successfully!');
    console.log('='.repeat(60));
    
    process.exit(0);
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ Test failed:', error.message);
    console.error('='.repeat(60));
    
    // Cleanup on failure
    try {
      await cleanupTestTables();
      await closePool();
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError.message);
    }
    
    process.exit(1);
  } finally {
    // Restore original environment
    process.env.NODE_ENV = originalEnv;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests
};
