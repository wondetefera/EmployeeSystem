# Implementation Plan: MySQL Database Integration

## Overview

This implementation plan guides the migration from ephemeral file-based storage (data.json) to persistent MySQL database storage. The migration ensures data persistence on Render.com, maintains full backward compatibility with existing frontend code, and follows the architecture defined in the design document. All tasks use JavaScript/Node.js with the mysql2 library.

## Tasks

- [x] 1. Set up database infrastructure and configuration
  - [x] 1.1 Install mysql2 package and configure environment variables
    - Install mysql2 via npm
    - Create .env.example with database configuration template (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT)
    - Document environment variables in README or database-setup.md
    - _Requirements: 1.1, 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.5_
  
  - [x] 1.2 Create database connection module with pooling
    - Create db/connection.js module
    - Implement initializeDatabase() function with connection pool configuration (5-20 connections)
    - Implement query(sql, params) function for parameterized queries
    - Implement transaction(callback) function for transactional operations
    - Implement getConnection() function for complex operations
    - Implement testConnection() function for connectivity validation
    - Add connection retry logic (3 attempts with 5-second intervals)
    - Add environment-specific behavior (exit on production failure, continue in development)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 6.1, 9.1, 9.2, 9.3, 9.7, 9.8_
  
  - [ ]* 1.3 Write unit tests for connection module
    - Test connection initialization with valid credentials
    - Test connection retry logic with mocked failures
    - Test environment-specific behaviors
    - _Requirements: 1.1, 1.3, 9.1_

- [x] 2. Create database schema
  - [x] 2.1 Create schema initialization module
    - Create db/schema.js module
    - Implement createTables() function with CREATE TABLE IF NOT EXISTS statements
    - Define employees table with all columns and indexes (email, status, department)
    - Define users table with email as primary key
    - Define departments table
    - Define attendance_records table with foreign key to employees and UNIQUE constraint on (employee_id, date)
    - Define leave_requests table with foreign key to employees
    - Define notifications table
    - Define attendance_policy table
    - Implement createIndexes() function for performance optimization
    - Implement validateSchema() function for schema verification
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_
  
  - [ ]* 2.2 Write integration tests for schema creation
    - Test all tables created successfully
    - Test indexes exist on expected columns
    - Test foreign key constraints exist
    - Test unique constraints work correctly
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

- [x] 3. Checkpoint - Verify database setup
  - Ensure connection module works and schema is created successfully. Run any tests created so far. Ask the user if questions arise.

- [x] 4. Implement data migration script
  - [x] 4.1 Create migration script structure and validation
    - Create migrate-to-mysql.js as standalone executable
    - Implement readDataJson() function to read and parse data.json
    - Implement validateDataJson() function to check structure
    - Implement backupDataFile() function to create timestamped backup
    - Add command-line interface with options for dry-run
    - _Requirements: 3.1, 3.2, 3.3, 3.14_
  
  - [x] 4.2 Implement data transformation functions
    - Create db/transformers.js module
    - Implement transformEmployee() to convert JSON employee to SQL-compatible format (string numbers to DECIMAL/INT, date strings to DATE)
    - Implement transformUser() for users data
    - Implement transformAttendanceRecord() for attendance records
    - Implement transformLeaveRequest() for leave requests
    - Implement transformNotification() for notifications
    - Implement validateEmployee() for data validation
    - Handle NULL value conversion (empty strings to NULL for dates/numbers)
    - _Requirements: 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11_
  
  - [ ]* 4.3 Write unit tests for data transformation functions
    - Test string number conversion to DECIMAL
    - Test date string conversion to DATE
    - Test NULL value handling
    - Test validation functions
    - _Requirements: 3.4_
  
  - [x] 4.4 Implement migration execution logic
    - Implement migrateEmployees(employees) function with error handling per record
    - Implement migrateUsers(users) function
    - Implement migrateDepartments(departments) function
    - Implement migrateAttendanceRecords(records) function
    - Implement migrateLeaveRequests(requests) function
    - Implement migrateNotifications(notifications) function
    - Implement migrateAttendancePolicy(policy) function
    - Add progress logging for each entity type
    - Continue processing on individual record failures
    - _Requirements: 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_
  
  - [x] 4.5 Implement migration verification and reporting
    - Implement verifyMigration() function to check row counts
    - Generate migration summary with success/failure counts per table
    - Log failed records with error details
    - Output verification queries for manual review
    - _Requirements: 3.12, 3.13, 3.15_
  
  - [ ]* 4.6 Test migration script with sample data
    - Create test data.json with various data types
    - Run migration against test database
    - Verify row counts and data integrity
    - Test error handling with malformed data
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.12, 3.13, 3.15_

- [x] 5. Checkpoint - Verify migration script
  - Ensure migration script successfully transfers data from data.json to MySQL. Review migration summary output. Ask the user if questions arise.

- [x] 6. Implement employee CRUD operations
  - [x] 6.1 Create employee data access module
    - Create db/employees.js module
    - Implement getEmployees(filters) function with parameterized SELECT query
    - Implement getEmployeeById(id) function
    - Convert MySQL DATE/DATETIME to ISO 8601 strings in responses
    - Convert DECIMAL values to numbers in responses
    - Handle NULL values by omitting fields or using null
    - _Requirements: 4.1, 4.3, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  
  - [x] 6.2 Implement employee creation with transaction
    - Implement addEmployee(employeeData, userData) function using transaction
    - Insert into employees table with parameterized INSERT
    - Insert into users table within same transaction
    - Rollback both operations if either fails
    - Return employee ID and user ID on success
    - _Requirements: 4.4, 5.1, 5.2, 5.6, 5.7, 4.12_
  
  - [x] 6.3 Implement employee update and delete operations
    - Implement updateEmployee(id, updates) function with parameterized UPDATE
    - Implement deleteEmployee(id) function using soft delete (set status='inactive')
    - Use transaction for delete operation to deactivate user record too
    - _Requirements: 4.5, 4.6, 5.4, 5.5, 4.12_
  
  - [ ]* 6.4 Write integration tests for employee operations
    - Test employee creation creates both employee and user records
    - Test employee retrieval returns correct JSON structure
    - Test employee update modifies correct fields
    - Test employee deletion sets status to 'inactive'
    - Test transaction rollback on partial failure
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 8.3_

- [x] 7. Implement authentication operations
  - [x] 7.1 Create user data access module
    - Create db/users.js module
    - Implement getUserByEmail(email) function with parameterized SELECT
    - Implement updateUserPassword(email, newPassword) function
    - _Requirements: 4.7, 4.12_
  
  - [ ]* 7.2 Write integration tests for authentication operations
    - Test user retrieval by email
    - Test password update
    - Test parameterized queries prevent SQL injection
    - _Requirements: 4.7, 4.12, 4.13_

- [x] 8. Implement attendance operations
  - [x] 8.1 Create attendance data access module
    - Create db/attendance.js module
    - Implement getTodayAttendance(employeeId) function
    - Implement recordAttendance(employeeId, type, action, time) function using UPSERT pattern (INSERT ... ON DUPLICATE KEY UPDATE)
    - Implement getAttendanceHistory(filters) function with date range filtering
    - Implement updateAttendance(id, updates) function
    - Use indexes for query optimization (employee_id, date)
    - _Requirements: 4.8, 4.1, 4.2, 7.2, 7.4, 7.5_
  
  - [ ]* 8.2 Write integration tests for attendance operations
    - Test attendance record UPSERT pattern for same-day check-ins/check-outs
    - Test attendance history query with date range
    - Test foreign key constraint for non-existent employee
    - _Requirements: 4.8, 4.1_

- [x] 9. Implement leave request operations
  - [x] 9.1 Create leave request data access module
    - Create db/leave-requests.js module
    - Implement getLeaveRequests(filters) function with JOIN to employees table
    - Implement createLeaveRequest(requestData) function
    - Implement updateLeaveRequestStatus(id, status, notes) function with transaction for notification creation
    - Use transaction to ensure leave update and notification creation both succeed
    - _Requirements: 4.9, 4.10, 5.3, 5.5, 5.6_
  
  - [ ]* 9.2 Write integration tests for leave request operations
    - Test leave request creation
    - Test leave request retrieval with filters
    - Test leave status update with notification in transaction
    - Test transaction rollback if notification creation fails
    - _Requirements: 4.9, 4.10, 5.3_

- [x] 10. Implement notification operations
  - [x] 10.1 Create notification data access module
    - Create db/notifications.js module
    - Implement getNotifications(recipientEmail, limit) function with ORDER BY created_at DESC
    - Implement createNotification(notificationData) function
    - Implement markNotificationRead(id) function
    - Implement markNotificationsViewed(recipientEmail) function
    - Use indexes for query optimization (recipient_email, created_at)
    - _Requirements: 4.11, 7.2, 7.5_
  
  - [ ]* 10.2 Write integration tests for notification operations
    - Test notification creation
    - Test notification retrieval ordered by created_at
    - Test marking notifications as read and viewed
    - _Requirements: 4.11_

- [x] 11. Implement department operations
  - [x] 11.1 Create department data access module
    - Create db/departments.js module
    - Implement getDepartments() function
    - Implement addDepartment(name, description) function
    - _Requirements: 4.1, 4.2_
  
  - [ ]* 11.2 Write integration tests for department operations
    - Test department retrieval
    - Test department creation
    - Test unique constraint on department name
    - _Requirements: 4.1_

- [x] 12. Checkpoint - Verify all data access modules
  - Ensure all CRUD operations work correctly. Run integration tests if created. Ask the user if questions arise.

- [-] 13. Update server routes to use database
  - [x] 13.1 Replace handleGetEmployees with database query
    - Replace fs.readFileSync in handleGetEmployees with call to getEmployees()
    - Ensure JSON response format matches previous file-based format
    - Add error handling for database failures (return 500 status)
    - _Requirements: 4.1, 4.3, 8.1, 8.2, 8.3_
  
  - [~] 13.2 Replace handleAddEmployee with database operation
    - Replace fs.readFileSync + fs.writeFileSync with call to addEmployee()
    - Use transaction for employee and user creation
    - Handle constraint violations (return 409 for duplicate email/employee_id)
    - Handle foreign key violations (return 400 with descriptive message)
    - _Requirements: 4.2, 4.4, 5.1, 6.5, 6.6, 6.7_
  
  - [~] 13.3 Replace handleUpdateEmployee with database operation
    - Replace file operations with call to updateEmployee()
    - Use parameterized UPDATE query
    - Add error handling for database failures
    - _Requirements: 4.2, 4.5, 4.14_
  
  - [~] 13.4 Replace handleDeleteEmployee with database operation
    - Replace file operations with call to deleteEmployee()
    - Use soft delete (status='inactive')
    - Use transaction to deactivate user record
    - _Requirements: 4.2, 4.6, 5.4_
  
  - [x] 13.5 Replace handleLogin with database query
    - Replace file operations with call to getUserByEmail()
    - Use parameterized SELECT query
    - Maintain existing session-based authentication
    - _Requirements: 4.1, 4.7, 4.12, 4.13, 8.8_
  
  - [~] 13.6 Replace handleAttendance with database operations
    - Replace file operations with calls to recordAttendance()
    - Use UPSERT pattern for same-day updates
    - Add error handling for constraint violations
    - _Requirements: 4.2, 4.8_
  
  - [x] 13.7 Replace handleGetLeaveRequests with database query
    - Replace file operations with call to getLeaveRequests()
    - Ensure JOIN with employees table works correctly
    - _Requirements: 4.1, 4.9_
  
  - [~] 13.8 Replace handleUpdateLeaveRequest with database operation
    - Replace file operations with call to updateLeaveRequestStatus()
    - Use transaction for leave update and notification creation
    - _Requirements: 4.2, 4.10, 5.3_
  
  - [x] 13.9 Replace handleGetNotifications with database query
    - Replace file operations with call to getNotifications()
    - Ensure ORDER BY created_at DESC is applied
    - _Requirements: 4.1, 4.11_
  
  - [x] 13.10 Replace all remaining data.json file operations
    - Search for any remaining fs.readFileSync or fs.writeFileSync calls related to data.json
    - Replace with appropriate database operations
    - Remove data.json file read/write helper functions
    - _Requirements: 4.1, 4.2_

- [-] 14. Implement comprehensive error handling
  - [x] 14.1 Add connection error handling
    - Implement connection failure logging with timestamp and details
    - Implement retry logic with exponential backoff
    - Add environment-specific behavior (production exit, development continue)
    - _Requirements: 1.3, 6.1, 9.7, 9.8_
  
  - [~] 14.2 Add query error handling
    - Distinguish between connection, syntax, constraint violation, and timeout errors
    - Return appropriate HTTP status codes (400, 409, 500)
    - Log errors without exposing internal database details to clients
    - Implement query timeout handling (30 seconds)
    - _Requirements: 4.14, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_
  
  - [~] 14.3 Add connection pool monitoring
    - Implement periodic logging of connection pool statistics
    - Warn when pool usage exceeds 75% (15/20 connections)
    - Handle pool exhaustion with request queuing
    - _Requirements: 6.3, 6.8_
  
  - [ ]* 14.4 Write integration tests for error handling
    - Test connection failure behavior
    - Test duplicate key constraint violations
    - Test foreign key constraint violations
    - Test transaction rollback on errors
    - Test query timeout handling
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [~] 15. Checkpoint - Verify error handling
  - Test various error scenarios (invalid data, duplicate records, connection failures). Ensure appropriate error responses. Ask the user if questions arise.

- [ ] 16. Performance optimization
  - [~] 16.1 Implement query optimization
    - Use prepared statements for frequently executed queries
    - Replace SELECT * with explicit column names where only specific fields needed
    - Cache database schema metadata in memory
    - Configure connection pool idle timeout (10 minutes)
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.7, 7.8_
  
  - [~] 16.2 Verify query performance
    - Test getEmployees completes in <100ms for 1000 employees
    - Test addEmployee completes in <200ms
    - Test attendance queries with date range complete in <50ms
    - Test notification fetch (50 records) completes in <100ms
    - _Requirements: 7.2_
  
  - [ ]* 16.3 Write performance tests
    - Create load testing script using Apache Bench or similar
    - Test with production-like data volume (500+ employees)
    - Monitor connection pool usage under load
    - Verify no connection leaks
    - _Requirements: 7.2, 7.8_

- [ ] 17. Create deployment documentation
  - [~] 17.1 Create database setup documentation
    - Create database-setup.md with MySQL installation instructions
    - Document CREATE DATABASE statement for employee_system
    - Document MySQL user creation with appropriate permissions
    - Document Render.com MySQL add-on setup instructions
    - Include environment variable configuration examples
    - Document migration script usage with examples
    - Add troubleshooting section for common errors
    - Include database backup and restore procedures
    - Include verification queries for successful migration
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_
  
  - [~] 17.2 Update main deployment documentation
    - Update DEPLOYMENT_GUIDE.md with database setup steps
    - Update .env.example with all database variables
    - Document environment-specific configurations
    - Add database connection troubleshooting
    - _Requirements: 9.4, 9.5, 9.6, 10.1, 10.7_

- [ ] 18. Integration and final verification
  - [~] 18.1 Update server startup to initialize database
    - Call initializeDatabase() on server startup before accepting requests
    - Call createTables() to ensure schema exists
    - Add database connection validation
    - Log connection status and configuration details (excluding password)
    - _Requirements: 1.6, 9.6_
  
  - [~] 18.2 Perform backward compatibility verification
    - Test all API endpoints return same JSON structure as before
    - Verify date formats are ISO 8601 strings
    - Verify number values are numbers not strings
    - Verify null value handling matches previous behavior
    - Test frontend compatibility with database-backed responses
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_
  
  - [ ]* 18.3 Perform end-to-end testing
    - Test complete user workflows (add employee, record attendance, submit leave request)
    - Test authentication flow with database-backed users
    - Test notification creation and retrieval
    - Test transaction integrity for multi-step operations
    - _Requirements: 8.1, 8.2, 8.3, 8.8_
  
  - [~] 18.4 Run migration script on actual data.json
    - Create backup of production data.json
    - Run migrate-to-mysql.js against production database
    - Verify migration summary shows all records migrated
    - Run verification queries to confirm data integrity
    - _Requirements: 3.1, 3.14, 3.15_

- [~] 19. Final checkpoint - Production readiness
  - Ensure all tests pass, documentation is complete, and migration is successful. Verify the system works end-to-end with MySQL. Ask the user if ready for deployment.

## Notes

- Tasks marked with `*` are optional testing tasks that can be skipped for faster implementation
- Each task references specific requirements from the requirements document for traceability
- The design document uses JavaScript/Node.js, so all implementation will use JavaScript with mysql2
- Checkpoints ensure validation at key milestones
- Connection pooling and transaction support are critical for data consistency
- All SQL queries must use parameterized queries to prevent SQL injection
- Error handling must distinguish between different failure types and return appropriate HTTP status codes
- Performance optimization focuses on query efficiency and connection pool management
- Migration script must handle data transformation (string numbers to DECIMAL, date strings to DATE)
- Backward compatibility is essential - API responses must match exact JSON structure expected by frontend
- Database schema uses soft deletes for employees (status='inactive') to preserve audit trails

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["1.3", "2.2", "4.1", "4.2"] },
    { "id": 3, "tasks": ["4.3", "4.4"] },
    { "id": 4, "tasks": ["4.5", "6.1", "7.1", "8.1", "9.1", "10.1", "11.1"] },
    { "id": 5, "tasks": ["4.6", "6.2"] },
    { "id": 6, "tasks": ["6.3", "6.4", "7.2", "8.2", "9.2", "10.2", "11.2"] },
    { "id": 7, "tasks": ["13.1", "13.5", "13.7", "13.9", "14.1"] },
    { "id": 8, "tasks": ["13.2", "13.3", "13.6"] },
    { "id": 9, "tasks": ["13.4", "13.8", "13.10", "14.2"] },
    { "id": 10, "tasks": ["14.3", "14.4", "16.1"] },
    { "id": 11, "tasks": ["16.2", "16.3", "17.1"] },
    { "id": 12, "tasks": ["17.2", "18.1"] },
    { "id": 13, "tasks": ["18.2", "18.3"] },
    { "id": 14, "tasks": ["18.4"] }
  ]
}
```
