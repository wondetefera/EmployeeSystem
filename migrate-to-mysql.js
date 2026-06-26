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

// Configuration
const DATA_FILE_PATH = path.join(__dirname, 'data.json');
const BACKUP_DIR = path.join(__dirname, 'backups');

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
  
  // Validate attendancePolicy object
  if (typeof data.attendancePolicy !== 'object' || Array.isArray(data.attendancePolicy)) {
    errors.push('attendancePolicy must be an object (not an array)');
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
    
    // TODO: Step 4: Connect to database (to be implemented in next task)
    console.log('🔌 Database connection (to be implemented in next task)');
    console.log('');
    
    // TODO: Step 5: Migrate data (to be implemented in subsequent tasks)
    console.log('📊 Data migration (to be implemented in subsequent tasks)');
    console.log('');
    
    console.log('✅ Migration script structure complete');
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
  backupDataFile
};
