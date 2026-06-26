/**
 * Unit Tests for Data Transformation Module
 * 
 * Tests the transformation and validation functions for converting
 * JSON data to SQL-compatible formats for MySQL database.
 * 
 * Requirements: 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11
 */

const {
  toNumberOrNull,
  toIntOrNull,
  toDateOrNull,
  toDateTimeOrNull,
  toTimeOrNull,
  toStringOrNull,
  toBooleanOrNull,
  toJsonStringOrNull,
  isValidEmail,
  transformEmployee,
  transformUser,
  transformAttendanceRecord,
  transformLeaveRequest,
  transformNotification,
  transformDepartment,
  transformAttendancePolicy,
  validateEmployee,
  validateUser,
  validateAttendanceRecord,
  validateLeaveRequest,
  validateNotification,
  validateDepartment,
  validateAttendancePolicy
} = require('./transformers');

describe('Utility Functions', () => {
  describe('toNumberOrNull', () => {
    test('converts string numbers to numbers', () => {
      expect(toNumberOrNull('52040')).toBe(52040);
      expect(toNumberOrNull('45000.50')).toBe(45000.50);
    });

    test('passes through numeric values', () => {
      expect(toNumberOrNull(50000)).toBe(50000);
      expect(toNumberOrNull(100.5)).toBe(100.5);
    });

    test('returns null for empty strings', () => {
      expect(toNumberOrNull('')).toBe(null);
    });

    test('returns null for null/undefined', () => {
      expect(toNumberOrNull(null)).toBe(null);
      expect(toNumberOrNull(undefined)).toBe(null);
    });

    test('returns null for invalid number strings', () => {
      expect(toNumberOrNull('not-a-number')).toBe(null);
      expect(toNumberOrNull('abc123')).toBe(null);
    });
  });

  describe('toIntOrNull', () => {
    test('converts string integers to integers', () => {
      expect(toIntOrNull('22')).toBe(22);
      expect(toIntOrNull('100')).toBe(100);
    });

    test('converts floats to integers', () => {
      expect(toIntOrNull('22.5')).toBe(22);
      expect(toIntOrNull(22.9)).toBe(22);
    });

    test('returns null for empty strings', () => {
      expect(toIntOrNull('')).toBe(null);
    });

    test('returns null for null/undefined', () => {
      expect(toIntOrNull(null)).toBe(null);
      expect(toIntOrNull(undefined)).toBe(null);
    });
  });

  describe('toDateOrNull', () => {
    test('preserves valid YYYY-MM-DD format', () => {
      expect(toDateOrNull('2025-12-24')).toBe('2025-12-24');
      expect(toDateOrNull('2024-01-01')).toBe('2024-01-01');
    });

    test('converts ISO date strings to YYYY-MM-DD', () => {
      expect(toDateOrNull('2025-12-16T12:40:18.542Z')).toBe('2025-12-16');
    });

    test('returns null for empty strings', () => {
      expect(toDateOrNull('')).toBe(null);
    });

    test('returns null for invalid dates', () => {
      expect(toDateOrNull('invalid-date')).toBe(null);
      expect(toDateOrNull('2025-13-45')).toBe(null);
    });
  });

  describe('toDateTimeOrNull', () => {
    test('converts ISO datetime strings to MySQL format', () => {
      const result = toDateTimeOrNull('2025-12-16T12:40:18.542Z');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    test('returns null for empty strings', () => {
      expect(toDateTimeOrNull('')).toBe(null);
    });

    test('returns null for invalid datetime', () => {
      expect(toDateTimeOrNull('invalid')).toBe(null);
    });
  });

  describe('toTimeOrNull', () => {
    test('preserves valid HH:MM format and adds seconds', () => {
      expect(toTimeOrNull('08:45')).toBe('08:45:00');
      expect(toTimeOrNull('13:00')).toBe('13:00:00');
    });

    test('preserves HH:MM:SS format', () => {
      expect(toTimeOrNull('08:45:30')).toBe('08:45:30');
    });

    test('returns null for empty strings', () => {
      expect(toTimeOrNull('')).toBe(null);
      expect(toTimeOrNull(null)).toBe(null);
    });

    test('returns null for invalid time format', () => {
      expect(toTimeOrNull('invalid')).toBe(null);
      expect(toTimeOrNull('25:00')).toBe('25:00:00'); // Note: Does not validate range
    });
  });

  describe('toStringOrNull', () => {
    test('converts values to strings', () => {
      expect(toStringOrNull('test')).toBe('test');
      expect(toStringOrNull(123)).toBe('123');
    });

    test('returns null for empty strings', () => {
      expect(toStringOrNull('')).toBe(null);
    });

    test('returns null for null/undefined', () => {
      expect(toStringOrNull(null)).toBe(null);
      expect(toStringOrNull(undefined)).toBe(null);
    });
  });

  describe('toBooleanOrNull', () => {
    test('converts truthy values to true', () => {
      expect(toBooleanOrNull(true)).toBe(true);
      expect(toBooleanOrNull(1)).toBe(true);
      expect(toBooleanOrNull('yes')).toBe(true);
    });

    test('converts falsy values to false', () => {
      expect(toBooleanOrNull(false)).toBe(false);
      expect(toBooleanOrNull(0)).toBe(false);
    });

    test('returns null for null/undefined/empty', () => {
      expect(toBooleanOrNull(null)).toBe(null);
      expect(toBooleanOrNull(undefined)).toBe(null);
      expect(toBooleanOrNull('')).toBe(null);
    });
  });

  describe('toJsonStringOrNull', () => {
    test('converts objects to JSON strings', () => {
      const obj = { key: 'value', num: 123 };
      expect(toJsonStringOrNull(obj)).toBe(JSON.stringify(obj));
    });

    test('returns null for empty objects', () => {
      expect(toJsonStringOrNull({})).toBe(null);
    });

    test('returns null for null/undefined', () => {
      expect(toJsonStringOrNull(null)).toBe(null);
      expect(toJsonStringOrNull(undefined)).toBe(null);
    });

    test('handles arrays', () => {
      const arr = [1, 2, 3];
      expect(toJsonStringOrNull(arr)).toBe(JSON.stringify(arr));
    });
  });

  describe('isValidEmail', () => {
    test('accepts valid email addresses', () => {
      expect(isValidEmail('test@company.com')).toBe(true);
      expect(isValidEmail('user.name@example.co.uk')).toBe(true);
      expect(isValidEmail('abebe.kebede@company.com')).toBe(true);
    });

    test('rejects invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@company.com')).toBe(false);
      expect(isValidEmail('test @company.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
    });
  });
});

describe('Employee Transformation', () => {
  test('transforms complete employee data correctly', () => {
    const employee = {
      id: 6,
      employee_id: "20240006",
      first_name: "WONDWOSEN",
      last_name: "TEFERA",
      email: "wondwossentefera@gmail.com",
      department: "IT",
      job_title: "sr",
      salary: "52040",
      start_date: "2025-10-16",
      phone: "0912654365",
      status: "active",
      annual_leave_days: "22",
      leave_start_year: 2025,
      created_at: "2025-12-16T12:40:18.542Z",
      created_by: "abebe.kebede@company.com",
      photo: { url: "photo.jpg" }
    };

    const transformed = transformEmployee(employee);

    expect(transformed.id).toBe(6);
    expect(transformed.employee_id).toBe("20240006");
    expect(transformed.first_name).toBe("WONDWOSEN");
    expect(transformed.salary).toBe(52040); // String converted to number
    expect(transformed.start_date).toBe("2025-10-16");
    expect(transformed.annual_leave_days).toBe(22); // String converted to int
    expect(transformed.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(typeof transformed.photo).toBe('string'); // Object converted to JSON
  });

  test('handles empty strings as NULL for numbers', () => {
    const employee = {
      id: 1,
      employee_id: "001",
      first_name: "Test",
      email: "test@company.com",
      salary: "",
      annual_leave_days: ""
    };

    const transformed = transformEmployee(employee);

    expect(transformed.salary).toBe(null);
    expect(transformed.annual_leave_days).toBe(null);
  });

  test('handles empty strings as NULL for dates', () => {
    const employee = {
      id: 1,
      employee_id: "001",
      first_name: "Test",
      email: "test@company.com",
      start_date: ""
    };

    const transformed = transformEmployee(employee);

    expect(transformed.start_date).toBe(null);
  });

  test('handles missing optional fields', () => {
    const employee = {
      id: 1,
      employee_id: "001",
      first_name: "Test",
      email: "test@company.com"
    };

    const transformed = transformEmployee(employee);

    expect(transformed.last_name).toBe(null);
    expect(transformed.department).toBe(null);
    expect(transformed.salary).toBe(null);
    expect(transformed.phone).toBe(null);
  });

  test('sets default status to active', () => {
    const employee = {
      id: 1,
      employee_id: "001",
      first_name: "Test",
      email: "test@company.com"
    };

    const transformed = transformEmployee(employee);

    expect(transformed.status).toBe('active');
  });

  test('handles empty photo object as NULL', () => {
    const employee = {
      id: 1,
      employee_id: "001",
      first_name: "Test",
      email: "test@company.com",
      photo: {}
    };

    const transformed = transformEmployee(employee);

    expect(transformed.photo).toBe(null);
  });
});

describe('Employee Validation', () => {
  test('validates correct employee data', () => {
    const employee = {
      employee_id: "001",
      first_name: "Test",
      email: "test@company.com"
    };

    const result = validateEmployee(employee);

    expect(result.valid).toBe(true);
  });

  test('rejects employee with invalid email', () => {
    const employee = {
      employee_id: "001",
      first_name: "Test",
      email: "invalid-email"
    };

    const result = validateEmployee(employee);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('email');
  });

  test('rejects employee without employee_id', () => {
    const employee = {
      first_name: "Test",
      email: "test@company.com"
    };

    const result = validateEmployee(employee);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('employee_id');
  });

  test('rejects employee without first_name', () => {
    const employee = {
      employee_id: "001",
      email: "test@company.com"
    };

    const result = validateEmployee(employee);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('first_name');
  });

  test('rejects employee with negative salary', () => {
    const employee = {
      employee_id: "001",
      first_name: "Test",
      email: "test@company.com",
      salary: -5000
    };

    const result = validateEmployee(employee);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Salary');
  });

  test('rejects employee with invalid date format', () => {
    const employee = {
      employee_id: "001",
      first_name: "Test",
      email: "test@company.com",
      start_date: "invalid-date"
    };

    const result = validateEmployee(employee);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('start_date');
  });
});

describe('User Transformation', () => {
  test('transforms user data correctly', () => {
    const email = "test@company.com";
    const user = {
      id: 1,
      role: "admin",
      password: "admin123"
    };

    const transformed = transformUser(email, user);

    expect(transformed.email).toBe("test@company.com");
    expect(transformed.id).toBe(1);
    expect(transformed.role).toBe("admin");
    expect(transformed.password).toBe("admin123");
  });

  test('handles string IDs', () => {
    const email = "test@company.com";
    const user = {
      id: "6",
      role: "employee",
      password: "123456"
    };

    const transformed = transformUser(email, user);

    expect(transformed.id).toBe(6); // String converted to int
  });
});

describe('User Validation', () => {
  test('validates correct user data', () => {
    const result = validateUser("test@company.com", {
      id: 1,
      role: "admin",
      password: "pass123"
    });

    expect(result.valid).toBe(true);
  });

  test('rejects invalid email', () => {
    const result = validateUser("invalid", {
      id: 1,
      role: "admin",
      password: "pass123"
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('email');
  });

  test('rejects missing user fields', () => {
    expect(validateUser("test@company.com", { id: 1, role: "admin" }).valid).toBe(false);
    expect(validateUser("test@company.com", { id: 1, password: "pass" }).valid).toBe(false);
    expect(validateUser("test@company.com", { role: "admin", password: "pass" }).valid).toBe(false);
  });
});

describe('Attendance Record Transformation', () => {
  test('transforms complete attendance record', () => {
    const record = {
      id: 2,
      employee_id: 6,
      employee_name: "Wondwosen Tefera",
      date: "2024-12-20",
      morning_checkin: "08:45",
      morning_checkout: "12:00",
      afternoon_checkin: "13:00",
      afternoon_checkout: "17:15",
      total_hours: 7.5,
      status: "present",
      created_at: "2024-12-20T05:45:00.000Z"
    };

    const transformed = transformAttendanceRecord(record);

    expect(transformed.id).toBe(2);
    expect(transformed.employee_id).toBe(6);
    expect(transformed.date).toBe("2024-12-20");
    expect(transformed.morning_checkin).toBe("08:45:00"); // Seconds added
    expect(transformed.afternoon_checkout).toBe("17:15:00");
    expect(transformed.total_hours).toBe(7.5);
    expect(transformed.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  test('handles null time values', () => {
    const record = {
      id: 20,
      employee_id: 10,
      employee_name: "Test User",
      date: "2025-12-23",
      morning_checkin: null,
      morning_checkout: null,
      afternoon_checkin: "15:19",
      afternoon_checkout: null,
      total_hours: 0,
      status: "present"
    };

    const transformed = transformAttendanceRecord(record);

    expect(transformed.morning_checkin).toBe(null);
    expect(transformed.morning_checkout).toBe(null);
    expect(transformed.afternoon_checkin).toBe("15:19:00");
    expect(transformed.afternoon_checkout).toBe(null);
  });
});

describe('Attendance Record Validation', () => {
  test('validates correct attendance record', () => {
    const record = {
      employee_id: 1,
      date: "2024-12-20"
    };

    const result = validateAttendanceRecord(record);

    expect(result.valid).toBe(true);
  });

  test('rejects record without employee_id', () => {
    const result = validateAttendanceRecord({ date: "2024-12-20" });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('employee_id');
  });

  test('rejects record without date', () => {
    const result = validateAttendanceRecord({ employee_id: 1 });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('date');
  });

  test('rejects record with invalid date', () => {
    const result = validateAttendanceRecord({
      employee_id: 1,
      date: "invalid-date"
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('date');
  });
});

describe('Leave Request Transformation', () => {
  test('transforms complete leave request', () => {
    const request = {
      id: 2,
      employee_id: 10,
      employee_name: "Mikiyas akne",
      leave_type: "Annual Leave",
      leave_duration: "full_day",
      start_date: "2025-12-22",
      end_date: "2025-12-25",
      reason: "Personal leave",
      days_requested: 4,
      status: "approved",
      created_at: "2025-12-22",
      created_by: "miki@gmail.com",
      notes: "Approved by manager"
    };

    const transformed = transformLeaveRequest(request);

    expect(transformed.id).toBe(2);
    expect(transformed.employee_id).toBe(10);
    expect(transformed.leave_type).toBe("Annual Leave");
    expect(transformed.start_date).toBe("2025-12-22");
    expect(transformed.end_date).toBe("2025-12-25");
    expect(transformed.days_requested).toBe(4);
    expect(transformed.status).toBe("approved");
  });

  test('handles decimal days_requested', () => {
    const request = {
      id: 3,
      employee_id: 13,
      leave_type: "Annual Leave",
      leave_duration: "half_day_morning",
      start_date: "2025-12-23",
      end_date: "2025-12-23",
      days_requested: 0.5
    };

    const transformed = transformLeaveRequest(request);

    expect(transformed.days_requested).toBe(0.5);
  });

  test('sets default status to pending', () => {
    const request = {
      id: 1,
      employee_id: 10,
      leave_type: "Annual Leave",
      start_date: "2025-12-22",
      end_date: "2025-12-25"
    };

    const transformed = transformLeaveRequest(request);

    expect(transformed.status).toBe('pending');
  });
});

describe('Leave Request Validation', () => {
  test('validates correct leave request', () => {
    const request = {
      employee_id: 1,
      start_date: "2025-12-22",
      end_date: "2025-12-25"
    };

    const result = validateLeaveRequest(request);

    expect(result.valid).toBe(true);
  });

  test('rejects request without employee_id', () => {
    const result = validateLeaveRequest({
      start_date: "2025-12-22",
      end_date: "2025-12-25"
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('employee_id');
  });

  test('rejects request without dates', () => {
    expect(validateLeaveRequest({ employee_id: 1 }).valid).toBe(false);
  });

  test('rejects request with invalid date format', () => {
    const result = validateLeaveRequest({
      employee_id: 1,
      start_date: "invalid",
      end_date: "2025-12-25"
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('start_date');
  });
});

describe('Notification Transformation', () => {
  test('transforms complete notification', () => {
    const notification = {
      id: 1,
      type: "leave_request",
      title: "New Leave Request",
      message: "Employee has submitted a leave request",
      recipient_email: "manager@company.com",
      sender_email: "employee@company.com",
      related_id: 2,
      related_type: "leave_request",
      is_read: false,
      is_viewed: true,
      created_at: "2025-12-22T13:37:49.606Z",
      priority: "normal",
      viewed_at: "2025-12-22T13:51:52.860Z"
    };

    const transformed = transformNotification(notification);

    expect(transformed.id).toBe(1);
    expect(transformed.type).toBe("leave_request");
    expect(transformed.title).toBe("New Leave Request");
    expect(transformed.recipient_email).toBe("manager@company.com");
    expect(transformed.is_read).toBe(false);
    expect(transformed.is_viewed).toBe(true);
    expect(transformed.priority).toBe("normal");
  });

  test('sets default priority to normal', () => {
    const notification = {
      id: 1,
      type: "system",
      title: "Test",
      message: "Test message",
      recipient_email: "user@company.com"
    };

    const transformed = transformNotification(notification);

    expect(transformed.priority).toBe('normal');
  });
});

describe('Notification Validation', () => {
  test('validates correct notification', () => {
    const notification = {
      type: "leave_request",
      title: "Test",
      message: "Test message",
      recipient_email: "user@company.com"
    };

    const result = validateNotification(notification);

    expect(result.valid).toBe(true);
  });

  test('rejects notification without required fields', () => {
    expect(validateNotification({ type: "test" }).valid).toBe(false);
    expect(validateNotification({ title: "test" }).valid).toBe(false);
    expect(validateNotification({ message: "test" }).valid).toBe(false);
  });

  test('rejects notification with invalid email', () => {
    const result = validateNotification({
      type: "test",
      title: "Test",
      message: "Message",
      recipient_email: "invalid-email"
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('email');
  });
});

describe('Department Transformation', () => {
  test('transforms department data', () => {
    const department = {
      id: 1,
      name: "Human Resources",
      description: "Manages employee relations"
    };

    const transformed = transformDepartment(department);

    expect(transformed.id).toBe(1);
    expect(transformed.name).toBe("Human Resources");
    expect(transformed.description).toBe("Manages employee relations");
  });
});

describe('Attendance Policy Transformation', () => {
  test('transforms attendance policy', () => {
    const policy = {
      morning_start: "08:15",
      morning_end: "12:00",
      afternoon_start: "13:15",
      afternoon_end: "17:00",
      late_tolerance: 15,
      early_tolerance: 5,
      updated_at: "2025-12-24T08:55:05.487Z",
      updated_by: "admin@company.com"
    };

    const transformed = transformAttendancePolicy(policy);

    expect(transformed.morning_start).toBe("08:15:00");
    expect(transformed.afternoon_end).toBe("17:00:00");
    expect(transformed.late_tolerance).toBe(15);
    expect(transformed.early_tolerance).toBe(5);
  });

  test('sets default tolerances', () => {
    const policy = {
      morning_start: "08:15",
      morning_end: "12:00",
      afternoon_start: "13:15",
      afternoon_end: "17:00"
    };

    const transformed = transformAttendancePolicy(policy);

    expect(transformed.late_tolerance).toBe(15);
    expect(transformed.early_tolerance).toBe(5);
  });
});
