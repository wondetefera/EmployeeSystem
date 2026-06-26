/**
 * Quick Migration Script - data.json to MySQL
 * Run this once to migrate your existing data
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

async function migrate() {
  console.log('🚀 Starting Quick Migration to MySQL...\n');
  
  // Read data.json
  console.log('📖 Reading data.json...');
  const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
  console.log(`✓ Found ${data.employees.length} employees, ${data.attendanceRecords.length} attendance records`);
  
  // Create backup
  const backupName = `./backups/data.json.backup.${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.mkdirSync('./backups', { recursive: true });
  fs.writeFileSync(backupName, JSON.stringify(data, null, 2));
  console.log(`✓ Backup created: ${backupName}\n`);
  
  // Connect to MySQL
  console.log('🔌 Connecting to MySQL...');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '3306')
  });
  console.log('✓ Connected to MySQL\n');
  
  try {
    // Create tables
    console.log('📊 Creating tables...');
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id INT PRIMARY KEY AUTO_INCREMENT,
        employee_id VARCHAR(50) UNIQUE,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        father_name VARCHAR(100),
        gfather_name VARCHAR(100),
        email VARCHAR(255) UNIQUE,
        department VARCHAR(100),
        job_title VARCHAR(100),
        salary DECIMAL(10,2),
        start_date DATE,
        phone VARCHAR(20),
        status VARCHAR(20) DEFAULT 'active',
        annual_leave_days INT,
        leave_start_year INT,
        created_at DATETIME,
        created_by VARCHAR(255),
        updated_at DATETIME,
        updated_by VARCHAR(255),
        photo TEXT,
        INDEX idx_email (email),
        INDEX idx_status (status)
      )
    `);
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        email VARCHAR(255) PRIMARY KEY,
        id INT UNIQUE,
        role VARCHAR(50),
        password VARCHAR(255)
      )
    `);
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) UNIQUE,
        description TEXT
      )
    `);
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id INT PRIMARY KEY AUTO_INCREMENT,
        employee_id INT,
        employee_name VARCHAR(255),
        date DATE,
        morning_checkin TIME,
        morning_checkout TIME,
        afternoon_checkin TIME,
        afternoon_checkout TIME,
        total_hours DECIMAL(5,2),
        status VARCHAR(20),
        created_at DATETIME,
        updated_at DATETIME,
        updated_by VARCHAR(255),
        UNIQUE KEY unique_employee_date (employee_id, date)
      )
    `);
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        employee_id INT,
        employee_name VARCHAR(255),
        leave_type VARCHAR(50),
        leave_duration VARCHAR(50),
        start_date DATE,
        end_date DATE,
        reason TEXT,
        days_requested DECIMAL(5,2),
        status VARCHAR(20),
        created_at DATE,
        created_by VARCHAR(255),
        notes TEXT,
        updated_at DATETIME,
        updated_by VARCHAR(255)
      )
    `);
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        type VARCHAR(50),
        title VARCHAR(255),
        message TEXT,
        recipient_email VARCHAR(255),
        sender_email VARCHAR(255),
        related_id INT,
        related_type VARCHAR(50),
        is_read BOOLEAN DEFAULT FALSE,
        is_viewed BOOLEAN DEFAULT FALSE,
        created_at DATETIME,
        priority VARCHAR(20),
        viewed_at DATETIME
      )
    `);
    
    console.log('✓ Tables created\n');
    
    // Migrate employees
    console.log('👥 Migrating employees...');
    let empCount = 0;
    for (const emp of data.employees) {
      try {
        await connection.query(
          `INSERT IGNORE INTO employees (id, employee_id, first_name, last_name, father_name, gfather_name, 
           email, department, job_title, salary, start_date, phone, status, annual_leave_days, 
           leave_start_year, created_at, created_by, updated_at, updated_by, photo) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [emp.id, emp.employee_id, emp.first_name, emp.last_name, emp.father_name, emp.gfather_name,
           emp.email, emp.department, emp.job_title, emp.salary || null, emp.start_date || null,
           emp.phone, emp.status, emp.annual_leave_days, emp.leave_start_year,
           emp.created_at, emp.created_by, emp.updated_at, emp.updated_by, JSON.stringify(emp.photo)]
        );
        empCount++;
      } catch (err) {
        console.warn(`  ⚠️  Skipped employee ${emp.email}: ${err.message}`);
      }
    }
    console.log(`✓ Migrated ${empCount}/${data.employees.length} employees\n`);
    
    // Migrate users
    console.log('🔐 Migrating users...');
    let userCount = 0;
    for (const [email, user] of Object.entries(data.users)) {
      try {
        await connection.query(
          `INSERT IGNORE INTO users (email, id, role, password) VALUES (?, ?, ?, ?)`,
          [email, user.id, user.role, user.password]
        );
        userCount++;
      } catch (err) {
        console.warn(`  ⚠️  Skipped user ${email}: ${err.message}`);
      }
    }
    console.log(`✓ Migrated ${userCount}/${Object.keys(data.users).length} users\n`);
    
    // Migrate departments
    console.log('🏢 Migrating departments...');
    let deptCount = 0;
    for (const dept of data.departments) {
      try {
        await connection.query(
          `INSERT IGNORE INTO departments (id, name, description) VALUES (?, ?, ?)`,
          [dept.id, dept.name, dept.description]
        );
        deptCount++;
      } catch (err) {
        console.warn(`  ⚠️  Skipped department ${dept.name}: ${err.message}`);
      }
    }
    console.log(`✓ Migrated ${deptCount}/${data.departments.length} departments\n`);
    
    // Migrate attendance records
    console.log('📅 Migrating attendance records...');
    let attCount = 0;
    for (const att of data.attendanceRecords) {
      try {
        await connection.query(
          `INSERT IGNORE INTO attendance_records (id, employee_id, employee_name, date, morning_checkin, 
           morning_checkout, afternoon_checkin, afternoon_checkout, total_hours, status, created_at, 
           updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [att.id, att.employee_id, att.employee_name, att.date, att.morning_checkin, att.morning_checkout,
           att.afternoon_checkin, att.afternoon_checkout, att.total_hours, att.status, att.created_at,
           att.updated_at, att.updated_by]
        );
        attCount++;
      } catch (err) {
        console.warn(`  ⚠️  Skipped attendance record ${att.id}: ${err.message}`);
      }
    }
    console.log(`✓ Migrated ${attCount}/${data.attendanceRecords.length} attendance records\n`);
    
    // Migrate leave requests
    console.log('📝 Migrating leave requests...');
    let leaveCount = 0;
    for (const leave of data.leaveRequests) {
      try {
        await connection.query(
          `INSERT IGNORE INTO leave_requests (id, employee_id, employee_name, leave_type, leave_duration, 
           start_date, end_date, reason, days_requested, status, created_at, created_by, notes, 
           updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [leave.id, leave.employee_id, leave.employee_name, leave.leave_type, leave.leave_duration,
           leave.start_date, leave.end_date, leave.reason, leave.days_requested, leave.status,
           leave.created_at, leave.created_by, leave.notes, leave.updated_at, leave.updated_by]
        );
        leaveCount++;
      } catch (err) {
        console.warn(`  ⚠️  Skipped leave request ${leave.id}: ${err.message}`);
      }
    }
    console.log(`✓ Migrated ${leaveCount}/${data.leaveRequests.length} leave requests\n`);
    
    // Migrate notifications
    console.log('🔔 Migrating notifications...');
    let notifCount = 0;
    for (const notif of data.notifications) {
      try {
        await connection.query(
          `INSERT IGNORE INTO notifications (id, type, title, message, recipient_email, sender_email, 
           related_id, related_type, is_read, is_viewed, created_at, priority, viewed_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [notif.id, notif.type, notif.title, notif.message, notif.recipient_email, notif.sender_email,
           notif.related_id, notif.related_type, notif.is_read || false, notif.is_viewed || false,
           notif.created_at, notif.priority, notif.viewed_at]
        );
        notifCount++;
      } catch (err) {
        console.warn(`  ⚠️  Skipped notification ${notif.id}: ${err.message}`);
      }
    }
    console.log(`✓ Migrated ${notifCount}/${data.notifications.length} notifications\n`);
    
    console.log('✅ Migration Complete!\n');
    console.log('📊 Summary:');
    console.log(`   Employees: ${empCount}`);
    console.log(`   Users: ${userCount}`);
    console.log(`   Departments: ${deptCount}`);
    console.log(`   Attendance: ${attCount}`);
    console.log(`   Leave Requests: ${leaveCount}`);
    console.log(`   Notifications: ${notifCount}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await connection.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run migration
migrate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
