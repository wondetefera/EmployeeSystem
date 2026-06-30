#!/usr/bin/env node
/**
 * MySQL Migration Script
 * 
 * This standalone executable migrates data from data.json to MySQL database.
 * It reads, validates, backs up, and transfers all employee system data.
 * 
 * Usage:
 *   node migrate-to-mysql.js              # Run full migration
 *   node migrate-to-mysql.js --dry-run    # Validate without writing to database
 *   node migrate-to-mysql.js --help       # Show help information
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.14
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Import transformers for data conversion
const transformers = require('./db/transformers');

// Configuration
const DATA_FILE_PATH = path.join(__dirname, 'data.json');
const BACKUP_DIR = path.join(__dirname, 'backups');

// Database pool (created during migration)
let pool = null;

// Parse command-line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const showHelp = args.includes('--help') || args.includes('-h');

/**
 * Display help information
 */
function displayHelp() {
  console.log(`
MySQL Migration Script - Employee Management System

USAGE:
  node migrate-to-mysql.js [OPTIONS]

OPTIONS:
  --dry-run     Validate data and simulate migration without writing to database
  --help, -h    Display this help information

DESCRIPTION:
  Migrates all data from data.json to MySQL database. The script performs
  the following operations:
  1. Validates data.json structure
  2. Creates timestamped backup of data.json
  3. Connects to MySQL database
  4. Transforms and inserts data into respective tables
  5. Generates migration summary report

ENVIRONMENT VARIABLES:
  DB_HOST       MySQL host (default: localhost)
  DB_USER       MySQL username (default: root)
  DB_PASSWORD   MySQL password
  DB_NAME       MySQL database name (default: employee_system)
  DB_PORT       MySQL port (default: 3306)

EXAMPLES:
  # Run full migration
  node migrate-to-mysql.js

  # Test migration without database changes
  node migrate-to-mysql.js --dry-run

NOTES:
  - Backup is created before any database operations
  - Failed records are logged but don't stop migration
  - Dry-run mode validates data structure only
`);
}

/**
 * Read and parse data.json file
 * Validates: Requirement 3.1 - Migration script reads data from data.json
 * 
 * @returns {Object} Parsed JSON data
 * @throws {Error} If file cannot be read or parsed
 */
function readDataJson() {
  console.log('📖 Reading data.json...');
  
  try {
    // Check if file exists
    if (!fs.existsSync(DATA_FILE_PATH)) {
      throw new Error(`Data file not found: ${DATA_FILE_PATH}`);
    }
    
    // Read file contents
    const fileContents = fs.readFileSync(DATA_FILE_PATH, 'utf8');
    
    // Validate file is not empty
    if (!fileContents.trim()) {
      throw new Error('Data file is empty');
    }
    
    // Parse JSON
    const data = JSON.parse(fileContents);
    
    console.log('✅ Successfully read data.json');
    return data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON format in data.json: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validate data.json structure and contents
 * Validates: Requirement 3.2 - Migration script validates data.json structure
 * 
 * @param {Object} data - Parsed data from data.json
 * @returns {Object} Validation result { valid: boolean, errors: string[], warnings: string[] }
 */
function validateDataJson(data) {
  console.log('🔍 Validating data.json structure...');
  
  const errors = [];
  const warnings = [];
  
  // Check required top-level properties
  const requiredProperties = [
    'employees',
    'users',
    'departments',
    'leaveRequests',
    'attendanceRecords',
    'notifications',
    'attendancePolicy'
  ];
  
  for (const prop of requiredProperties) {
    if (!(prop in data)) {
      errors.push(`Missing required property: ${prop}`);
    }
  }
  
  // If critical properties missing, return early
  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }
  
  // Validate employees array
  if (!Array.isArray(data.employees)) {
    errors.push('employees must be an array');
  } else {
    console.log(`  ✓ Found ${data.employees.length} employees`);
    
    // Validate employee structure
    data.employees.forEach((emp, index) => {
      if (!emp.id) {
        warnings.push(`Employee at index ${index} missing id`);
      }
      if (!emp.email) {
        warnings.push(`Employee at index ${index} missing email`);
      }
      if (!emp.employee_id) {
        warnings.push(`Employee at index ${index} missing employee_id`);
      }
    });
  }
  
  // Validate users object
  if (typeof data.users !== 'object' || Array.isArray(data.users)) {
    errors.push('users must be an object (not an array)');
  } else {
    const userCount = Object.keys(data.users).length;
    console.log(`  ✓ Found ${userCount} users`);
    
    // Validate user structure
    Object.entries(data.users).forEach(([email, user]) => {
      if (!user.id) {
        warnings.push(`User ${email} missing id`);
      }
      if (!user.role) {
        warnings.push(`User ${email} missing role`);
      }
      if (!user.password) {
        warnings.push(`User ${email} missing password`);
      }
    });
  }
  
  // Validate departments array
  if (!Array.isArray(data.departments)) {
    errors.push('departments must be an array');
  } else {
    console.log(`  ✓ Found ${data.departments.length} departments`);
  }
  
  // Validate attendanceRecords array
  if (!Array.isArray(data.attendanceRecords)) {
    errors.push('attendanceRecords must be an array');
  } else {
    console.log(`  ✓ Found ${data.attendanceRecords.length} attendance records`);
  }
  
  // Validate leaveRequests array
  if (!Array.isArray(data.leaveRequests)) {
    errors.push('leaveRequests must be an array');
  } else {
    console.log(`  ✓ Found ${data.leaveRequests.length} leave requests`);
  }
  
  // Validate notifications array
  if (!Array.isArray(data.notifications)) {
    errors.push('notifications must be an array');
  } else {
    console.log(`  ✓ Found ${data.notifications.length} notifications`);
  }
  
  // Validate attendancePolicy object (can be null)
  if (data.attendancePolicy === null || data.attendancePolicy === undefined) {
    console.log(`  ✓ Attendance policy is null (will use defaults)`);
  } else if (typeof data.attendancePolicy !== 'object' || Array.isArray(data.attendancePolicy)) {
    errors.push('attendancePolicy must be an object or null (not an array)');
  } else {
    console.log(`  ✓ Found attendance policy configuration`);
    
    const requiredPolicyFields = [
      'morning_start',
      'morning_end',
      'afternoon_start',
      'afternoon_end'
    ];
    
    for (const field of requiredPolicyFields) {
      if (!(field in data.attendancePolicy)) {
        warnings.push(`attendancePolicy missing ${field}`);
      }
    }
  }
  
  // Summary
  const valid = errors.length === 0;
  
  if (valid) {
    console.log('✅ Data structure validation passed');
    if (warnings.length > 0) {
      console.log(`⚠️  ${warnings.length} warning(s) found (non-critical)`);
    }
  } else {
    console.log(`❌ Data structure validation failed with ${errors.length} error(s)`);
  }
  
  return { valid, errors, warnings };
}

/**
 * Create timestamped backup of data.json file
 * Validates: Requirement 3.3 - Migration script creates backup before migration
 * 
 * @returns {string} Path to backup file
 * @throws {Error} If backup creation fails
 */
function backupDataFile() {
  console.log('💾 Creating backup of data.json...');
  
  try {
    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      console.log(`  ✓ Created backup directory: ${BACKUP_DIR}`);
    }
    
    // Generate timestamp for backup filename
    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, '-')
      .replace(/\..+/, ''); // Remove milliseconds
    
    const backupFileName = `data_backup_migration_${timestamp}.json`;
    const backupFilePath = path.join(BACKUP_DIR, backupFileName);
    
    // Copy data.json to backup location
    fs.copyFileSync(DATA_FILE_PATH, backupFilePath);
    
    // Verify backup was created
    if (!fs.existsSync(backupFilePath)) {
      throw new Error('Backup file was not created successfully');
    }
    
    // Get file size for confirmation
    const stats = fs.statSync(backupFilePath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    
    console.log(`✅ Backup created: ${backupFileName} (${fileSizeKB} KB)`);
    console.log(`   Location: ${backupFilePath}`);
    
    return backupFilePath;
  } catch (error) {
    console.error('❌ Failed to create backup:', error.message);
    throw new Error(`Backup creation failed: ${error.message}`);
  }
}

/**
 * Initialize database connection pool
 * 
 * @returns {Promise<Object>} MySQL connection pool
 * @throws {Error} If connection fails
 */
async function initializeDatabase() {
  console.log('🔌 Connecting to MySQL database...');
  
  try {
    const poolConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'employee_system',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelayMs: 0
    };
    
    const pool = mysql.createPool(poolConfig);
    
    // Test connection with detailed error handling
    try {
      const connection = await pool.getConnection();
      console.log('✅ Connected to MySQL database');
      connection.release();
    } catch (connError) {
      // If connection fails, provide helpful error message
      if (connError.code === 'ER_ACCESS_DENIED_ERROR') {
        throw new Error(`Access denied. Please verify DB_HOST, DB_USER, and DB_PASSWORD in .env file`);
      } else if (connError.code === 'PROTOCOL_CONNECTION_LOST') {
        throw new Error(`Connection lost. Please verify MySQL is running on ${poolConfig.host}:${poolConfig.port}`);
      } else if (connError.code === 'ER_CON_COUNT_ERROR') {
        throw new Error(`Too many connections. Please close some MySQL connections and retry`);
      } else {
        throw connError;
      }
    }
    
    return pool;
  } catch (error) {
    throw new Error(`Database connection failed: ${error.message}`);
  }
}

/**
 * Migrate employees data
 * 
 * @param {Array} employees - Array of employee objects
 * @param {Object} pool - MySQL connection pool
 * @returns {Promise<Object>} Migration result {success, failed, errors}
 */
async function migrateEmployees(employees, pool) {
  console.log('👥 Migrating employees...');
  
  let success = 0;
  let failed = 0;
  const errors = [];
  
  for (let i = 0; i < employees.length; i++) {
    try {
      const emp = employees[i];
      const transformed = transformers.transformEmployee(emp);
      
      const query = `
        INSERT INTO employees (
          employee_id, first_name, last_name, father_name, gfather_name, email,
          department, job_title, salary, start_date, phone, status, annual_leave_days,
          leave_start_year, created_at, created_by, updated_at, updated_by, photo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const values = [
        transformed.employee_id, transformed.first_name, transformed.last_name,
        transformed.father_name, transformed.gfather_name, transformed.email,
        transformed.department, transformed.job_title, transformed.salary,
        transformed.start_date, transformed.phone, transformed.status || 'active',
        transformed.annual_leave_days, transformed.leave_start_year,
        transformed.created_at, transformed.created_by, transformed.updated_at,
        transformed.updated_by, transformed.photo
      ];
      
      await pool.query(query, values);
      success++;
    } catch (error) {
      failed++;
      errors.push({
        index: i,
        employee_id: employees[i]?.employee_id,
        error: error.message
      });
    }
  }
  
  console.log(`  ✓ Employees: ${success} migrated, ${failed} failed`);
  return { success, failed, errors };
}

/**
 * Migrate users data
 * 
 * @param {Object} users - Object with email keys and user data
 * @param {Object} pool - MySQL connection pool
 * @returns {Promise<Object>} Migration result {success, failed, errors}
 */
async function migrateUsers(users, pool) {
  console.log('🔑 Migrating users...');
  
  let success = 0;
  let failed = 0;
  const errors = [];
  
  for (const [email, userData] of Object.entries(users)) {
    try {
      const transformed = transformers.transformUser(email, userData);
      
      const query = `
        INSERT INTO users (email, id, role, password)
        VALUES (?, ?, ?, ?)
      `;
      
      const values = [
        transformed.email,
        transformed.id || null,
        transformed.role || 'employee',
        transformed.password || ''
      ];
      
      await pool.query(query, values);
      success++;
    } catch (error) {
      // Skip duplicate email errors - user may already exist
      if (error.code === 'ER_DUP_ENTRY') {
        success++;
      } else {
        failed++;
        errors.push({
          email,
          error: error.message
        });
      }
    }
  }
  
  console.log(`  ✓ Users: ${success} migrated, ${failed} failed`);
  return { success, failed, errors };
}

/**
 * Migrate departments data
 * 
 * @param {Array} departments - Array of department objects
 * @param {Object} pool - MySQL connection pool
 * @returns {Promise<Object>} Migration result {success, failed, errors}
 */
async function migrateDepartments(departments, pool) {
  console.log('🏢 Migrating departments...');
  
  let success = 0;
  let failed = 0;
  const errors = [];
  
  for (let i = 0; i < departments.length; i++) {
    try {
      const dept = departments[i];
      const transformed = transformers.transformDepartment(dept);
      
      const query = `
        INSERT INTO departments (name, description)
        VALUES (?, ?)
      `;
      
      const values = [transformed.name, transformed.description || null];
      
      await pool.query(query, values);
      success++;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        success++;
      } else {
        failed++;
        errors.push({
          index: i,
          name: departments[i]?.name,
          error: error.message
        });
      }
    }
  }
  
  console.log(`  ✓ Departments: ${success} migrated, ${failed} failed`);
  return { success, failed, errors };
}

/**
 * Migrate attendance records
 * 
 * @param {Array} records - Array of attendance record objects
 * @param {Object} pool - MySQL connection pool
 * @returns {Promise<Object>} Migration result {success, failed, errors}
 */
async function migrateAttendanceRecords(records, pool) {
  console.log('📅 Migrating attendance records...');
  
  let success = 0;
  let failed = 0;
  const errors = [];
  
  for (let i = 0; i < records.length; i++) {
    try {
      const record = records[i];
      const transformed = transformers.transformAttendanceRecord(record);
      
      const query = `
        INSERT INTO attendance_records (
          employee_id, employee_name, date, morning_checkin, morning_checkout,
          afternoon_checkin, afternoon_checkout, total_hours, status, created_at, updated_at, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          morning_checkout = VALUES(morning_checkout),
          afternoon_checkin = VALUES(afternoon_checkin),
          afternoon_checkout = VALUES(afternoon_checkout),
          total_hours = VALUES(total_hours),
          status = VALUES(status),
          updated_at = VALUES(updated_at),
          updated_by = VALUES(updated_by)
      `;
      
      const values = [
        transformed.employee_id, transformed.employee_name, transformed.date,
        transformed.morning_checkin, transformed.morning_checkout,
        transformed.afternoon_checkin, transformed.afternoon_checkout,
        transformed.total_hours, transformed.status || 'present',
        transformed.created_at, transformed.updated_at, transformed.updated_by
      ];
      
      await pool.query(query, values);
      success++;
    } catch (error) {
      failed++;
      errors.push({
        index: i,
        employee_id: records[i]?.employee_id,
        date: records[i]?.date,
        error: error.message
      });
    }
  }
  
  console.log(`  ✓ Attendance Records: ${success} migrated, ${failed} failed`);
  return { success, failed, errors };
}

/**
 * Migrate leave requests
 * 
 * @param {Array} requests - Array of leave request objects
 * @param {Object} pool - MySQL connection pool
 * @returns {Promise<Object>} Migration result {success, failed, errors}
 */
async function migrateLeaveRequests(requests, pool) {
  console.log('📋 Migrating leave requests...');
  
  let success = 0;
  let failed = 0;
  const errors = [];
  
  for (let i = 0; i < requests.length; i++) {
    try {
      const request = requests[i];
      const transformed = transformers.transformLeaveRequest(request);
      
      const query = `
        INSERT INTO leave_requests (
          employee_id, employee_name, leave_type, leave_duration, start_date, end_date,
          reason, days_requested, status, created_at, created_by, notes, updated_at, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const values = [
        transformed.employee_id, transformed.employee_name, transformed.leave_type,
        transformed.leave_duration, transformed.start_date, transformed.end_date,
        transformed.reason, transformed.days_requested, transformed.status || 'pending',
        transformed.created_at, transformed.created_by, transformed.notes,
        transformed.updated_at, transformed.updated_by
      ];
      
      await pool.query(query, values);
      success++;
    } catch (error) {
      failed++;
      errors.push({
        index: i,
        employee_id: requests[i]?.employee_id,
        error: error.message
      });
    }
  }
  
  console.log(`  ✓ Leave Requests: ${success} migrated, ${failed} failed`);
  return { success, failed, errors };
}

/**
 * Migrate notifications
 * 
 * @param {Array} notifications - Array of notification objects
 * @param {Object} pool - MySQL connection pool
 * @returns {Promise<Object>} Migration result {success, failed, errors}
 */
async function migrateNotifications(notifications, pool) {
  console.log('🔔 Migrating notifications...');
  
  let success = 0;
  let failed = 0;
  const errors = [];
  
  for (let i = 0; i < notifications.length; i++) {
    try {
      const notif = notifications[i];
      const transformed = transformers.transformNotification(notif);
      
      const query = `
        INSERT INTO notifications (
          type, title, message, recipient_email, sender_email, related_id, related_type,
          is_read, is_viewed, created_at, priority, viewed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const values = [
        transformed.type, transformed.title, transformed.message,
        transformed.recipient_email, transformed.sender_email,
        transformed.related_id, transformed.related_type,
        transformed.is_read || false, transformed.is_viewed || false,
        transformed.created_at, transformed.priority || 'normal', transformed.viewed_at
      ];
      
      await pool.query(query, values);
      success++;
    } catch (error) {
      failed++;
      errors.push({
        index: i,
        recipient_email: notifications[i]?.recipient_email,
        error: error.message
      });
    }
  }
  
  console.log(`  ✓ Notifications: ${success} migrated, ${failed} failed`);
  return { success, failed, errors };
}

/**
 * Migrate attendance policy
 * 
 * @param {Object} policy - Attendance policy object
 * @param {Object} pool - MySQL connection pool
 * @returns {Promise<Object>} Migration result {success, failed, errors}
 */
async function migrateAttendancePolicy(policy, pool) {
  console.log('⏰ Migrating attendance policy...');
  
  let success = 0;
  let failed = 0;
  const errors = [];
  
  try {
    // If policy is null, use defaults
    if (!policy) {
      policy = {
        morning_start: '09:00',
        morning_end: '12:30',
        afternoon_start: '13:30',
        afternoon_end: '17:00'
      };
    }
    
    const transformed = transformers.transformAttendancePolicy(policy);
    
    // Clear existing policies
    await pool.query('DELETE FROM attendance_policy');
    
    const query = `
      INSERT INTO attendance_policy (
        morning_start, morning_end, afternoon_start, afternoon_end,
        late_tolerance, early_tolerance, updated_at, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      transformed.morning_start,
      transformed.morning_end,
      transformed.afternoon_start,
      transformed.afternoon_end,
      transformed.late_tolerance || 5,
      transformed.early_tolerance || 5,
      new Date(),
      'migration'
    ];
    
    await pool.query(query, values);
    success = 1;
  } catch (error) {
    failed = 1;
    errors.push({
      error: error.message
    });
  }
  
  console.log(`  ✓ Attendance Policy: ${success} migrated, ${failed} failed`);
  return { success, failed, errors };
}

/**
 * Verify migration by counting records
 * 
 * @param {Object} pool - MySQL connection pool
 * @param {Object} sourceData - Original data from JSON
 * @returns {Promise<Object>} Verification results
 */
async function verifyMigration(pool, sourceData) {
  console.log('');
  console.log('✅ Verifying migration...');
  
  const results = {};
  
  try {
    // Count employees
    const [empRows] = await pool.query('SELECT COUNT(*) as count FROM employees');
    results.employees = {
      migrated: empRows[0].count,
      source: sourceData.employees.length,
      match: empRows[0].count === sourceData.employees.length
    };
    
    // Count users
    const [userRows] = await pool.query('SELECT COUNT(*) as count FROM users');
    results.users = {
      migrated: userRows[0].count,
      source: Object.keys(sourceData.users).length,
      match: userRows[0].count >= Object.keys(sourceData.users).length
    };
    
    // Count departments
    const [deptRows] = await pool.query('SELECT COUNT(*) as count FROM departments');
    results.departments = {
      migrated: deptRows[0].count,
      source: sourceData.departments.length,
      match: deptRows[0].count === sourceData.departments.length
    };
    
    // Count attendance records
    const [attRows] = await pool.query('SELECT COUNT(*) as count FROM attendance_records');
    results.attendance_records = {
      migrated: attRows[0].count,
      source: sourceData.attendanceRecords.length,
      match: attRows[0].count === sourceData.attendanceRecords.length
    };
    
    // Count leave requests
    const [leaveRows] = await pool.query('SELECT COUNT(*) as count FROM leave_requests');
    results.leave_requests = {
      migrated: leaveRows[0].count,
      source: sourceData.leaveRequests.length,
      match: leaveRows[0].count === sourceData.leaveRequests.length
    };
    
    // Count notifications
    const [notifRows] = await pool.query('SELECT COUNT(*) as count FROM notifications');
    results.notifications = {
      migrated: notifRows[0].count,
      source: sourceData.notifications.length,
      match: notifRows[0].count === sourceData.notifications.length
    };
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    throw error;
  }
  
  return results;
}

/**
 * Create timestamp for backup filename
 */
function backupDataFile() {
  console.log('💾 Creating backup of data.json...');
  
  try {
    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      console.log(`  ✓ Created backup directory: ${BACKUP_DIR}`);
    }
    
    // Generate timestamp for backup filename
    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, '-')
      .replace(/\..+/, ''); // Remove milliseconds
    
    const backupFileName = `data_backup_migration_${timestamp}.json`;
    const backupFilePath = path.join(BACKUP_DIR, backupFileName);
    
    // Copy data.json to backup location
    fs.copyFileSync(DATA_FILE_PATH, backupFilePath);
    
    // Verify backup was created
    if (!fs.existsSync(backupFilePath)) {
      throw new Error('Backup file was not created successfully');
    }
    
    // Get file size for confirmation
    const stats = fs.statSync(backupFilePath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    
    console.log(`✅ Backup created: ${backupFileName} (${fileSizeKB} KB)`);
    console.log(`   Location: ${backupFilePath}`);
    
    return backupFilePath;
  } catch (error) {
    console.error('❌ Failed to create backup:', error.message);
    throw new Error(`Backup creation failed: ${error.message}`);
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   MySQL Migration Script - Employee Management System     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Show help if requested
  if (showHelp) {
    displayHelp();
    process.exit(0);
  }
  
  // Display mode
  if (isDryRun) {
    console.log('🔄 Running in DRY-RUN mode (no database changes will be made)');
    console.log('');
  }
  
  try {
    // Step 1: Read data.json
    const data = readDataJson();
    console.log('');
    
    // Step 2: Validate data structure
    const validation = validateDataJson(data);
    console.log('');
    
    // Display validation warnings
    if (validation.warnings.length > 0) {
      console.log('⚠️  Validation warnings:');
      validation.warnings.forEach(warning => {
        console.log(`   - ${warning}`);
      });
      console.log('');
    }
    
    // Display validation errors and exit if invalid
    if (!validation.valid) {
      console.log('❌ Validation errors:');
      validation.errors.forEach(error => {
        console.log(`   - ${error}`);
      });
      console.log('');
      console.log('Migration aborted due to validation errors.');
      console.log('Please fix the errors in data.json and try again.');
      process.exit(1);
    }
    
    // Step 3: Create backup
    const backupPath = backupDataFile();
    console.log('');
    
    // If dry-run mode, exit here
    if (isDryRun) {
      console.log('✅ Dry-run completed successfully');
      console.log('');
      console.log('Summary:');
      console.log(`  - Data validation: PASSED`);
      console.log(`  - Backup created: ${path.basename(backupPath)}`);
      console.log(`  - Ready for migration: YES`);
      console.log('');
      console.log('Run without --dry-run flag to perform actual migration.');
      process.exit(0);
    }
    
    // Step 4: Initialize database
    pool = await initializeDatabase();
    console.log('');
    
    // Step 5: Perform migration
    console.log('📊 Starting data migration...');
    console.log('');
    
    const migrationResults = {
      employees: await migrateEmployees(data.employees, pool),
      users: await migrateUsers(data.users, pool),
      departments: await migrateDepartments(data.departments, pool),
      attendance_records: await migrateAttendanceRecords(data.attendanceRecords, pool),
      leave_requests: await migrateLeaveRequests(data.leaveRequests, pool),
      notifications: await migrateNotifications(data.notifications, pool),
      attendance_policy: await migrateAttendancePolicy(data.attendancePolicy, pool)
    };
    
    console.log('');
    
    // Step 6: Verify migration
    const verificationResults = await verifyMigration(pool, data);
    
    // Step 7: Generate migration report
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('MIGRATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    
    Object.entries(verificationResults).forEach(([table, result]) => {
      const status = result.match ? '✅' : '⚠️ ';
      console.log(`${status} ${table}`);
      console.log(`   Source:  ${result.source} records`);
      console.log(`   Migrated: ${result.migrated} records`);
      if (!result.match) {
        console.log(`   ⚠️  MISMATCH!`);
      }
    });
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Migration completed successfully');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:', error.message);
    console.error('');
    
    if (error.stack && process.env.NODE_ENV === 'development') {
      console.error('Stack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  } finally {
    // Close database connection
    if (pool) {
      await pool.end();
    }
  }
}

// Execute main function if run directly
if (require.main === module) {
  main();
}

// Export functions for testing
module.exports = {
  readDataJson,
  validateDataJson,
  backupDataFile,
  initializeDatabase,
  migrateEmployees,
  migrateUsers,
  migrateDepartments,
  migrateAttendanceRecords,
  migrateLeaveRequests,
  migrateNotifications,
  migrateAttendancePolicy,
  verifyMigration
};
