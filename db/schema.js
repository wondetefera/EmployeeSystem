/**
 * Database Schema Initialization Module
 * 
 * This module handles the creation and validation of MySQL database schema
 * for the Employee Management System.
 */

/**
 * Create all required database tables with proper structure and constraints
 * @param {Object} pool - MySQL connection pool
 * @returns {Promise<void>}
 */
async function createTables(pool) {
  console.log('Creating database tables...');

  // Create employees table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ employees table created');

  // Create users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      email VARCHAR(255) PRIMARY KEY,
      id INT NOT NULL UNIQUE,
      role VARCHAR(50) NOT NULL,
      password VARCHAR(255) NOT NULL,
      INDEX idx_id (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ users table created');

  // Create departments table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS departments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ departments table created');

  // Create attendance_records table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance_records (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ attendance_records table created');

  // Create leave_requests table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leave_requests (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ leave_requests table created');

  // Create notifications table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ notifications table created');

  // Create attendance_policy table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance_policy (
      id INT PRIMARY KEY AUTO_INCREMENT,
      morning_start TIME NOT NULL,
      morning_end TIME NOT NULL,
      afternoon_start TIME NOT NULL,
      afternoon_end TIME NOT NULL,
      late_tolerance INT DEFAULT 15,
      early_tolerance INT DEFAULT 5,
      updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
      updated_by VARCHAR(255)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ attendance_policy table created');

  console.log('✅ All tables created successfully');
}

/**
 * Create additional indexes for performance optimization
 * Note: Most indexes are created inline with table definitions above,
 * but this function can be used to add additional indexes if needed
 * @param {Object} pool - MySQL connection pool
 * @returns {Promise<void>}
 */
async function createIndexes(pool) {
  console.log('Creating additional performance indexes...');

  try {
    // Check if composite index on notifications exists and create if not
    const [existingIndexes] = await pool.query(`
      SHOW INDEX FROM notifications WHERE Key_name = 'idx_recipient_read'
    `);
    
    if (existingIndexes.length === 0) {
      await pool.query(`
        CREATE INDEX idx_recipient_read ON notifications(recipient_email, is_read, created_at)
      `);
      console.log('✓ Additional composite index created on notifications');
    }
  } catch (error) {
    // Index might already exist from previous runs
    if (error.code !== 'ER_DUP_KEYNAME') {
      console.warn('Warning: Could not create additional index:', error.message);
    }
  }

  console.log('✅ Index creation completed');
}

/**
 * Validate that the database schema matches expected structure
 * @param {Object} pool - MySQL connection pool
 * @returns {Promise<boolean>} True if schema is valid, false otherwise
 */
async function validateSchema(pool) {
  console.log('Validating database schema...');

  const requiredTables = [
    'employees',
    'users',
    'departments',
    'attendance_records',
    'leave_requests',
    'notifications',
    'attendance_policy'
  ];

  try {
    // Check that all required tables exist
    const [tables] = await pool.query('SHOW TABLES');
    const tableNames = tables.map(row => Object.values(row)[0]);

    for (const tableName of requiredTables) {
      if (!tableNames.includes(tableName)) {
        console.error(`❌ Missing required table: ${tableName}`);
        return false;
      }
    }
    console.log('✓ All required tables exist');

    // Validate employees table structure
    const [employeesColumns] = await pool.query('DESCRIBE employees');
    const requiredEmployeeColumns = [
      'id', 'employee_id', 'first_name', 'email', 'status'
    ];
    const employeeColumnNames = employeesColumns.map(col => col.Field);
    
    for (const colName of requiredEmployeeColumns) {
      if (!employeeColumnNames.includes(colName)) {
        console.error(`❌ Missing required column in employees table: ${colName}`);
        return false;
      }
    }
    console.log('✓ Employees table structure valid');

    // Validate foreign key constraints on attendance_records
    const [attendanceConstraints] = await pool.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.TABLE_CONSTRAINTS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'attendance_records' 
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    `);
    
    if (attendanceConstraints.length === 0) {
      console.error('❌ Missing foreign key constraint on attendance_records table');
      return false;
    }
    console.log('✓ Attendance records foreign key constraint exists');

    // Validate unique constraint on attendance_records (employee_id, date)
    const [attendanceIndexes] = await pool.query(`
      SHOW INDEX FROM attendance_records WHERE Key_name = 'unique_employee_date'
    `);
    
    if (attendanceIndexes.length === 0) {
      console.error('❌ Missing unique constraint on attendance_records (employee_id, date)');
      return false;
    }
    console.log('✓ Attendance records unique constraint exists');

    // Validate users table primary key
    const [usersColumns] = await pool.query('DESCRIBE users');
    const emailColumn = usersColumns.find(col => col.Field === 'email');
    
    if (!emailColumn || emailColumn.Key !== 'PRI') {
      console.error('❌ Users table email is not primary key');
      return false;
    }
    console.log('✓ Users table primary key valid');

    console.log('✅ Database schema validation passed');
    return true;
  } catch (error) {
    console.error('❌ Schema validation failed:', error.message);
    return false;
  }
}

module.exports = {
  createTables,
  createIndexes,
  validateSchema
};
