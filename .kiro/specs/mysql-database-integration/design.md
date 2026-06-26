# Design Document: MySQL Database Integration

## Overview

### Purpose

This design document specifies the architecture for migrating the Employee Management System from ephemeral file-based storage (data.json) to persistent MySQL database storage. The current system, deployed on Render.com's free tier, loses all data on container restarts due to ephemeral file systems. This migration ensures data persistence, improves reliability, and maintains full backward compatibility with existing frontend code.

### Scope

The design covers:
- MySQL connection management with pooling for efficient resource utilization
- Database schema design preserving all existing data structures
- One-time data migration script to transfer data.json contents to MySQL
- Replacement of all file-based CRUD operations with parameterized SQL queries
- Transaction support for multi-step operations ensuring data consistency
- Comprehensive error handling and recovery mechanisms
- Environment-specific configuration for development and production
- Performance optimization strategies matching or exceeding file-based performance

### Key Design Decisions

1. **mysql2 Node.js Library**: Selected for native Promise support, connection pooling, and prepared statement capabilities
2. **Connection Pooling**: Configured with 5-20 connections to balance resource usage with concurrent request handling
3. **Soft Deletes**: Employee deletions set status='inactive' rather than physical deletion to preserve audit trails
4. **Parameterized Queries**: All SQL uses parameterized queries to prevent SQL injection attacks
5. **Schema-First Migration**: Database tables created before data migration to enforce constraints
6. **Backward Compatible JSON**: Database results transformed to match exact JSON structure expected by frontend

## Architecture

### High-Level Architecture

```
┌─────────────────────┐
│   HTTP Clients      │
│   (Browsers)        │
└──────────┬──────────┘
           │
           │ HTTP Requests
           ▼
┌─────────────────────┐
│   simple-server.js  │
│   (Node.js HTTP)    │
│   ┌───────────────┐ │
│   │ Route Handler │ │
│   └───────┬───────┘ │
│           │         │
│   ┌───────▼───────┐ │
│   │ Database Layer│ │
│   │ (mysql2)      │ │
│   └───────┬───────┘ │
└───────────┼─────────┘
            │
            │ SQL Queries
            ▼
┌─────────────────────┐
│   MySQL Database    │
│   ┌───────────────┐ │
│   │employees      │ │
│   │users          │ │
│   │departments    │ │
│   │attendance_    │ │
│   │  records      │ │
│   │leave_requests │ │
│   │notifications  │ │
│   │attendance_    │ │
│   │  policy       │ │
│   └───────────────┘ │
└─────────────────────┘
```

### Component Interaction Flow

1. **Server Startup**: Initialize connection pool → Validate connectivity → Start accepting HTTP requests
2. **Query Execution**: HTTP request → Route handler → Acquire connection from pool → Execute parameterized SQL → Transform result to JSON → Release connection → Return HTTP response
3. **Transaction Flow**: Begin transaction → Execute multiple SQL statements → Commit on success OR Rollback on error → Release connection

### Database Connection Pool Management

The system uses mysql2's built-in connection pooling:

```javascript
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  connectionLimit: 20,
  queueLimit: 0,
  waitForConnections: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});
```

## Components and Interfaces

### Database Connection Module

**Purpose**: Manage MySQL connection pool lifecycle and provide query execution interfaces

**Interface**:
```javascript
// Initialize connection pool
function initializeDatabase()

// Execute single query
async function query(sql, params) -> Promise<rows>

// Execute transaction
async function transaction(callback) -> Promise<result>

// Get connection from pool for complex operations
async function getConnection() -> Promise<connection>

// Test database connectivity
async function testConnection() -> Promise<boolean>
```

**Responsibilities**:
- Create and configure connection pool on server startup
- Provide parameterized query execution interface
- Manage transaction lifecycle (begin, commit, rollback)
- Handle connection acquisition and release
- Implement connection retry logic with exponential backoff
- Log connection errors with context

### Schema Initialization Module

**Purpose**: Create database tables with proper structure, indexes, and constraints

**Interface**:
```javascript
// Create all tables if they don't exist
async function createTables()

// Create indexes for query optimization
async function createIndexes()

// Verify schema matches expected structure
async function validateSchema() -> Promise<boolean>
```

**Responsibilities**:
- Execute CREATE TABLE statements with appropriate data types
- Define primary keys, foreign keys, and unique constraints
- Create indexes on frequently queried columns
- Handle schema evolution (future migrations)

### Data Migration Module

**Purpose**: One-time migration of data.json contents to MySQL database

**Interface**:
```javascript
// Main migration entry point
async function migrate()

// Backup data.json before migration
function backupDataFile() -> string (backup filename)

// Migrate employees array
async function migrateEmployees(employees) -> Promise<{success: number, failed: number}>

// Migrate users object
async function migrateUsers(users) -> Promise<{success: number, failed: number}>

// Migrate other entities (departments, attendance, leave, notifications)
async function migrateEntity(entityName, data) -> Promise<{success: number, failed: number}>

// Verify migration completeness
async function verifyMigration(sourceData) -> Promise<{valid: boolean, issues: []}>
```

**Responsibilities**:
- Read and validate data.json structure
- Transform JSON data types to SQL types (string numbers to INT/DECIMAL, date strings to DATE)
- Create timestamped backup of data.json
- Insert data with error handling per record
- Log migration progress and errors
- Generate migration summary report
- Verify row counts match source data

### CRUD Operations Module

**Purpose**: Replace file-based operations with SQL queries for each entity type

**Employee Operations**:
```javascript
async function getEmployees(filters) -> Promise<Employee[]>
async function getEmployeeById(id) -> Promise<Employee>
async function addEmployee(employeeData, userData) -> Promise<{employeeId, userId}>
async function updateEmployee(id, updates) -> Promise<boolean>
async function deleteEmployee(id) -> Promise<boolean> // Soft delete
```

**Attendance Operations**:
```javascript
async function getTodayAttendance(employeeId) -> Promise<AttendanceRecord>
async function recordAttendance(employeeId, type, action, time) -> Promise<AttendanceRecord>
async function getAttendanceHistory(filters) -> Promise<AttendanceRecord[]>
async function updateAttendance(id, updates) -> Promise<boolean>
```

**Leave Request Operations**:
```javascript
async function getLeaveRequests(filters) -> Promise<LeaveRequest[]>
async function createLeaveRequest(requestData) -> Promise<number> // Returns request ID
async function updateLeaveRequestStatus(id, status, notes) -> Promise<boolean>
```

**Notification Operations**:
```javascript
async function getNotifications(recipientEmail, limit) -> Promise<Notification[]>
async function createNotification(notificationData) -> Promise<number>
async function markNotificationRead(id) -> Promise<boolean>
async function markNotificationsViewed(recipientEmail) -> Promise<number> // Returns count updated
```

**Department Operations**:
```javascript
async function getDepartments() -> Promise<Department[]>
async function addDepartment(name, description) -> Promise<number>
```

**User Operations**:
```javascript
async function getUserByEmail(email) -> Promise<User>
async function updateUserPassword(email, newPassword) -> Promise<boolean>
```

**Responsibilities**:
- Replace fs.readFileSync/writeFileSync calls with SQL queries
- Use parameterized queries for all user input
- Transform database results to match frontend JSON expectations
- Handle NULL values appropriately
- Convert MySQL types to JavaScript types (DECIMAL to number, DATE to ISO string)

### Transaction Manager Module

**Purpose**: Provide transaction support for multi-step operations

**Interface**:
```javascript
// Execute operations within transaction context
async function withTransaction(callback) -> Promise<result>

// Example usage:
await withTransaction(async (connection) => {
  await connection.query('INSERT INTO employees ...', [params]);
  await connection.query('INSERT INTO users ...', [params]);
  // Both succeed or both rollback
});
```

**Operations Requiring Transactions**:
1. **Add Employee**: Insert into employees table + Insert into users table
2. **Update Leave Request**: Update leave_requests table + Insert notification
3. **Delete Employee**: Update employees.status + Update users status (if exists)

## Data Models

### Employees Table

```sql
CREATE TABLE employees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id VARCHAR(50) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  father_name VARCHAR(100),
  gfather_name VARCHAR(100),
  email VARCHAR(255) NOT NULL UNIQUE,
  department VARCHAR(100),
  job_title VARCHAR(100),
  salary DECIMAL(10,2),
  start_date DATE,
  phone VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active',
  annual_leave_days INT,
  leave_start_year INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  updated_by VARCHAR(255),
  photo TEXT,
  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_department (department)
);
```

**Field Mappings from JSON**:
- JSON number strings (e.g., "52040") → DECIMAL/INT
- JSON date strings → MySQL DATE
- JSON timestamps → MySQL DATETIME
- Empty strings → NULL where appropriate

### Users Table

```sql
CREATE TABLE users (
  email VARCHAR(255) PRIMARY KEY,
  id INT NOT NULL UNIQUE,
  role VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  INDEX idx_id (id)
);
```

**Note**: Users table uses email as primary key to match existing authentication logic. The id field references employees.id for linking.

### Departments Table

```sql
CREATE TABLE departments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT
);
```

### Attendance Records Table

```sql
CREATE TABLE attendance_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  morning_checkin TIME,
  morning_checkout TIME,
  afternoon_checkin TIME,
  afternoon_checkout TIME,
  total_hours DECIMAL(5,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'present',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  updated_by VARCHAR(255),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE KEY unique_employee_date (employee_id, date),
  INDEX idx_employee_id (employee_id),
  INDEX idx_date (date),
  INDEX idx_employee_date (employee_id, date)
);
```

**UPSERT Pattern**: Use `INSERT ... ON DUPLICATE KEY UPDATE` for attendance records to handle same-day check-ins/check-outs.

### Leave Requests Table

```sql
CREATE TABLE leave_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  leave_type VARCHAR(50) NOT NULL,
  leave_duration VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  days_requested DECIMAL(5,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at DATE NOT NULL,
  created_by VARCHAR(255),
  notes TEXT,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  updated_by VARCHAR(255),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_employee_id (employee_id),
  INDEX idx_status (status),
  INDEX idx_dates (start_date, end_date)
);
```

### Notifications Table

```sql
CREATE TABLE notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  sender_email VARCHAR(255),
  related_id INT,
  related_type VARCHAR(50),
  is_read BOOLEAN DEFAULT FALSE,
  is_viewed BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  priority VARCHAR(20) DEFAULT 'normal',
  viewed_at DATETIME,
  INDEX idx_recipient (recipient_email),
  INDEX idx_read_status (recipient_email, is_read),
  INDEX idx_created_at (created_at)
);
```

### Attendance Policy Table

```sql
CREATE TABLE attendance_policy (
  id INT PRIMARY KEY AUTO_INCREMENT,
  morning_start TIME NOT NULL,
  morning_end TIME NOT NULL,
  afternoon_start TIME NOT NULL,
  afternoon_end TIME NOT NULL,
  late_tolerance INT DEFAULT 15,
  early_tolerance INT DEFAULT 5,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  updated_by VARCHAR(255)
);
```

**Note**: This table contains a single row with global policy settings. Initial migration inserts one row from data.json attendancePolicy object.

### Data Type Conversions

| JSON Type | MySQL Type | Conversion Rule |
|-----------|------------|----------------|
| String numbers ("52040") | DECIMAL(10,2) or INT | Parse to number, validate range |
| ISO date strings ("2025-12-24") | DATE | Validate format, convert to DATE |
| ISO datetime strings | DATETIME | Convert to MySQL DATETIME format |
| Boolean (true/false) | BOOLEAN (TINYINT(1)) | Direct mapping |
| null | NULL | Preserve NULL values |
| Empty string | NULL or empty string | Context-dependent (numbers/dates → NULL) |
| Objects (photo: {}) | TEXT (JSON string) | JSON.stringify for storage, JSON.parse on retrieval |

## Error Handling

### Connection Errors

**Scenario**: Database connection fails during startup

**Handling Strategy**:
1. Log error with full connection details (excluding password)
2. Retry connection 3 times with 5-second intervals
3. In production (NODE_ENV=production): Exit process with code 1 for container restart
4. In development: Continue running, display error page on requests

**Implementation**:
```javascript
async function initializeDatabase() {
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('✅ Database connected successfully');
      return true;
    } catch (error) {
      console.error(`❌ Database connection failed (attempt ${i+1}/${maxRetries}):`, error.message);
      if (i < maxRetries - 1) await sleep(5000);
    }
  }
  
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: Could not connect to database in production');
    process.exit(1);
  }
  return false;
}
```

### Query Timeout Errors

**Scenario**: SQL query exceeds 30-second timeout

**Handling Strategy**:
1. Configure query timeout in connection pool options
2. Cancel hanging query
3. Log timeout error with query context (sanitized)
4. Return HTTP 500 with generic error message
5. Connection automatically returns to pool

**Implementation**:
```javascript
const pool = mysql.createPool({
  // ... other config
  connectTimeout: 10000,
  timeout: 30000
});
```

### Constraint Violation Errors

**Foreign Key Violations**:
- **Cause**: Attempting to insert attendance/leave record for non-existent employee
- **Response**: HTTP 400 with message "Invalid employee reference"
- **Log**: Warning level with details

**Unique Constraint Violations**:
- **Cause**: Duplicate email or employee_id
- **Response**: HTTP 409 with message "Email already exists" or "Employee ID already exists"
- **Log**: Info level

**Implementation**:
```javascript
try {
  await query('INSERT INTO employees ...', params);
} catch (error) {
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Email or Employee ID already exists' });
  }
  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ error: 'Invalid employee reference' });
  }
  // Generic error
  console.error('Database error:', error);
  return res.status(500).json({ error: 'Database operation failed' });
}
```

### Transaction Rollback

**Scenario**: One operation in a multi-step transaction fails

**Handling Strategy**:
1. Automatically rollback all operations in transaction
2. Log rollback reason with transaction context
3. Return error to client with appropriate HTTP status
4. Release connection back to pool

**Implementation**:
```javascript
async function withTransaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    console.error('Transaction rolled back:', error);
    throw error;
  } finally {
    connection.release();
  }
}
```

### Connection Pool Exhaustion

**Scenario**: All 20 connections are in use, new request arrives

**Handling Strategy**:
1. Queue request (queueLimit: 0 means unlimited queue)
2. Wait for connection to become available
3. If wait exceeds 30 seconds, timeout and return error
4. Log pool statistics for monitoring

**Monitoring**:
```javascript
// Periodically log pool stats
setInterval(() => {
  const stats = pool.pool._allConnections.length;
  if (stats > 15) {
    console.warn(`⚠️ Connection pool usage high: ${stats}/20 connections`);
  }
}, 60000);
```

### Data Integrity Errors

**Scenario**: Migration encounters malformed data in data.json

**Handling Strategy**:
1. Validate each record before insertion
2. Skip invalid records and log detailed error
3. Continue processing remaining records
4. Include failed records in migration summary
5. Generate report of failed records for manual review

**Validation Functions**:
```javascript
function validateEmployee(emp) {
  if (!emp.email || !isValidEmail(emp.email)) return { valid: false, reason: 'Invalid email' };
  if (!emp.employee_id) return { valid: false, reason: 'Missing employee_id' };
  if (emp.salary && isNaN(parseFloat(emp.salary))) return { valid: false, reason: 'Invalid salary' };
  return { valid: true };
}
```

## Testing Strategy

### Testing Approach for Database Integration

This feature involves database migration and infrastructure integration, which is **NOT suitable for property-based testing**. Property-based testing works best for pure functions with universal properties across wide input spaces. Database operations involve:

- External infrastructure dependencies (MySQL server)
- Side effects (data persistence, connection state)
- Configuration and environment setup
- One-time migration operations

Therefore, this feature will use:
1. **Unit tests** with mocked database connections for business logic
2. **Integration tests** against a real test database
3. **Manual testing** for migration script validation
4. **Smoke tests** for production deployment verification

### Unit Tests (with Mocks)

**Purpose**: Test business logic without database dependencies

**Test Cases**:
1. Data validation functions (validateEmployee, isValidEmail)
2. JSON-to-SQL type conversion functions
3. Query parameter sanitization
4. Error message formatting
5. Transaction callback error handling

**Example Test**:
```javascript
describe('validateEmployee', () => {
  test('rejects employee with invalid email', () => {
    const result = validateEmployee({ email: 'invalid', employee_id: '001' });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Invalid email');
  });
  
  test('accepts valid employee data', () => {
    const result = validateEmployee({
      email: 'test@company.com',
      employee_id: '001',
      salary: '50000'
    });
    expect(result.valid).toBe(true);
  });
});
```

### Integration Tests (with Test Database)

**Purpose**: Verify database operations against real MySQL instance

**Setup**:
- Use separate test database (e.g., employee_system_test)
- Reset database to known state before each test suite
- Use Docker container for test MySQL instance

**Test Cases**:

1. **Connection Management**:
   - Test pool initialization succeeds with valid credentials
   - Test pool initialization fails with invalid credentials
   - Test retry logic on connection failure
   - Test connection acquisition and release

2. **Schema Creation**:
   - Test all tables created successfully
   - Test indexes created on expected columns
   - Test foreign key constraints exist

3. **CRUD Operations**:
   - Test employee creation inserts into both employees and users tables
   - Test employee retrieval returns correct JSON structure
   - Test employee update modifies correct fields
   - Test employee deletion sets status to 'inactive'
   - Test attendance record UPSERT pattern
   - Test leave request creation with notification

4. **Transaction Behavior**:
   - Test successful transaction commits all changes
   - Test failed operation rolls back entire transaction
   - Test concurrent transactions don't deadlock

5. **Error Handling**:
   - Test duplicate email returns 409 status
   - Test foreign key violation returns 400 status
   - Test query timeout handling
   - Test NULL value handling in queries

6. **Data Type Conversions**:
   - Test string numbers converted to DECIMAL
   - Test date strings converted to DATE
   - Test boolean values stored correctly
   - Test NULL values preserved

**Example Integration Test**:
```javascript
describe('Employee CRUD Operations', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });
  
  test('addEmployee creates employee and user record', async () => {
    const employeeData = {
      employee_id: 'TEST001',
      first_name: 'Test',
      email: 'test@company.com',
      salary: 50000
    };
    const userData = { role: 'employee', password: 'test123' };
    
    const result = await addEmployee(employeeData, userData);
    expect(result.employeeId).toBeDefined();
    
    const employee = await getEmployeeById(result.employeeId);
    expect(employee.email).toBe('test@company.com');
    expect(employee.salary).toBe(50000); // Converted to number
    
    const user = await getUserByEmail('test@company.com');
    expect(user.role).toBe('employee');
  });
});
```

### Migration Script Testing

**Purpose**: Validate data migration from data.json to MySQL

**Test Approach**:
1. Use a copy of production data.json as test input
2. Run migration script against test database
3. Verify row counts match source data
4. Verify sample records migrated correctly
5. Verify data integrity (foreign keys, relationships)

**Manual Verification Queries**:
```sql
-- Verify row counts
SELECT 'employees' AS table_name, COUNT(*) AS count FROM employees
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'departments', COUNT(*) FROM departments
UNION ALL
SELECT 'attendance_records', COUNT(*) FROM attendance_records
UNION ALL
SELECT 'leave_requests', COUNT(*) FROM leave_requests
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications;

-- Verify data types
SELECT employee_id, salary, start_date, created_at 
FROM employees 
LIMIT 5;

-- Verify relationships
SELECT e.employee_id, e.email, u.role 
FROM employees e 
LEFT JOIN users u ON e.email = u.email 
LIMIT 5;

-- Check for orphaned records
SELECT * FROM attendance_records 
WHERE employee_id NOT IN (SELECT id FROM employees);
```

### Backward Compatibility Testing

**Purpose**: Ensure API responses match frontend expectations

**Test Cases**:
1. Compare JSON structure of database-backed endpoints vs file-backed endpoints
2. Verify date format consistency (ISO 8601 strings)
3. Verify number format (no string numbers in responses)
4. Verify null handling matches previous behavior
5. Verify array ordering matches previous behavior

**Example Test**:
```javascript
test('getEmployees returns same JSON structure as file-based version', async () => {
  // Assumes test data matches known file-based output
  const result = await getEmployees({ status: 'active' });
  
  expect(result[0]).toHaveProperty('id');
  expect(result[0]).toHaveProperty('employee_id');
  expect(result[0]).toHaveProperty('email');
  expect(typeof result[0].salary).toBe('number'); // Not string
  expect(result[0].start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // ISO date
});
```

### Performance Testing

**Purpose**: Ensure database operations meet performance requirements

**Test Cases**:
1. getEmployees completes in <100ms for 1000 employees
2. addEmployee completes in <200ms including transaction
3. Attendance record query with date range completes in <50ms
4. Notification fetch (50 records) completes in <100ms
5. Connection pool handles 50 concurrent requests without exhaustion

**Load Testing**:
- Use Apache Bench or similar tool to simulate concurrent users
- Test with production-like data volume (500+ employees)
- Monitor connection pool usage under load
- Verify no connection leaks

### Smoke Tests for Production

**Purpose**: Verify production deployment is functional

**Test Checklist**:
1. ✓ Application starts successfully
2. ✓ Database connection established
3. ✓ All tables exist with correct schema
4. ✓ Login endpoint works (validates database read)
5. ✓ Add employee endpoint works (validates database write)
6. ✓ Attendance check-in works (validates UPSERT logic)
7. ✓ No errors in logs after 5 minutes of operation

### Test Environment Setup

**Local Development**:
```bash
# Install MySQL locally or use Docker
docker run --name mysql-dev -e MYSQL_ROOT_PASSWORD=root -p 3306:3306 -d mysql:8.0

# Create test database
mysql -u root -p
CREATE DATABASE employee_system;
CREATE DATABASE employee_system_test;

# Run tests
npm test
```

**CI/CD Pipeline**:
- Use GitHub Actions or similar
- Spin up MySQL container for integration tests
- Run migration script against test database
- Execute all test suites
- Generate coverage report

### Test Coverage Goals

- **Unit Tests**: 80% coverage for pure functions
- **Integration Tests**: Cover all CRUD operations and transactions
- **Error Handling**: Test all error paths (connection, constraint, timeout)
- **Migration**: 100% of data entities migrated successfully

### Testing Tools

- **Unit Testing**: Jest or Mocha
- **Integration Testing**: Jest with real MySQL connection
- **Database Setup**: Docker for MySQL test instances
- **Load Testing**: Apache Bench (ab) or Artillery
- **Assertion Library**: Jest expect or Chai
- **Test Database Reset**: Custom scripts to truncate and seed tables
