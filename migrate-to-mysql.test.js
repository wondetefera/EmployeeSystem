/**
 * Unit tests for migrate-to-mysql.js
 * Tests the core functions: readDataJson, validateDataJson, backupDataFile
 */

const { readDataJson, validateDataJson, backupDataFile } = require('./migrate-to-mysql');
const fs = require('fs');
const path = require('path');

// Test readDataJson function
console.log('Testing readDataJson()...');
try {
  const data = readDataJson();
  
  // Verify data is an object
  if (typeof data !== 'object') {
    throw new Error('readDataJson() should return an object');
  }
  
  // Verify it has the expected top-level properties
  const expectedProps = ['employees', 'users', 'departments', 'leaveRequests', 'attendanceRecords', 'notifications', 'attendancePolicy'];
  for (const prop of expectedProps) {
    if (!data.hasOwnProperty(prop)) {
      throw new Error(`Missing expected property: ${prop}`);
    }
  }
  
  console.log('✅ readDataJson() passed all tests');
} catch (error) {
  console.error('❌ readDataJson() test failed:', error.message);
  process.exit(1);
}

// Test validateDataJson function
console.log('\nTesting validateDataJson()...');
try {
  const data = readDataJson();
  const result = validateDataJson(data);
  
  // Verify result has expected properties
  if (!result.hasOwnProperty('valid') || !result.hasOwnProperty('errors') || !result.hasOwnProperty('warnings')) {
    throw new Error('validateDataJson() should return object with valid, errors, and warnings properties');
  }
  
  // Verify valid is a boolean
  if (typeof result.valid !== 'boolean') {
    throw new Error('result.valid should be a boolean');
  }
  
  // Verify errors is an array
  if (!Array.isArray(result.errors)) {
    throw new Error('result.errors should be an array');
  }
  
  // Verify warnings is an array
  if (!Array.isArray(result.warnings)) {
    throw new Error('result.warnings should be an array');
  }
  
  // For valid data, should return valid: true
  if (!result.valid) {
    throw new Error(`Validation should pass for valid data. Errors: ${result.errors.join(', ')}`);
  }
  
  console.log('✅ validateDataJson() passed all tests');
} catch (error) {
  console.error('❌ validateDataJson() test failed:', error.message);
  process.exit(1);
}

// Test validateDataJson with invalid data
console.log('\nTesting validateDataJson() with invalid data...');
try {
  const invalidData = { employees: 'not an array' };
  const result = validateDataJson(invalidData);
  
  // Should return valid: false for invalid data
  if (result.valid) {
    throw new Error('Validation should fail for invalid data');
  }
  
  // Should have errors
  if (result.errors.length === 0) {
    throw new Error('Validation should report errors for invalid data');
  }
  
  console.log('✅ validateDataJson() correctly rejects invalid data');
} catch (error) {
  console.error('❌ validateDataJson() invalid data test failed:', error.message);
  process.exit(1);
}

// Test backupDataFile function
console.log('\nTesting backupDataFile()...');
try {
  const backupPath = backupDataFile();
  
  // Verify backup path is a string
  if (typeof backupPath !== 'string') {
    throw new Error('backupDataFile() should return a string path');
  }
  
  // Verify backup file exists
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file was not created at ${backupPath}`);
  }
  
  // Verify backup file contains valid JSON
  const backupContent = fs.readFileSync(backupPath, 'utf8');
  const backupData = JSON.parse(backupContent);
  
  // Verify backup data matches original data
  const originalData = readDataJson();
  if (JSON.stringify(backupData) !== JSON.stringify(originalData)) {
    throw new Error('Backup data does not match original data');
  }
  
  // Verify backup file naming convention (contains timestamp)
  const fileName = path.basename(backupPath);
  if (!fileName.startsWith('data_backup_') || !fileName.endsWith('.json')) {
    throw new Error(`Backup file name does not follow expected pattern: ${fileName}`);
  }
  
  console.log('✅ backupDataFile() passed all tests');
  console.log(`   Backup created at: ${backupPath}`);
} catch (error) {
  console.error('❌ backupDataFile() test failed:', error.message);
  process.exit(1);
}

console.log('\n═══════════════════════════════════════════');
console.log('✅ All tests passed successfully!');
console.log('═══════════════════════════════════════════\n');
