/**
 * Simple test script for transformers module
 * Run with: node test-transformers.js
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
  validateEmployee,
  validateUser,
  validateAttendanceRecord,
  validateLeaveRequest,
  validateNotification
} = require('./db/transformers.js');

let passed = 0;
let failed = 0;

function test(name, condition) {
  if (condition) {
    console.log(`✓ ${name}`);
    passed++;
  } else {
    console.log(`✗ ${name}`);
    failed++;
  }
}

console.log('=== Testing Utility Functions ===\n');

// Test toNumberOrNull
test('toNumberOrNull converts string "52040" to 52040', toNumberOrNull('52040') === 52040);
test('toNumberOrNull converts empty string to null', toNumberOrNull('') === null);
test('toNumberOrNull converts null to null', toNumberOrNull(null) === null);

// Test toIntOrNull
test('toIntOrNull converts string "22" to 22', toIntOrNull('22') === 22);
test('toIntOrNull converts empty string to null', toIntOrNull('') === null);

// Test toDateOrNull
test('toDateOrNull preserves "2025-12-24"', toDateOrNull('2025-12-24') === '2025-12-24');
test('toDateOrNull converts empty string to null', toDateOrNull('') === null);

// Test toTimeOrNull
test('toTimeOrNull converts "08:45" to "08:45:00"', toTimeOrNull('08:45') === '08:45:00');
test('toTimeOrNull preserves "08:45:30"', toTimeOrNull('08:45:30') === '08:45:30');
test('toTimeOrNull converts empty string to null', toTimeOrNull('') === null);

// Test isValidEmail
test('isValidEmail accepts valid email', isValidEmail('test@company.com') === true);
test('isValidEmail rejects invalid email', isValidEmail('invalid') === false);

console.log('\n=== Testing Employee Transformation ===\n');

const employee = {
  id: 6,
  employee_id: "20240006",
  first_name: "WONDWOSEN",
  last_name: "TEFERA",
  email: "wondwosen@gmail.com",
  department: "IT",
  salary: "52040",
  start_date: "2025-10-16",
  annual_leave_days: "22",
  status: "active",
  photo: { url: "photo.jpg" }
};

const transformed = transformEmployee(employee);

test('transformEmployee converts salary string to number', transformed.salary === 52040);
test('transformEmployee preserves date format', transformed.start_date === '2025-10-16');
test('transformEmployee converts annual_leave_days to int', transformed.annual_leave_days === 22);
test('transformEmployee converts photo object to JSON string', typeof transformed.photo === 'string');
test('transformEmployee sets status', transformed.status === 'active');

// Test empty string handling
const employeeWithEmpty = {
  id: 1,
  employee_id: "001",
  first_name: "Test",
  email: "test@company.com",
  salary: "",
  start_date: ""
};

const transformedEmpty = transformEmployee(employeeWithEmpty);

test('transformEmployee converts empty salary to null', transformedEmpty.salary === null);
test('transformEmployee converts empty start_date to null', transformedEmpty.start_date === null);

console.log('\n=== Testing Employee Validation ===\n');

const validEmployee = {
  employee_id: "001",
  first_name: "Test",
  email: "test@company.com"
};

test('validateEmployee accepts valid employee', validateEmployee(validEmployee).valid === true);

const invalidEmployee1 = {
  employee_id: "001",
  first_name: "Test",
  email: "invalid-email"
};

test('validateEmployee rejects invalid email', validateEmployee(invalidEmployee1).valid === false);

const invalidEmployee2 = {
  first_name: "Test",
  email: "test@company.com"
};

test('validateEmployee rejects missing employee_id', validateEmployee(invalidEmployee2).valid === false);

console.log('\n=== Testing User Transformation ===\n');

const user = {
  id: 1,
  role: "admin",
  password: "admin123"
};

const transformedUser = transformUser("test@company.com", user);

test('transformUser sets email correctly', transformedUser.email === "test@company.com");
test('transformUser sets id correctly', transformedUser.id === 1);
test('transformUser sets role correctly', transformedUser.role === "admin");

console.log('\n=== Testing Attendance Record Transformation ===\n');

const attendance = {
  id: 2,
  employee_id: 6,
  employee_name: "Wondwosen Tefera",
  date: "2024-12-20",
  morning_checkin: "08:45",
  morning_checkout: "12:00",
  total_hours: 7.5,
  status: "present"
};

const transformedAttendance = transformAttendanceRecord(attendance);

test('transformAttendanceRecord preserves date', transformedAttendance.date === "2024-12-20");
test('transformAttendanceRecord adds seconds to time', transformedAttendance.morning_checkin === "08:45:00");
test('transformAttendanceRecord preserves numeric values', transformedAttendance.total_hours === 7.5);

console.log('\n=== Testing Leave Request Transformation ===\n');

const leaveRequest = {
  id: 2,
  employee_id: 10,
  employee_name: "Test User",
  leave_type: "Annual Leave",
  start_date: "2025-12-22",
  end_date: "2025-12-25",
  days_requested: 4,
  status: "approved"
};

const transformedLeave = transformLeaveRequest(leaveRequest);

test('transformLeaveRequest preserves dates', transformedLeave.start_date === "2025-12-22");
test('transformLeaveRequest preserves days_requested', transformedLeave.days_requested === 4);
test('transformLeaveRequest preserves status', transformedLeave.status === "approved");

console.log('\n=== Testing Notification Transformation ===\n');

const notification = {
  id: 1,
  type: "leave_request",
  title: "New Leave Request",
  message: "Employee has submitted a leave request",
  recipient_email: "manager@company.com",
  is_read: false,
  priority: "normal"
};

const transformedNotification = transformNotification(notification);

test('transformNotification preserves type', transformedNotification.type === "leave_request");
test('transformNotification preserves recipient_email', transformedNotification.recipient_email === "manager@company.com");
test('transformNotification preserves boolean values', transformedNotification.is_read === false);

console.log('\n=== Testing NULL Value Conversion ===\n');

test('Empty string for number converts to NULL', toNumberOrNull('') === null);
test('Empty string for date converts to NULL', toDateOrNull('') === null);
test('Empty string for time converts to NULL', toTimeOrNull('') === null);
test('Undefined converts to NULL', toStringOrNull(undefined) === null);
test('Empty photo object converts to NULL', toJsonStringOrNull({}) === null);

console.log('\n=== Summary ===');
console.log(`Total: ${passed + failed}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed === 0) {
  console.log('\n✓ All tests passed!');
  process.exit(0);
} else {
  console.log(`\n✗ ${failed} test(s) failed`);
  process.exit(1);
}
