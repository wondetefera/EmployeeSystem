/**
 * Integration test for handleGetLeaveRequests with database operations
 * 
 * This test verifies:
 * - Database query execution for leave requests
 * - JOIN with employees table works correctly
 * - Filtering by employee_id for regular employees
 * - Admin/manager users can see all leave requests
 */

const {
  initializeDatabase,
  query,
  transaction,
  closePool
} = require('./connection');

const dbOps = require('./operations');

/**
 * Setup test tables and seed data
 */
async function setupTestData() {
  // Clean up any existing test data
  await query('DELETE FROM leave_requests WHERE employee_name LIKE "Test%"');
  await query('DELETE FROM employees WHERE email LIKE "test%@testleave.com"');
  
  // Insert test employees
  const [emp1] = await query(
    `INSERT INTO employees (employee_id, first_name, last_name, email, department, status) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['TEST001', 'Test', 'Employee1', 'test1@testleave.com', 'IT', 'active']
  );
  
  const [emp2] = await query(
    `INSERT INTO employees (employee_id, first_name, last_name, email, department, status) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['TEST002', 'Test', 'Employee2', 'test2@testleave.com', 'HR', 'active']
  );
  
  const employee1Id = emp1.insertId;
  const employee2Id = emp2.insertId;
  
  // Insert test leave requests
  await query(
    `INSERT INTO leave_requests (employee_id, employee_name, leave_type, leave_duration, 
     start_date, end_date, days_requested, status, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [employee1Id, 'Test Employee1', 'annual', 'full_day', '2025-12-01', '2025-12-05', 5, 'pending', '2025-11-20']
  );
  
  await query(
    `INSERT INTO leave_requests (employee_id, employee_name, leave_type, leave_duration, 
     start_date, end_date, days_requested, status, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [employee2Id, 'Test Employee2', 'sick', 'full_day', '2025-12-10', '2025-12-12', 3, 'approved', '2025-11-21']
  );
  
  console.log('✅ Test data created');
  console.log('   Employee 1 ID:', employee1Id);
  console.log('   Employee 2 ID:', employee2Id);
  
  return { employee1Id, employee2Id };
}

/**
 * Cleanup test data
 */
async function cleanupTestData() {
  await query('DELETE FROM leave_requests WHERE employee_name LIKE "Test%"');
  await query('DELETE FROM employees WHERE email LIKE "test%@testleave.com"');
  console.log('✅ Test data cleaned up');
}

/**
 * Test 1: Get all leave requests (admin view)
 */
async function testGetAllLeaveRequests() {
  console.log('\n📝 Test 1: Get All Leave Requests (Admin View)');
  
  const requests = await dbOps.getLeaveRequests({});
  
  // Filter to only test requests
  const testRequests = requests.filter(r => r.employee_name.startsWith('Test'));
  
  if (testRequests.length >= 2) {
    console.log('✅ Successfully retrieved leave requests');
    console.log('   Found', testRequests.length, 'test leave requests');
    
    // Verify JOIN - each request should have employee email
    const hasEmail = testRequests.every(r => r.email && r.email.includes('@'));
    if (hasEmail) {
      console.log('✅ JOIN with employees table working - email field present');
    } else {
      throw new Error('JOIN failed - email field missing');
    }
  } else {
    throw new Error('Expected at least 2 leave requests, got ' + testRequests.length);
  }
}

/**
 * Test 2: Get leave requests filtered by employee
 */
async function testGetLeaveRequestsByEmployee(employeeId) {
  console.log('\n📝 Test 2: Get Leave Requests Filtered by Employee');
  
  const requests = await dbOps.getLeaveRequests({ employee_id: employeeId });
  
  if (requests.length === 1) {
    console.log('✅ Successfully filtered leave requests by employee_id');
    console.log('   Employee ID:', employeeId);
    console.log('   Request:', requests[0].employee_name, '-', requests[0].leave_type);
    
    // Verify the request belongs to the correct employee
    if (requests[0].employee_id === employeeId) {
      console.log('✅ Filtering working correctly');
    } else {
      throw new Error('Filter returned wrong employee request');
    }
    
    // Verify email is present from JOIN
    if (requests[0].email) {
      console.log('✅ JOIN working - email:', requests[0].email);
    } else {
      throw new Error('JOIN failed - no email field');
    }
  } else {
    throw new Error('Expected 1 leave request, got ' + requests.length);
  }
}

/**
 * Test 3: Get leave requests filtered by status
 */
async function testGetLeaveRequestsByStatus() {
  console.log('\n📝 Test 3: Get Leave Requests Filtered by Status');
  
  const pendingRequests = await dbOps.getLeaveRequests({ status: 'pending' });
  const testPending = pendingRequests.filter(r => r.employee_name.startsWith('Test'));
  
  if (testPending.length >= 1) {
    console.log('✅ Successfully filtered by status "pending"');
    console.log('   Found', testPending.length, 'pending test requests');
    
    // Verify all are pending
    const allPending = testPending.every(r => r.status === 'pending');
    if (allPending) {
      console.log('✅ Status filter working correctly');
    } else {
      throw new Error('Status filter returned non-pending requests');
    }
  } else {
    throw new Error('Expected at least 1 pending request');
  }
  
  const approvedRequests = await dbOps.getLeaveRequests({ status: 'approved' });
  const testApproved = approvedRequests.filter(r => r.employee_name.startsWith('Test'));
  
  if (testApproved.length >= 1) {
    console.log('✅ Successfully filtered by status "approved"');
    console.log('   Found', testApproved.length, 'approved test requests');
  }
}

/**
 * Test 4: Verify data type conversions
 */
async function testDataTypeConversions() {
  console.log('\n📝 Test 4: Data Type Conversions');
  
  const requests = await dbOps.getLeaveRequests({});
  const testRequest = requests.find(r => r.employee_name.startsWith('Test'));
  
  if (testRequest) {
    // Check days_requested is converted to number
    if (typeof testRequest.days_requested === 'number') {
      console.log('✅ days_requested converted to number:', testRequest.days_requested);
    } else {
      throw new Error('days_requested should be a number, got ' + typeof testRequest.days_requested);
    }
    
    // Check other fields
    if (typeof testRequest.employee_id === 'number') {
      console.log('✅ employee_id is number');
    }
    
    if (typeof testRequest.status === 'string') {
      console.log('✅ status is string');
    }
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🧪 Starting Leave Requests Database Operations Tests\n');
  console.log('=' .repeat(60));
  
  try {
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database initialized');
    
    // Setup test data
    const { employee1Id, employee2Id } = await setupTestData();
    
    // Run tests
    await testGetAllLeaveRequests();
    await testGetLeaveRequestsByEmployee(employee1Id);
    await testGetLeaveRequestsByStatus();
    await testDataTypeConversions();
    
    // Cleanup
    await cleanupTestData();
    await closePool();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All leave requests tests passed successfully!');
    console.log('='.repeat(60));
    
    process.exit(0);
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    console.error('='.repeat(60));
    
    // Cleanup on failure
    try {
      await cleanupTestData();
      await closePool();
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError.message);
    }
    
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests
};
