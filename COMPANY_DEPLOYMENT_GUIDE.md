# 🏢 Employee Management System - Company Deployment Guide

## 📋 Quick Overview
This guide provides the **simplest way** to deploy the Employee Management System in any company with **automatic startup** when the computer restarts.

## 🎯 What You Get
- ✅ **Automatic startup** when computer boots
- ✅ **Runs as Windows Service** (invisible to users)
- ✅ **Network accessible** to all company computers
- ✅ **Self-healing** - restarts if it crashes
- ✅ **Easy management** with simple batch files
- ✅ **Complete backup system**

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Prepare the Server Computer
**Requirements:**
- Windows 10/11 or Windows Server
- Node.js installed (download from nodejs.org)
- Administrator access
- Static IP address (recommended)

### Step 2: Copy System Files
1. Copy the entire Employee Management System folder to: `C:\EmployeeSystem\`
2. Ensure all files are present (HTML, JS, data.json, etc.)

### Step 3: Install as Windows Service
1. **Right-click** on `INSTALL_SERVICE.bat`
2. Select **"Run as Administrator"**
3. Wait for "Service installed successfully" message
4. The system will now **automatically start** when computer boots

### Step 4: Configure Network Access
1. **Right-click** on `Add-FirewallRule.ps1`
2. Select **"Run as Administrator"**
3. This opens the firewall for network access

### Step 5: Test the Installation
1. Open browser and go to: `http://localhost:8080`
2. From other computers: `http://[SERVER-IP]:8080`
3. Login with default credentials (see below)

---

## 🔧 MANAGEMENT COMMANDS

### Start/Stop/Restart Service
- **Start**: Run `START_SERVICE.bat` as Administrator
- **Stop**: Run `STOP_SERVICE.bat` as Administrator  
- **Restart**: Run `RESTART_SERVICE.bat` as Administrator
- **Status**: Run `CHECK_SERVICE.bat`

### View Logs
- **Service Logs**: Run `VIEW_LOGS.bat`
- **Error Logs**: Check `C:\EmployeeSystem\logs\`

### Backup Data
- **Manual Backup**: Run `BACKUP_DATA.bat`
- **Restore Backup**: Run `RESTORE_DATA.bat`

---

## 🌐 NETWORK ACCESS

### For Company Network:
1. **Find Server IP**: Run `ipconfig` on server computer
2. **Access URL**: `http://[SERVER-IP]:8080`
3. **Example**: `http://192.168.1.100:8080`

### Default Login Credentials:
- **Admin**: `admin@company.com` / `admin123`
- **Manager**: `manager@company.com` / `manager123`
- **Employee**: `employee@company.com` / `employee123`

---

## 🔒 SECURITY RECOMMENDATIONS

### Change Default Passwords:
1. Login as admin
2. Go to Profile → Change Password
3. Update all default accounts

### Network Security:
- Use company firewall rules
- Consider VPN for remote access
- Regular data backups

---

## 📞 TROUBLESHOOTING

### Service Won't Start:
1. Run `CHECK_SERVICE.bat`
2. Check `C:\EmployeeSystem\logs\error.log`
3. Restart computer
4. Run `REINSTALL_SERVICE.bat` as Administrator

### Network Access Issues:
1. Run `Test-NetworkAccess.ps1` as Administrator
2. Check Windows Firewall settings
3. Verify server IP address

### Data Issues:
1. Run `BACKUP_DATA.bat` first
2. Check `data.json` file permissions
3. Run `REPAIR_DATA.bat` if needed

---

## 📁 FILE STRUCTURE
```
C:\EmployeeSystem\
├── simple-server.js          # Main server
├── data.json                 # Employee data
├── config.json              # Server settings
├── *.html                   # Web pages
├── assets/                  # CSS, JS, images
├── logs/                    # System logs
├── backups/                 # Data backups
└── service/                 # Service files
```

---

## 🎯 COMPANY BENEFITS

### For IT Department:
- **Zero maintenance** after setup
- **Automatic backups**
- **Centralized management**
- **Easy troubleshooting**

### For HR Department:
- **Real-time attendance tracking**
- **Leave management**
- **Employee reports**
- **ID badge generation**

### For Employees:
- **Web-based access** (any browser)
- **Mobile-friendly interface**
- **Self-service leave requests**
- **Attendance history**

---

## 📋 DEPLOYMENT CHECKLIST

- [ ] Node.js installed on server
- [ ] System files copied to `C:\EmployeeSystem\`
- [ ] Service installed (`INSTALL_SERVICE.bat`)
- [ ] Firewall configured (`Add-FirewallRule.ps1`)
- [ ] Network access tested
- [ ] Default passwords changed
- [ ] Employee data imported
- [ ] Backup schedule configured
- [ ] Staff trained on system usage

---

## 🆘 SUPPORT

### Quick Fixes:
1. **Restart Service**: `RESTART_SERVICE.bat`
2. **Check Status**: `CHECK_SERVICE.bat`
3. **View Logs**: `VIEW_LOGS.bat`
4. **Backup Data**: `BACKUP_DATA.bat`

### Emergency Recovery:
1. Stop service: `STOP_SERVICE.bat`
2. Restore backup: `RESTORE_DATA.bat`
3. Start service: `START_SERVICE.bat`

---

**🎉 Congratulations! Your Employee Management System is now deployed and will automatically start whenever the computer restarts!**