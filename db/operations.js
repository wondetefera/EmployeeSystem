/**
 * Database Operations Module
 * Provides high-level CRUD operations for all entities
 */

const { query, transaction } = require('./connection');

// ========== EMPLOYEE OPERATIONS ==========

async function getAllEmployees() {
  const rows = await query('SELECT * FROM employees WHERE status = ?', ['active']);
  return rows.map(emp => ({
    ...emp,
    salary: emp.salary ? parseFloat(emp.salary) : null,
    photo: emp.photo ? JSON.parse(emp.photo) : null
  }));
}

async function getEmployeeById(id) {
  const rows = await query('SELECT * FROM employees WHERE id = ?', [id]);
  if (rows.length === 0) return null;
  const emp = rows[0];
  return {
    ...emp,
    salary: emp.salary ? parseFloat(emp.salary) : null,
    photo: emp.photo ? JSON.parse(emp.photo) : null
  };
}

async function addEmployee(employeeData, userData) {
  return await transaction(async (conn) => {
    // Insert employee
    const [empResult] = await conn.query(
      `INSERT INTO employees (employee_id, first_name, last_name, father_name, gfather_name, 
       email, department, job_title, salary, start_date, phone, status, annual_leave_days, 
       leave_start_year, created_at, created_by, photo) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        employeeData.employee_id,
        employeeData.first_name,
        employeeData.last_name || null,
        employeeData.father_name || null,
        employeeData.gfather_name || null,
        employeeData.email,
        employeeData.department || null,
        employeeData.job_title || null,
        employeeData.salary || null,
        employeeData.start_date || null,
        employeeData.phone || null,
        employeeData.status || 'active',
        employeeData.annual_leave_days || 14,
        employeeData.leave_start_year || new Date().getFullYear(),
        new Date(),
        employeeData.created_by || null,
        employeeData.photo ? JSON.stringify(employeeData.photo) : null
      ]
    );
    
    const employeeId = empResult.insertId;
    
    // Insert user if provided
    if (userData) {
      await conn.query(
        'INSERT INTO users (email, id, role, password) VALUES (?, ?, ?, ?)',
        [employeeData.email, employeeId, userData.role, userData.password]
      );
    }
    
    return { employeeId, userId: employeeId };
  });
}

async function updateEmployee(id, updates) {
  const fields = [];
  const values = [];
  
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'photo') {
      fields.push(`${key} = ?`);
      values.push(JSON.stringify(value));
    } else if (key !== 'id') {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  
  if (fields.length === 0) return false;
  
  values.push(new Date());
  fields.push('updated_at = ?');
  values.push(id);
  
  const result = await query(
    `UPDATE employees SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
  
  return result.affectedRows > 0;
}

async function deleteEmployee(id) {
  return await transaction(async (conn) => {
    // Soft delete employee
    await conn.query('UPDATE employees SET status = ? WHERE id = ?', ['inactive', id]);
    
    // Get employee email
    const [emp] = await conn.query('SELECT email FROM employees WHERE id = ?', [id]);
    if (emp.length > 0) {
      // Deactivate user account
      await conn.query('UPDATE users SET role = ? WHERE email = ?', ['inactive', emp[0].email]);
    }
    
    return true;
  });
}

// ========== USER OPERATIONS ==========

async function getUserByEmail(email) {
  const rows = await query('SELECT * FROM users WHERE email = ?', [email]);
  return rows.length > 0 ? rows[0] : null;
}

async function updateUserPassword(email, newPassword) {
  const result = await query(
    'UPDATE users SET password = ? WHERE email = ?',
    [newPassword, email]
  );
  return result.affectedRows > 0;
}

// ========== ATTENDANCE OPERATIONS ==========

async function getTodayAttendance(employeeId) {
  const today = new Date().toISOString().split('T')[0];
  const rows = await query(
    'SELECT * FROM attendance_records WHERE employee_id = ? AND date = ?',
    [employeeId, today]
  );
  return rows.length > 0 ? rows[0] : null;
}

async function recordAttendance(employeeId, employeeName, type, action, time) {
  const today = new Date().toISOString().split('T')[0];
  const field = `${type}_${action === 'checkin' ? 'checkin' : 'checkout'}`;
  
  // Use INSERT ... ON DUPLICATE KEY UPDATE for UPSERT
  await query(
    `INSERT INTO attendance_records (employee_id, employee_name, date, ${field}, created_at) 
     VALUES (?, ?, ?, ?, NOW()) 
     ON DUPLICATE KEY UPDATE ${field} = ?, updated_at = NOW()`,
    [employeeId, employeeName, today, time, time]
  );
  
  // Get updated record
  return await getTodayAttendance(employeeId);
}

async function getAttendanceHistory(filters = {}) {
  let sql = 'SELECT * FROM attendance_records WHERE 1=1';
  const params = [];
  
  if (filters.employee_id) {
    sql += ' AND employee_id = ?';
    params.push(filters.employee_id);
  }
  
  if (filters.start_date && filters.end_date) {
    sql += ' AND date BETWEEN ? AND ?';
    params.push(filters.start_date, filters.end_date);
  }
  
  sql += ' ORDER BY date DESC';
  
  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(parseInt(filters.limit));
  }
  
  return await query(sql, params);
}

async function updateAttendance(id, updates) {
  const fields = [];
  const values = [];
  
  for (const [key, value] of Object.entries(updates)) {
    if (key !== 'id') {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  
  if (fields.length === 0) return false;
  
  values.push(new Date());
  fields.push('updated_at = ?');
  values.push(id);
  
  const result = await query(
    `UPDATE attendance_records SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
  
  return result.affectedRows > 0;
}

// ========== LEAVE REQUEST OPERATIONS ==========

async function getLeaveRequests(filters = {}) {
  let sql = `SELECT lr.*, e.email FROM leave_requests lr 
             LEFT JOIN employees e ON lr.employee_id = e.id WHERE 1=1`;
  const params = [];
  
  if (filters.employee_id) {
    sql += ' AND lr.employee_id = ?';
    params.push(filters.employee_id);
  }
  
  if (filters.status) {
    sql += ' AND lr.status = ?';
    params.push(filters.status);
  }
  
  sql += ' ORDER BY lr.created_at DESC';
  
  const rows = await query(sql, params);
  return rows.map(row => ({
    ...row,
    days_requested: row.days_requested ? parseFloat(row.days_requested) : null
  }));
}

async function createLeaveRequest(requestData) {
  const [result] = await query(
    `INSERT INTO leave_requests (employee_id, employee_name, leave_type, leave_duration, 
     start_date, end_date, reason, days_requested, status, created_at, created_by) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      requestData.employee_id,
      requestData.employee_name,
      requestData.leave_type,
      requestData.leave_duration,
      requestData.start_date,
      requestData.end_date,
      requestData.reason || null,
      requestData.days_requested,
      requestData.status || 'pending',
      new Date().toISOString().split('T')[0],
      requestData.created_by || null
    ]
  );
  
  return result.insertId;
}

async function updateLeaveRequestStatus(id, status, notes, updatedBy) {
  return await transaction(async (conn) => {
    // Update leave request
    await conn.query(
      'UPDATE leave_requests SET status = ?, notes = ?, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [status, notes, updatedBy, id]
    );
    
    // Get leave request details for notification
    const [leave] = await conn.query('SELECT * FROM leave_requests WHERE id = ?', [id]);
    
    if (leave.length > 0) {
      // Create notification
      await conn.query(
        `INSERT INTO notifications (type, title, message, recipient_email, related_id, 
         related_type, created_at, priority) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          'leave_status',
          `Leave Request ${status}`,
          `Your leave request from ${leave[0].start_date} to ${leave[0].end_date} has been ${status}.`,
          leave[0].employee_name, // Will need to lookup email
          id,
          'leave_request',
          'high'
        ]
      );
    }
    
    return true;
  });
}

// ========== NOTIFICATION OPERATIONS ==========

async function getNotifications(recipientEmail, limit = 50) {
  const rows = await query(
    'SELECT * FROM notifications WHERE recipient_email = ? ORDER BY created_at DESC LIMIT ?',
    [recipientEmail, limit]
  );
  return rows.map(n => ({
    ...n,
    is_read: Boolean(n.is_read),
    is_viewed: Boolean(n.is_viewed)
  }));
}

async function createNotification(notificationData) {
  const [result] = await query(
    `INSERT INTO notifications (type, title, message, recipient_email, sender_email, 
     related_id, related_type, created_at, priority) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
    [
      notificationData.type,
      notificationData.title,
      notificationData.message,
      notificationData.recipient_email,
      notificationData.sender_email || null,
      notificationData.related_id || null,
      notificationData.related_type || null,
      notificationData.priority || 'normal'
    ]
  );
  
  return result.insertId;
}

async function markNotificationRead(id) {
  const result = await query(
    'UPDATE notifications SET is_read = TRUE WHERE id = ?',
    [id]
  );
  return result.affectedRows > 0;
}

async function markNotificationsViewed(recipientEmail) {
  const result = await query(
    'UPDATE notifications SET is_viewed = TRUE, viewed_at = NOW() WHERE recipient_email = ? AND is_viewed = FALSE',
    [recipientEmail]
  );
  return result.affectedRows;
}

// ========== DEPARTMENT OPERATIONS ==========

async function getDepartments() {
  return await query('SELECT * FROM departments ORDER BY name');
}

async function addDepartment(name, description) {
  const [result] = await query(
    'INSERT INTO departments (name, description) VALUES (?, ?)',
    [name, description || null]
  );
  return result.insertId;
}

module.exports = {
  // Employee operations
  getAllEmployees,
  getEmployeeById,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  
  // User operations
  getUserByEmail,
  updateUserPassword,
  
  // Attendance operations
  getTodayAttendance,
  recordAttendance,
  getAttendanceHistory,
  updateAttendance,
  
  // Leave request operations
  getLeaveRequests,
  createLeaveRequest,
  updateLeaveRequestStatus,
  
  // Notification operations
  getNotifications,
  createNotification,
  markNotificationRead,
  markNotificationsViewed,
  
  // Department operations
  getDepartments,
  addDepartment
};
