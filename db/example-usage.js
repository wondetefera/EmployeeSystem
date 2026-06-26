/**
 * Example Usage of Database Connection Module
 * 
 * This file demonstrates how to use the database connection module
 * in the Employee Management System.
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

/**
 * Example 1: Initialize database on server startup
 */
async function example1_Initialize() {
  console.log('Example 1: Initialize Database\n');
  
  const success = await initializeDatabase();
  
  if (success) {
    console.log('✅ Database initialized successfully\n');
  } else {
    console.log('❌ Database initialization failed\n');
  }
}

/**
 * Example 2: Simple SELECT query
 */
async function example2_SimpleSelect() {
  console.log('Example 2: Simple SELECT Query\n');
  
  try {
    const employees = await query(
      'SELECT * FROM employees WHERE status = ?',
      ['active']
    );
    
    console.log(`Found ${employees.length} active employees`);
    console.log('✅ Query executed successfully\n');
  } catch (error) {
    console.error('❌ Query failed:', error.message, '\n');
  }
}

/**
 * Example 3: INSERT query with auto-increment ID
 */
async function example3_Insert() {
  console.log('Example 3: INSERT Query\n');
  
  try {
    const result = await query(
      'INSERT INTO employees (employee_id, first_name, last_name, email, salary, status) VALUES (?, ?, ?, ?, ?, ?)',
      ['EMP001', 'John', 'Doe', 'john.doe@example.com', 50000, 'active']
    );
    
    console.log('✅ Employee inserted with ID:', result.insertId);
    console.log('   Affected rows:', result.affectedRows, '\n');
  } catch (error) {
    console.error('❌ Insert failed:', error.message, '\n');
  }
}

/**
 * Example 4: UPDATE query
 */
async function example4_Update() {
  console.log('Example 4: UPDATE Query\n');
  
  try {
    const result = await query(
      'UPDATE employees SET salary = ? WHERE email = ?',
      [55000, 'john.doe@example.com']
    );
    
    console.log('✅ Employee updated');
    console.log('   Affected rows:', result.affectedRows, '\n');
  } catch (error) {
    console.error('❌ Update failed:', error.message, '\n');
  }
}

/**
 * Example 5: Transaction with multiple operations
 */
async function example5_Transaction() {
  console.log('Example 5: Transaction (Employee + User)\n');
  
  try {
    const employeeId = await transaction(async (connection) => {
      // Step 1: Insert employee
      const [empResult] = await connection.query(
        'INSERT INTO employees (employee_id, first_name, email, salary, status) VALUES (?, ?, ?, ?, ?)',
        ['EMP002', 'Jane', 'jane@example.com', 60000, 'active']
      );
      
      const empId = empResult.insertId;
      
      // Step 2: Insert user (linked to employee)
      await connection.query(
        'INSERT INTO users (email, id, role, password) VALUES (?, ?, ?, ?)',
        ['jane@example.com', empId, 'employee', 'hashed_password']
      );
      
      return empId;
    });
    
    console.log('✅ Transaction committed successfully');
    console.log('   Employee ID:', employeeId, '\n');
  } catch (error) {
    console.error('❌ Transaction failed (rolled back):', error.message, '\n');
  }
}

/**
 * Example 6: Transaction with intentional failure (rollback)
 */
async function example6_TransactionRollback() {
  console.log('Example 6: Transaction Rollback\n');
  
  try {
    await transaction(async (connection) => {
      // This will succeed
      await connection.query(
        'INSERT INTO employees (employee_id, first_name, email, salary, status) VALUES (?, ?, ?, ?, ?)',
        ['EMP003', 'Bob', 'bob@example.com', 45000, 'active']
      );
      
      // This will fail (duplicate email from Example 5)
      await connection.query(
        'INSERT INTO users (email, id, role, password) VALUES (?, ?, ?, ?)',
        ['jane@example.com', 999, 'employee', 'password'] // Duplicate email!
      );
    });
  } catch (error) {
    console.log('✅ Transaction correctly rolled back on error');
    console.log('   Error:', error.message);
    console.log('   Bob was NOT inserted (rollback successful)\n');
  }
}

/**
 * Example 7: Get connection for complex operations
 */
async function example7_GetConnection() {
  console.log('Example 7: Get Connection\n');
  
  const conn = await getConnection();
  
  try {
    // Execute multiple queries with same connection
    const [employees] = await conn.query('SELECT COUNT(*) AS count FROM employees');
    const [users] = await conn.query('SELECT COUNT(*) AS count FROM users');
    
    console.log('✅ Executed multiple queries with single connection');
    console.log('   Employees count:', employees[0].count);
    console.log('   Users count:', users[0].count, '\n');
  } finally {
    // IMPORTANT: Always release connection
    conn.release();
    console.log('   Connection released back to pool\n');
  }
}

/**
 * Example 8: Test connection (health check)
 */
async function example8_HealthCheck() {
  console.log('Example 8: Health Check\n');
  
  const isHealthy = await testConnection();
  
  if (isHealthy) {
    console.log('✅ Database is healthy and reachable\n');
  } else {
    console.log('❌ Database is not reachable\n');
  }
}

/**
 * Example 9: Monitor pool statistics
 */
async function example9_PoolStats() {
  console.log('Example 9: Pool Statistics\n');
  
  const stats = getPoolStats();
  
  console.log('Pool Status:');
  console.log('  Initialized:', stats.initialized);
  console.log('  Total Connections:', stats.totalConnections);
  console.log('  Free Connections:', stats.freeConnections);
  console.log('  Queued Requests:', stats.queuedRequests);
  console.log('');
}

/**
 * Example 10: Error handling patterns
 */
async function example10_ErrorHandling() {
  console.log('Example 10: Error Handling\n');
  
  try {
    // Attempt to insert duplicate email
    await query(
      'INSERT INTO employees (employee_id, first_name, email, salary, status) VALUES (?, ?, ?, ?, ?)',
      ['EMP999', 'Duplicate', 'john.doe@example.com', 50000, 'active']
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      console.log('✅ Caught duplicate entry error correctly');
      console.log('   Error code:', error.code);
      console.log('   Should return HTTP 409 Conflict\n');
    } else {
      console.error('❌ Unexpected error:', error.message, '\n');
    }
  }
  
  try {
    // Attempt to insert with invalid foreign key
    await query(
      'INSERT INTO users (email, id, role, password) VALUES (?, ?, ?, ?)',
      ['orphan@example.com', 99999, 'employee', 'password']
    );
  } catch (error) {
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      console.log('✅ Caught foreign key violation correctly');
      console.log('   Error code:', error.code);
      console.log('   Should return HTTP 400 Bad Request\n');
    } else {
      console.error('❌ Unexpected error:', error.message, '\n');
    }
  }
}

/**
 * Example 11: Cleanup on server shutdown
 */
async function example11_Shutdown() {
  console.log('Example 11: Graceful Shutdown\n');
  
  await closePool();
  console.log('✅ Database pool closed gracefully\n');
}

/**
 * Main function to run all examples
 */
async function runExamples() {
  console.log('=' .repeat(70));
  console.log('Database Connection Module - Usage Examples');
  console.log('=' .repeat(70));
  console.log('');
  
  try {
    await example1_Initialize();
    
    // Only continue if initialization succeeded
    if (await testConnection()) {
      await example2_SimpleSelect();
      await example3_Insert();
      await example4_Update();
      await example5_Transaction();
      await example6_TransactionRollback();
      await example7_GetConnection();
      await example8_HealthCheck();
      await example9_PoolStats();
      await example10_ErrorHandling();
      await example11_Shutdown();
    } else {
      console.log('⚠️  Database not available. Cannot run remaining examples.\n');
      console.log('Please ensure:');
      console.log('  1. MySQL server is running');
      console.log('  2. Database "employee_system" exists');
      console.log('  3. .env file has correct credentials');
      console.log('  4. Tables are created (run schema initialization)\n');
    }
  } catch (error) {
    console.error('❌ Example failed:', error.message);
    console.error('Stack:', error.stack);
  }
  
  console.log('=' .repeat(70));
  console.log('Examples Complete');
  console.log('=' .repeat(70));
}

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = {
  runExamples
};
