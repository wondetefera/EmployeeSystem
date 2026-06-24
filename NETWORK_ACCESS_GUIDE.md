# 🌐 Ethiopian Payroll System - Network Access Guide

## 🚀 Server Status: ONLINE & NETWORK ACCESSIBLE

### 📍 Network Information
- **Server IP Address**: `10.192.230.251`
- **Port**: `8080`
- **Network**: `10.192.230.0/24` (255.255.255.0)
- **External Access**: ✅ ENABLED

---

## 🔗 Access URLs for Other Computers

### Main Application
```
http://10.192.230.251:8080
```

### Direct Access Links
- **Dashboard**: http://10.192.230.251:8080/dashboard
- **Ethiopian Payroll System**: http://10.192.230.251:8080/payroll.html
- **Employee Management**: http://10.192.230.251:8080/employees
- **Attendance System**: http://10.192.230.251:8080/attendance
- **Leave Management**: http://10.192.230.251:8080/leave
- **Reports**: http://10.192.230.251:8080/reports

---

## 🔐 Login Credentials

### Ethiopian Employees (Use these for authentic experience)
- **Admin (General Manager)**: 
  - Email: `abebe.kebede@company.com`
  - Password: `admin123`
  - Access: Full system access including payroll

- **Manager (HR Manager)**: 
  - Email: `almaz.tesfaye@company.com`
  - Password: `manager123`
  - Access: Employee management and payroll

- **Employee (Software Developer)**: 
  - Email: `dawit.haile@company.com`
  - Password: `employee123`
  - Access: Personal attendance and leave requests

---

## 🖥️ How Other Computers Can Access

### Step 1: Check Network Connection
Other computers must be on the same network (`10.192.230.x`) or have network access to this subnet.

### Step 2: Open Web Browser
On any computer on the network, open a web browser (Chrome, Firefox, Edge, Safari)

### Step 3: Enter URL
Type: `http://10.192.230.251:8080`

### Step 4: Login
Use any of the credentials above based on the role needed.

---

## 🔧 Troubleshooting Network Access

### If Other Computers Can't Access:

1. **Check Network Connectivity**
   ```bash
   ping 10.192.230.251
   ```

2. **Test Port Connectivity** (from another computer)
   ```bash
   telnet 10.192.230.251 8080
   ```

3. **Windows Firewall** (if needed, run as Administrator)
   ```powershell
   New-NetFirewallRule -DisplayName "Ethiopian Payroll System" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
   ```

4. **Check Server Status**
   - Server should show: "External Access: Enabled"
   - Look for any error messages in server console

---

## 📱 Mobile Access
The system is responsive and works on mobile devices:
- **Smartphones**: Use mobile browser with same URL
- **Tablets**: Full functionality available
- **Touch Interface**: Optimized for touch interactions

---

## 🏢 Office Network Setup

### For Multiple Departments:
- **Management**: Use admin account for full payroll access
- **HR Department**: Use manager account for employee management
- **Employees**: Each can use their individual accounts
- **Accounting**: Use admin account for payroll reports and exports

### Network Requirements:
- **Bandwidth**: Minimal (text-based system)
- **Concurrent Users**: Supports multiple simultaneous users
- **Data Storage**: Local server (no internet required)

---

## 🔒 Security Features

- ✅ **Role-based Access Control**: Different permissions for admin/manager/employee
- ✅ **Session Management**: Secure login sessions
- ✅ **Data Validation**: Input validation and sanitization
- ✅ **Local Network Only**: No external internet exposure
- ✅ **Ethiopian Compliance**: Follows local labor and tax laws

---

## 📊 System Features Available Over Network

### For Administrators:
- Complete payroll processing with Ethiopian tax calculations
- Employee management (add, edit, remove)
- Attendance tracking and overtime calculations
- Leave request approvals
- Comprehensive reporting and exports
- System configuration and backups

### For Managers:
- Employee oversight and management
- Payroll review and processing
- Attendance monitoring
- Leave request handling
- Department reports

### For Employees:
- Personal attendance check-in/out
- Leave request submissions
- Personal profile management
- Attendance history viewing

---

## 🎯 Quick Start for Network Users

1. **Connect to Network**: Ensure computer is on `10.192.230.x` network
2. **Open Browser**: Any modern web browser
3. **Navigate**: Go to `http://10.192.230.251:8080`
4. **Login**: Use appropriate credentials for your role
5. **Access Payroll**: Click "🇪🇹 Payroll System" from dashboard or sidebar

---

## 📞 Support Information

- **Server Location**: This computer (10.192.230.251)
- **System Status**: Check server console for real-time status
- **Data Backup**: Available through admin interface
- **Updates**: System runs locally, no external updates needed

---

**🇪🇹 Ethiopian Payroll System - Serving Your Network Since 2024**  
*Compliant with Ethiopian Labor Law and Tax Regulations*