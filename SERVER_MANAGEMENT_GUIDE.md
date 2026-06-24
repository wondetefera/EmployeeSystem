# 🇪🇹 Ethiopian Payroll System - Complete Server Management Guide

## 🚀 Server Management Options

### **Option 1: Simple Background Start (Recommended)**
**File**: `START_SERVER_BACKGROUND.bat`
- **Usage**: Double-click to start
- **Features**: 
  - ✅ Starts server in background
  - ✅ Tests connection automatically
  - ✅ Opens browser optionally
  - ✅ Provides all access information
  - ✅ Keeps running after closing launcher

### **Option 2: Foreground Server**
**File**: `START_SERVER.bat`
- **Usage**: Double-click to start
- **Features**:
  - ✅ Shows server logs in real-time
  - ✅ Direct server output
  - ✅ Easy to stop (Ctrl+C)
  - ✅ Good for debugging

### **Option 3: Complete Server Manager**
**File**: `MANAGE_SERVER.bat`
- **Usage**: Double-click for management console
- **Features**:
  - ✅ Start/Stop/Restart server
  - ✅ Check server status
  - ✅ Open browser
  - ✅ Add firewall rules
  - ✅ Interactive menu system

### **Option 4: Windows Service (Advanced)**
**File**: `INSTALL_SERVICE.bat`
- **Usage**: Right-click → "Run as administrator"
- **Features**:
  - ✅ Installs as Windows Service
  - ✅ Starts automatically on boot
  - ✅ Runs in background always
  - ✅ Professional deployment option

### **Option 5: Stop Server**
**File**: `STOP_SERVER.bat`
- **Usage**: Double-click to stop all servers
- **Features**:
  - ✅ Stops background servers
  - ✅ Kills all related processes
  - ✅ Frees port 8080
  - ✅ Clean shutdown

---

## 📋 Quick Start Recommendations

### **For Daily Use:**
1. **Use**: `START_SERVER_BACKGROUND.bat`
2. **Access**: http://10.192.230.251:8080
3. **Login**: `abebe.kebede@company.com` / `admin123`
4. **Stop**: `STOP_SERVER.bat` when done

### **For Development/Testing:**
1. **Use**: `START_SERVER.bat` (shows logs)
2. **Monitor**: Real-time server output
3. **Stop**: Press Ctrl+C in server window

### **For Production Deployment:**
1. **Use**: `INSTALL_SERVICE.bat` (as Administrator)
2. **Result**: Automatic startup on boot
3. **Management**: Windows Services console

### **For Server Management:**
1. **Use**: `MANAGE_SERVER.bat`
2. **Features**: Complete control panel
3. **Options**: Start, stop, restart, status check

---

## 🔧 Server Architecture

### **Single Service Design:**
- **Backend**: Node.js server handles API requests
- **Frontend**: Same server serves HTML/CSS/JavaScript files
- **Database**: JSON file-based storage (data.json)
- **Port**: 8080 for both API and web interface

### **No Separate Web Server Needed:**
- Built-in HTTP server in Node.js
- Serves static files and API endpoints
- Single process handles everything
- Simplified deployment and management

---

## 🌐 Access Information

### **URLs:**
- **Local**: http://localhost:8080
- **Network**: http://10.192.230.251:8080
- **Login**: http://10.192.230.251:8080/login

### **Admin Credentials:**
- **Email**: `abebe.kebede@company.com`
- **Password**: `admin123`

---

## 🔧 Server Management Commands

### **Background Server Management:**
```batch
# Start server in background
START_SERVER_BACKGROUND.bat

# Stop all servers
STOP_SERVER.bat

# Complete management console
MANAGE_SERVER.bat
```

### **Windows Service Management:**
```batch
# Install as Windows Service (as Administrator)
INSTALL_SERVICE.bat

# Service commands (in Command Prompt as Administrator)
sc start EthiopianPayrollSystem
sc stop EthiopianPayrollSystem
sc delete EthiopianPayrollSystem
```

### **Manual Commands:**
```batch
# Start server manually
node simple-server.js

# Check if server is running
netstat -an | findstr :8080

# Kill server processes
taskkill /F /IM node.exe
```

---

## 🔧 Troubleshooting

### **If Server Won't Start:**
1. **Check Node.js**: Make sure Node.js is installed
2. **Check Port**: Ensure port 8080 is not in use
3. **Check Files**: Ensure `simple-server.js` exists
4. **Run as Admin**: Some operations require administrator privileges

### **If Network Access Fails:**
1. **Add Firewall Rule**: Use `MANAGE_SERVER.bat` option 8
2. **Check Network**: Ensure computers are on same network
3. **Test Connection**: Use `MANAGE_SERVER.bat` option 5

### **If Server Becomes Unresponsive:**
1. **Use Stop Script**: Run `STOP_SERVER.bat`
2. **Use Manager**: Use `MANAGE_SERVER.bat` option 4 (restart)
3. **Manual Kill**: Use Task Manager to end Node.js processes

---

## 📝 Usage Instructions

### **Starting the System (Background):**
1. **Double-click**: `START_SERVER_BACKGROUND.bat`
2. **Wait** for server to start (3-5 seconds)
3. **Choose** to open browser when prompted
4. **Login** with admin credentials

### **Managing the System:**
1. **Use**: `MANAGE_SERVER.bat` for complete control
2. **Options**: Start, stop, restart, status check
3. **Monitoring**: Check server status anytime
4. **Browser**: Open system directly from manager

### **Stopping the System:**
1. **Use**: `STOP_SERVER.bat` for clean shutdown
2. **Or**: Use `MANAGE_SERVER.bat` option 3
3. **Manual**: Close the "Ethiopian Payroll Server" window

**The Ethiopian Payroll System now has comprehensive server management with multiple deployment options!**