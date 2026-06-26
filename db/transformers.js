/**
 * Data Transformation Module for MySQL Database Integration
 * 
 * This module provides functions to transform JSON data from data.json
 * into SQL-compatible formats for MySQL database insertion.
 * 
 * Key transformations:
 * - String numbers (e.g., "52040") → DECIMAL/INT
 * - Date strings → MySQL DATE format
 * - Empty strings → NULL for dates/numbers
 * - Boolean values → MySQL BOOLEAN (TINYINT)
 * - Objects (e.g., photo) → JSON strings
 * 
 * Requirements: 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11
 */

/**
 * Convert string or number to valid number or NULL
 * @param {string|number} value - Value to convert
 * @returns {number|null} Converted number or NULL
 */
function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? null : num;
}

/**
 * Convert string or number to integer or NULL
 * @param {string|number} value - Value to convert
 * @returns {number|null} Converted integer or NULL
 */
function toIntOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  return isNaN(num) ? null : num;
}

/**
 * Convert date string to MySQL DATE format (YYYY-MM-DD) or NULL
 * @param {string} value - Date string to convert
 * @returns {string|null} Date in YYYY-MM-DD format or NULL
 */
function toDateOrNull(value) {
  if (!value || value === '') {
    return null;
  }
  
  // If it's already in YYYY-MM-DD format, validate and return
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (dateRegex.test(value)) {
    const date = new Date(value);
    // Check if date is valid
    if (!isNaN(date.getTime())) {
      return value;
    }
  }
  
  // Try to parse as ISO date string
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  
  return null;
}

/**
 * Convert datetime string to MySQL DATETIME format or NULL
 * @param {string} value - DateTime string to convert
 * @returns {string|null} DateTime in MySQL format or NULL
 */
function toDateTimeOrNull(value) {
  if (!value || value === '') {
    return null;
  }
  
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    // MySQL DATETIME format: YYYY-MM-DD HH:MM:SS
    return date.toISOString().slice(0, 19).replace('T', ' ');
  }
  
  return null;
}

/**
 * Convert time string to MySQL TIME format (HH:MM:SS) or NULL
 * @param {string} value - Time string to convert
 * @returns {string|null} Time in HH:MM:SS format or NULL
 */
function toTimeOrNull(value) {
  if (!value || value === '') {
    return null;
  }
  
  // If already in HH:MM or HH:MM:SS format, ensure it has seconds
  const timeRegex = /^(\d{2}):(\d{2})(:(\d{2}))?$/;
  const match = value.match(timeRegex);
  if (match) {
    const hours = match[1];
    const minutes = match[2];
    const seconds = match[4] || '00';
    return `${hours}:${minutes}:${seconds}`;
  }
  
  return null;
}

/**
 * Convert value to string or NULL
 * @param {any} value - Value to convert
 * @returns {string|null} String value or NULL
 */
function toStringOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return String(value);
}

/**
 * Convert boolean value or NULL
 * @param {any} value - Value to convert
 * @returns {boolean|null} Boolean value or NULL
 */
function toBooleanOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return Boolean(value);
}

/**
 * Convert object to JSON string or NULL
 * @param {object} value - Object to convert
 * @returns {string|null} JSON string or NULL
 */
function toJsonStringOrNull(value) {
  if (value === null || value === undefined) {
    return null;
  }
  
  // If it's an empty object {}, return NULL
  if (typeof value === 'object' && Object.keys(value).length === 0) {
    return null;
  }
  
  try {
    return JSON.stringify(value);
  } catch (error) {
    return null;
  }
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
function isValidEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate employee data
 * @param {object} employee - Employee object to validate
 * @returns {object} {valid: boolean, reason: string}
 */
function validateEmployee(employee) {
  if (!employee) {
    return { valid: false, reason: 'Employee object is null or undefined' };
  }
  
  if (!employee.email || !isValidEmail(employee.email)) {
    return { valid: false, reason: 'Invalid or missing email address' };
  }
  
  if (!employee.employee_id) {
    return { valid: false, reason: 'Missing employee_id' };
  }
  
  if (!employee.first_name) {
    return { valid: false, reason: 'Missing first_name' };
  }
  
  // Validate salary if present
  if (employee.salary !== null && employee.salary !== undefined && employee.salary !== '') {
    const salary = toNumberOrNull(employee.salary);
    if (salary === null) {
      return { valid: false, reason: 'Invalid salary format' };
    }
    if (salary < 0) {
      return { valid: false, reason: 'Salary cannot be negative' };
    }
  }
  
  // Validate start_date if present
  if (employee.start_date && toDateOrNull(employee.start_date) === null) {
    return { valid: false, reason: 'Invalid start_date format' };
  }
  
  return { valid: true };
}

/**
 * Transform employee data from JSON to SQL-compatible format
 * @param {object} employee - Employee object from data.json
 * @returns {object} Transformed employee data for SQL insertion
 */
function transformEmployee(employee) {
  return {
    id: toIntOrNull(employee.id),
    employee_id: toStringOrNull(employee.employee_id),
    first_name: toStringOrNull(employee.first_name),
    last_name: toStringOrNull(employee.last_name),
    father_name: toStringOrNull(employee.father_name),
    gfather_name: toStringOrNull(employee.gfather_name),
    email: toStringOrNull(employee.email),
    department: toStringOrNull(employee.department),
    job_title: toStringOrNull(employee.job_title),
    salary: toNumberOrNull(employee.salary),
    start_date: toDateOrNull(employee.start_date),
    phone: toStringOrNull(employee.phone),
    status: toStringOrNull(employee.status) || 'active',
    annual_leave_days: toIntOrNull(employee.annual_leave_days),
    leave_start_year: toIntOrNull(employee.leave_start_year),
    created_at: toDateTimeOrNull(employee.created_at),
    created_by: toStringOrNull(employee.created_by),
    updated_at: toDateTimeOrNull(employee.updated_at),
    updated_by: toStringOrNull(employee.updated_by),
    photo: toJsonStringOrNull(employee.photo)
  };
}

/**
 * Transform user data from JSON to SQL-compatible format
 * @param {string} email - User email (key from users object)
 * @param {object} user - User object from data.json
 * @returns {object} Transformed user data for SQL insertion
 */
function transformUser(email, user) {
  return {
    email: toStringOrNull(email),
    id: toIntOrNull(user.id),
    role: toStringOrNull(user.role),
    password: toStringOrNull(user.password)
  };
}

/**
 * Validate user data
 * @param {string} email - User email
 * @param {object} user - User object to validate
 * @returns {object} {valid: boolean, reason: string}
 */
function validateUser(email, user) {
  if (!email || !isValidEmail(email)) {
    return { valid: false, reason: 'Invalid or missing email address' };
  }
  
  if (!user) {
    return { valid: false, reason: 'User object is null or undefined' };
  }
  
  if (!user.id) {
    return { valid: false, reason: 'Missing user id' };
  }
  
  if (!user.role) {
    return { valid: false, reason: 'Missing user role' };
  }
  
  if (!user.password) {
    return { valid: false, reason: 'Missing user password' };
  }
  
  return { valid: true };
}

/**
 * Transform attendance record from JSON to SQL-compatible format
 * @param {object} record - Attendance record from data.json
 * @returns {object} Transformed attendance record for SQL insertion
 */
function transformAttendanceRecord(record) {
  return {
    id: toIntOrNull(record.id),
    employee_id: toIntOrNull(record.employee_id),
    employee_name: toStringOrNull(record.employee_name),
    date: toDateOrNull(record.date),
    morning_checkin: toTimeOrNull(record.morning_checkin),
    morning_checkout: toTimeOrNull(record.morning_checkout),
    afternoon_checkin: toTimeOrNull(record.afternoon_checkin),
    afternoon_checkout: toTimeOrNull(record.afternoon_checkout),
    total_hours: toNumberOrNull(record.total_hours),
    status: toStringOrNull(record.status) || 'present',
    created_at: toDateTimeOrNull(record.created_at),
    updated_at: toDateTimeOrNull(record.updated_at),
    updated_by: toStringOrNull(record.updated_by)
  };
}

/**
 * Validate attendance record
 * @param {object} record - Attendance record to validate
 * @returns {object} {valid: boolean, reason: string}
 */
function validateAttendanceRecord(record) {
  if (!record) {
    return { valid: false, reason: 'Attendance record is null or undefined' };
  }
  
  if (!record.employee_id) {
    return { valid: false, reason: 'Missing employee_id' };
  }
  
  if (!record.date) {
    return { valid: false, reason: 'Missing date' };
  }
  
  if (toDateOrNull(record.date) === null) {
    return { valid: false, reason: 'Invalid date format' };
  }
  
  return { valid: true };
}

/**
 * Transform leave request from JSON to SQL-compatible format
 * @param {object} request - Leave request from data.json
 * @returns {object} Transformed leave request for SQL insertion
 */
function transformLeaveRequest(request) {
  return {
    id: toIntOrNull(request.id),
    employee_id: toIntOrNull(request.employee_id),
    employee_name: toStringOrNull(request.employee_name),
    leave_type: toStringOrNull(request.leave_type),
    leave_duration: toStringOrNull(request.leave_duration),
    start_date: toDateOrNull(request.start_date),
    end_date: toDateOrNull(request.end_date),
    reason: toStringOrNull(request.reason),
    days_requested: toNumberOrNull(request.days_requested),
    status: toStringOrNull(request.status) || 'pending',
    created_at: toDateOrNull(request.created_at),
    created_by: toStringOrNull(request.created_by),
    notes: toStringOrNull(request.notes),
    updated_at: toDateTimeOrNull(request.updated_at),
    updated_by: toStringOrNull(request.updated_by)
  };
}

/**
 * Validate leave request
 * @param {object} request - Leave request to validate
 * @returns {object} {valid: boolean, reason: string}
 */
function validateLeaveRequest(request) {
  if (!request) {
    return { valid: false, reason: 'Leave request is null or undefined' };
  }
  
  if (!request.employee_id) {
    return { valid: false, reason: 'Missing employee_id' };
  }
  
  if (!request.start_date) {
    return { valid: false, reason: 'Missing start_date' };
  }
  
  if (!request.end_date) {
    return { valid: false, reason: 'Missing end_date' };
  }
  
  if (toDateOrNull(request.start_date) === null) {
    return { valid: false, reason: 'Invalid start_date format' };
  }
  
  if (toDateOrNull(request.end_date) === null) {
    return { valid: false, reason: 'Invalid end_date format' };
  }
  
  return { valid: true };
}

/**
 * Transform notification from JSON to SQL-compatible format
 * @param {object} notification - Notification from data.json
 * @returns {object} Transformed notification for SQL insertion
 */
function transformNotification(notification) {
  return {
    id: toIntOrNull(notification.id),
    type: toStringOrNull(notification.type),
    title: toStringOrNull(notification.title),
    message: toStringOrNull(notification.message),
    recipient_email: toStringOrNull(notification.recipient_email),
    sender_email: toStringOrNull(notification.sender_email),
    related_id: toIntOrNull(notification.related_id),
    related_type: toStringOrNull(notification.related_type),
    is_read: toBooleanOrNull(notification.is_read),
    is_viewed: toBooleanOrNull(notification.is_viewed),
    created_at: toDateTimeOrNull(notification.created_at),
    priority: toStringOrNull(notification.priority) || 'normal',
    viewed_at: toDateTimeOrNull(notification.viewed_at)
  };
}

/**
 * Validate notification
 * @param {object} notification - Notification to validate
 * @returns {object} {valid: boolean, reason: string}
 */
function validateNotification(notification) {
  if (!notification) {
    return { valid: false, reason: 'Notification is null or undefined' };
  }
  
  if (!notification.type) {
    return { valid: false, reason: 'Missing notification type' };
  }
  
  if (!notification.title) {
    return { valid: false, reason: 'Missing notification title' };
  }
  
  if (!notification.message) {
    return { valid: false, reason: 'Missing notification message' };
  }
  
  if (!notification.recipient_email) {
    return { valid: false, reason: 'Missing recipient_email' };
  }
  
  if (!isValidEmail(notification.recipient_email)) {
    return { valid: false, reason: 'Invalid recipient_email format' };
  }
  
  return { valid: true };
}

/**
 * Transform department from JSON to SQL-compatible format
 * @param {object} department - Department from data.json
 * @returns {object} Transformed department for SQL insertion
 */
function transformDepartment(department) {
  return {
    id: toIntOrNull(department.id),
    name: toStringOrNull(department.name),
    description: toStringOrNull(department.description)
  };
}

/**
 * Validate department
 * @param {object} department - Department to validate
 * @returns {object} {valid: boolean, reason: string}
 */
function validateDepartment(department) {
  if (!department) {
    return { valid: false, reason: 'Department is null or undefined' };
  }
  
  if (!department.name) {
    return { valid: false, reason: 'Missing department name' };
  }
  
  return { valid: true };
}

/**
 * Transform attendance policy from JSON to SQL-compatible format
 * @param {object} policy - Attendance policy from data.json
 * @returns {object} Transformed policy for SQL insertion
 */
function transformAttendancePolicy(policy) {
  return {
    morning_start: toTimeOrNull(policy.morning_start),
    morning_end: toTimeOrNull(policy.morning_end),
    afternoon_start: toTimeOrNull(policy.afternoon_start),
    afternoon_end: toTimeOrNull(policy.afternoon_end),
    late_tolerance: toIntOrNull(policy.late_tolerance) || 15,
    early_tolerance: toIntOrNull(policy.early_tolerance) || 5,
    updated_at: toDateTimeOrNull(policy.updated_at),
    updated_by: toStringOrNull(policy.updated_by)
  };
}

/**
 * Validate attendance policy
 * @param {object} policy - Attendance policy to validate
 * @returns {object} {valid: boolean, reason: string}
 */
function validateAttendancePolicy(policy) {
  if (!policy) {
    return { valid: false, reason: 'Attendance policy is null or undefined' };
  }
  
  if (!policy.morning_start || !policy.morning_end || !policy.afternoon_start || !policy.afternoon_end) {
    return { valid: false, reason: 'Missing required time fields in attendance policy' };
  }
  
  return { valid: true };
}

module.exports = {
  // Utility functions
  toNumberOrNull,
  toIntOrNull,
  toDateOrNull,
  toDateTimeOrNull,
  toTimeOrNull,
  toStringOrNull,
  toBooleanOrNull,
  toJsonStringOrNull,
  isValidEmail,
  
  // Transform functions
  transformEmployee,
  transformUser,
  transformAttendanceRecord,
  transformLeaveRequest,
  transformNotification,
  transformDepartment,
  transformAttendancePolicy,
  
  // Validation functions
  validateEmployee,
  validateUser,
  validateAttendanceRecord,
  validateLeaveRequest,
  validateNotification,
  validateDepartment,
  validateAttendancePolicy
};
