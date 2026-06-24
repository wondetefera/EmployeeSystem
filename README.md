# 🇪🇹 Ethiopian Payroll & Employee Management System

A comprehensive web-based employee management system with attendance tracking, leave management, payroll processing, and reporting capabilities designed for Ethiopian businesses.

## Features

- **Employee Management**: Complete Ethiopian employee records with proper ID format
- **Attendance Tracking**: Morning/Afternoon session tracking with business rules
- **Leave Management**: Annual leave requests with approval workflow
- **Payroll System**: Ethiopian tax calculations and salary management
- **Role-based Access**: Admin, Manager, and Employee roles
- **Network Access**: Multi-computer access on local network
- **Offline Operation**: No external dependencies, all assets local

## 🚀 Quick Start

### **Step 1: Start the Server**
**Double-click**: `START_SERVER_BACKGROUND.bat`

### **Step 2: Access the System**
**Open browser to**: http://10.192.230.251:8080

### **Step 3: Login**
- **Admin**: `abebe.kebede@company.com` / `admin123`
- **Manager**: `almaz.tesfaye@company.com` / `123456`
- **Employee**: `dawit.haile@company.com` / `employee123`

## Server Management

### **Primary Options**
- **`START_SERVER_BACKGROUND.bat`** - Start server in background (recommended)
- **`MANAGE_SERVER.bat`** - Complete management console
- **`STOP_SERVER.bat`** - Stop server cleanly
- **`INSTALL_SERVICE.bat`** - Install as Windows Service

### **Manual Method**
```bash
node simple-server.js
```

## System Requirements

- Node.js 14.x or higher
- Windows operating system
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Network access for multi-computer use

## Essential Files

```
ethiopian-payroll-system/
├── simple-server.js              # Main server application
├── data.json                     # Employee and system data
├── config.json                   # Server configuration (port 8080)
├── START_SERVER_BACKGROUND.bat   # Primary server launcher
├── MANAGE_SERVER.bat             # Server management console
├── STOP_SERVER.bat               # Server shutdown
├── assets/                       # Local CSS, JS, fonts
└── *.html                        # Application pages
```

## Configuration

- **Server**: Edit `config.json` (currently set to port 8080, network accessible)
- **Data**: All data stored in `data.json` with automatic backups
- **Network**: Configured for http://10.192.230.251:8080

## Employee Data

The system includes 12 realistic Ethiopian employees:
- Proper Ethiopian names and ID format (ETH-001, etc.)
- Realistic salary ranges in Ethiopian Birr
- Complete department structure
- Role-based access control

## Troubleshooting

1. **Port 8080 in use**: Use `MANAGE_SERVER.bat` to check status and restart
2. **Network access issues**: Use `MANAGE_SERVER.bat` → Option 8 to add firewall rule
3. **Node.js not found**: Install from https://nodejs.org/
4. **Server issues**: Check server logs in the server window

## Access URLs

- **Network Access**: `http://10.192.230.251:8080`
- **Local Access**: `http://localhost:8080`
- **Login Page**: `http://10.192.230.251:8080/login`
- **Dashboard**: `http://10.192.230.251:8080/dashboard`
- **Attendance**: `http://10.192.230.251:8080/attendance`
- **Payroll**: `http://10.192.230.251:8080/payroll`

## License

MIT License