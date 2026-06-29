/**
 * Initialize data.json with default data if it doesn't exist
 * This runs on server startup to ensure Render has a data.json file
 */

const fs = require('fs');
const path = require('path');

const dataFilePath = path.join(__dirname, 'data.json');

// Default data structure with admin user
const defaultData = {
  "employees": [
    {
      "id": 1,
      "employee_id": "ADMIN-001",
      "first_name": "System",
      "last_name": "Administrator",
      "email": "admin@company.com",
      "department": "Administration",
      "job_title": "System Administrator",
      "salary": 0,
      "start_date": "2024-01-01",
      "status": "active",
      "annual_leave_days": 25
    },
    {
      "id": 6,
      "employee_id": "20240006",
      "first_name": "WONDWOSEN",
      "last_name": "TEFERA",
      "email": "wondwossentefera@gmail.com",
      "department": "Administration",
      "job_title": "Senior",
      "salary": 52040,
      "start_date": "2025-10-16",
      "phone": "0912654365",
      "status": "active",
      "annual_leave_days": 22
    }
  ],
  "users": {
    "admin@company.com": {
      "id": 100,
      "role": "admin",
      "password": "admin123"
    },
    "wondwossentefera@gmail.com": {
      "id": 6,
      "role": "admin",
      "password": "123456"
    }
  },
  "departments": [
    {
      "id": 1,
      "name": "Administration",
      "description": "System Administration"
    },
    {
      "id": 2,
      "name": "Human Resources",
      "description": "HR Department"
    },
    {
      "id": 3,
      "name": "Information Technology",
      "description": "IT Department"
    },
    {
      "id": 4,
      "name": "Finance",
      "description": "Finance Department"
    }
  ],
  "leaveRequests": [],
  "attendance": [],
  "notifications": []
};

function initializeDataFile() {
  try {
    // Check if data.json exists
    if (!fs.existsSync(dataFilePath)) {
      console.log('📝 data.json not found. Creating with default data...');
      fs.writeFileSync(dataFilePath, JSON.stringify(defaultData, null, 2));
      console.log('✅ data.json created successfully with default admin account');
      console.log('   Email: admin@company.com');
      console.log('   Password: admin123');
    } else {
      console.log('✅ data.json exists');
    }
  } catch (error) {
    console.error('❌ Error initializing data.json:', error);
    // Don't throw - let the server continue
  }
}

module.exports = { initializeDataFile };
