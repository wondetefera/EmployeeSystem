# Requirements Document

## Introduction

This document specifies the requirements for migrating the Employee Management System from file-based storage (data.json) to MySQL database. The current system deployed on Render.com suffers from data loss due to ephemeral storage, requiring persistent database storage. The migration must maintain backward compatibility, preserve all existing data structures, and support both local development and production environments.

## Glossary

- **System**: The Employee Management System Node.js HTTP server (simple-server.js)
- **Data_Store**: The persistent storage mechanism (currently data.json, target is MySQL database)
- **Migration_Script**: A one-time executable program that transfers data from data.json to MySQL
- **Connection_Pool**: A set of reusable database connections managed by the System
- **Database_Schema**: The table structure defining employees, users, departments, attendance_records, leave_requests, and notifications
- **CRUD_Operations**: Create, Read, Update, Delete operations on data entities
- **Render_Platform**: The cloud hosting service where the System is deployed
- **Environment_Config**: Configuration settings for database connection (host, port, user, password, database name)

## Requirements

### Requirement 1: Database Connection and Configuration

**User Story:** As a developer, I want to establish MySQL database connections with proper pooling, so that the System can reliably access persistent storage in both development and production environments.

#### Acceptance Criteria

1. THE System SHALL read database configuration from environment variables (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT)
2. WHEN the System starts, THE Connection_Pool SHALL initialize with a minimum of 5 connections and maximum of 20 connections
3. IF database connection fails during startup, THEN THE System SHALL log descriptive error messages and retry connection 3 times with 5-second intervals
4. WHERE local development environment is detected, THE System SHALL connect to localhost MySQL instance
5. WHERE Render_Platform environment is detected, THE System SHALL connect to production MySQL instance using Render environment variables
6. THE System SHALL validate database connectivity on startup before accepting HTTP requests
7. WHEN a database query fails due to connection loss, THE System SHALL automatically retry using the Connection_Pool

### Requirement 2: Database Schema Creation

**User Story:** As a system administrator, I want database tables created with proper structure and constraints, so that data integrity is maintained and relationships between entities are enforced.

#### Acceptance Criteria

1. THE Database_Schema SHALL include tables: employees, users, departments, attendance_records, leave_requests, notifications, attendance_policy
2. THE employees table SHALL have columns: id (INT PRIMARY KEY AUTO_INCREMENT), employee_id (VARCHAR 50 UNIQUE), first_name (VARCHAR 100), last_name (VARCHAR 100), father_name (VARCHAR 100), gfather_name (VARCHAR 100), email (VARCHAR 255 UNIQUE), department (VARCHAR 100), job_title (VARCHAR 100), salary (DECIMAL 10,2), start_date (DATE), phone (VARCHAR 20), status (VARCHAR 20), annual_leave_days (INT), leave_start_year (INT), created_at (DATETIME), created_by (VARCHAR 255), updated_at (DATETIME), updated_by (VARCHAR 255), photo (TEXT)
3. THE users table SHALL have columns: email (VARCHAR 255 PRIMARY KEY), id (INT UNIQUE), role (VARCHAR 50), password (VARCHAR 255)
4. THE departments table SHALL have columns: id (INT PRIMARY KEY AUTO_INCREMENT), name (VARCHAR 100 UNIQUE), description (TEXT)
5. THE attendance_records table SHALL have columns: id (INT PRIMARY KEY AUTO_INCREMENT), employee_id (INT), employee_name (VARCHAR 255), date (DATE), morning_checkin (TIME), morning_checkout (TIME), afternoon_checkin (TIME), afternoon_checkout (TIME), total_hours (DECIMAL 5,2), status (VARCHAR 20), created_at (DATETIME), updated_at (DATETIME), updated_by (VARCHAR 255)
6. THE leave_requests table SHALL have columns: id (INT PRIMARY KEY AUTO_INCREMENT), employee_id (INT), employee_name (VARCHAR 255), leave_type (VARCHAR 50), leave_duration (VARCHAR 50), start_date (DATE), end_date (DATE), reason (TEXT), days_requested (DECIMAL 5,2), status (VARCHAR 20), created_at (DATE), created_by (VARCHAR 255), notes (TEXT), updated_at (DATETIME), updated_by (VARCHAR 255)
7. THE notifications table SHALL have columns: id (INT PRIMARY KEY AUTO_INCREMENT), type (VARCHAR 50), title (VARCHAR 255), message (TEXT), recipient_email (VARCHAR 255), sender_email (VARCHAR 255), related_id (INT), related_type (VARCHAR 50), is_read (BOOLEAN), is_viewed (BOOLEAN), created_at (DATETIME), priority (VARCHAR 20), viewed_at (DATETIME)
8. THE attendance_policy table SHALL have columns: id (INT PRIMARY KEY AUTO_INCREMENT), morning_start (TIME), morning_end (TIME), afternoon_start (TIME), afternoon_end (TIME), late_tolerance (INT), early_tolerance (INT), updated_at (DATETIME), updated_by (VARCHAR 255)
9. THE System SHALL create foreign key constraints linking attendance_records.employee_id and leave_requests.employee_id to employees.id
10. THE System SHALL create indexes on frequently queried columns: employees.email, attendance_records.date, attendance_records.employee_id, leave_requests.employee_id, leave_requests.status, notifications.recipient_email

### Requirement 3: Data Migration from JSON to MySQL

**User Story:** As a system administrator, I want to migrate all existing data from data.json to MySQL, so that no historical data is lost during the transition.

#### Acceptance Criteria

1. THE Migration_Script SHALL be a separate executable Node.js file named migrate-to-mysql.js
2. WHEN the Migration_Script executes, THE Migration_Script SHALL read all data from data.json
3. THE Migration_Script SHALL validate data.json structure before attempting migration
4. THE Migration_Script SHALL transform JSON data types to match Database_Schema column types (strings to numbers, date strings to DATE/DATETIME)
5. THE Migration_Script SHALL insert employees array into employees table preserving all fields
6. THE Migration_Script SHALL transform users object into rows and insert into users table
7. THE Migration_Script SHALL insert departments array into departments table
8. THE Migration_Script SHALL insert attendanceRecords array into attendance_records table
9. THE Migration_Script SHALL insert leaveRequests array into leave_requests table
10. THE Migration_Script SHALL insert notifications array into notifications table
11. THE Migration_Script SHALL insert attendancePolicy object into attendance_policy table
12. IF any record fails insertion, THEN THE Migration_Script SHALL log the error and continue processing remaining records
13. THE Migration_Script SHALL output migration summary showing counts of successfully migrated records per table
14. THE Migration_Script SHALL create a backup of data.json before migration with timestamp in filename
15. WHEN all data is successfully migrated, THE Migration_Script SHALL verify row counts match source data

### Requirement 4: CRUD Operations Migration to MySQL

**User Story:** As a developer, I want all file-based data operations replaced with MySQL queries, so that the System uses persistent database storage instead of ephemeral files.

#### Acceptance Criteria

1. THE System SHALL replace all fs.readFileSync operations on data.json with SQL SELECT queries
2. THE System SHALL replace all fs.writeFileSync operations on data.json with SQL INSERT, UPDATE, or DELETE queries
3. WHEN handleGetEmployees executes, THE System SHALL query "SELECT * FROM employees WHERE status = 'active'"
4. WHEN handleAddEmployee executes, THE System SHALL insert new employee using parameterized SQL INSERT statement
5. WHEN handleUpdateEmployee executes, THE System SHALL update employee using parameterized SQL UPDATE statement with WHERE id = ?
6. WHEN handleDeleteEmployee executes, THE System SHALL soft-delete employee by setting status = 'inactive' using UPDATE statement
7. WHEN handleLogin executes, THE System SHALL query users table using parameterized SELECT WHERE email = ?
8. WHEN handleAttendance executes, THE System SHALL insert or update attendance_records using SQL UPSERT pattern
9. WHEN handleGetLeaveRequests executes, THE System SHALL query leave_requests with JOIN to employees table
10. WHEN handleUpdateLeaveRequest executes, THE System SHALL update leave_request status using parameterized UPDATE statement
11. WHEN handleGetNotifications executes, THE System SHALL query notifications WHERE recipient_email = ? ORDER BY created_at DESC
12. THE System SHALL use parameterized queries for all SQL statements to prevent SQL injection
13. THE System SHALL properly escape all user input before using in SQL queries
14. WHEN a SQL query fails, THE System SHALL log the error and return a 500 status code with error message

### Requirement 5: Transaction Support for Critical Operations

**User Story:** As a developer, I want database transactions for multi-step operations, so that data consistency is maintained even if partial failures occur.

#### Acceptance Criteria

1. WHEN handleAddEmployee executes, THE System SHALL wrap employee insertion and user creation in a single transaction
2. IF employee insertion succeeds but user creation fails, THEN THE System SHALL rollback both operations
3. WHEN handleUpdateLeaveRequest approves leave, THE System SHALL update leave_request and create notification within a transaction
4. WHEN handleDeleteEmployee executes, THE System SHALL deactivate employee and user records within a transaction
5. IF any operation within a transaction fails, THEN THE System SHALL rollback all changes and return error status
6. WHEN transaction completes successfully, THE System SHALL commit changes to database
7. THE System SHALL release database connections back to Connection_Pool after transaction completion

### Requirement 6: Error Handling and Recovery

**User Story:** As a system administrator, I want comprehensive error handling for database operations, so that failures are logged and the System remains stable.

#### Acceptance Criteria

1. WHEN a database connection fails, THE System SHALL log error with timestamp, query, and error message
2. WHEN a SQL query times out after 30 seconds, THE System SHALL cancel query and return error response
3. IF Connection_Pool is exhausted, THEN THE System SHALL queue requests and process when connections become available
4. THE System SHALL distinguish between connection errors, syntax errors, and constraint violation errors in logs
5. WHEN a foreign key constraint is violated, THE System SHALL return a 400 status with user-friendly error message
6. WHEN a unique constraint is violated, THE System SHALL return a 409 status with descriptive conflict message
7. THE System SHALL not expose internal database errors or schema details to HTTP clients
8. WHEN database errors occur, THE System SHALL increment error metrics for monitoring

### Requirement 7: Performance Optimization

**User Story:** As a developer, I want optimized database queries, so that the System maintains response times comparable to file-based storage.

#### Acceptance Criteria

1. THE System SHALL use prepared statements for all frequently executed queries
2. WHEN handleGetEmployees executes, THE System SHALL complete query in under 100ms for datasets under 1000 employees
3. THE System SHALL cache Database_Schema metadata in memory to avoid repeated DESCRIBE queries
4. WHEN fetching attendance records, THE System SHALL use date range indexes to limit scanned rows
5. THE System SHALL use SELECT with explicit column names instead of SELECT * where only specific fields are needed
6. WHEN generating reports, THE System SHALL use aggregate SQL functions (COUNT, SUM, AVG) instead of fetching all rows
7. THE System SHALL close result sets promptly after processing to free resources
8. THE System SHALL configure Connection_Pool idle timeout to 10 minutes to balance connection reuse and resource usage

### Requirement 8: Backward Compatibility and Testing

**User Story:** As a developer, I want the database migration to maintain API compatibility, so that frontend code requires no changes.

#### Acceptance Criteria

1. THE System SHALL return JSON responses in identical format to file-based implementation
2. THE System SHALL preserve all existing API endpoints with same paths and HTTP methods
3. WHEN clients request /api/employees, THE System SHALL return array of employee objects matching previous JSON structure
4. THE System SHALL convert MySQL DATE/DATETIME values to ISO 8601 strings in JSON responses
5. THE System SHALL convert DECIMAL values to numbers in JSON responses
6. THE System SHALL handle null values from database by omitting fields or using null in JSON (matching previous behavior)
7. WHERE boolean fields exist in database, THE System SHALL convert to true/false in JSON responses
8. THE System SHALL maintain existing session-based authentication mechanism without changes

### Requirement 9: Environment-Specific Configuration

**User Story:** As a system administrator, I want separate database configurations for development and production, so that local testing does not affect production data.

#### Acceptance Criteria

1. THE System SHALL read NODE_ENV environment variable to determine environment
2. WHERE NODE_ENV equals "production", THE System SHALL require all database environment variables (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)
3. WHERE NODE_ENV equals "development", THE System SHALL use default values: DB_HOST=localhost, DB_NAME=employee_system
4. THE System SHALL provide .env.example file with database configuration template
5. THE System SHALL not commit actual database credentials to version control
6. THE System SHALL log connection string details at startup (excluding password) for debugging
7. WHERE database connection fails in production, THE System SHALL exit process with non-zero code for container restart
8. WHERE database connection fails in development, THE System SHALL continue running and display error page

### Requirement 10: Database Setup and Deployment Documentation

**User Story:** As a system administrator, I want clear setup instructions, so that I can configure MySQL for both local development and production deployment.

#### Acceptance Criteria

1. THE System SHALL include database-setup.md documentation file with MySQL installation instructions
2. THE documentation SHALL include CREATE DATABASE statement for employee_system database
3. THE documentation SHALL include MySQL user creation statements with appropriate permissions
4. THE documentation SHALL provide Render.com MySQL add-on setup instructions
5. THE documentation SHALL include environment variable configuration examples for both environments
6. THE documentation SHALL document Migration_Script usage with command-line examples
7. THE documentation SHALL include troubleshooting section for common connection errors
8. THE documentation SHALL provide database backup and restore procedures
9. THE documentation SHALL include verification queries to confirm successful migration
