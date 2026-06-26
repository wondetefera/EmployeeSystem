# 👥 Employee Management System

A complete, production-ready Employee Management System with Attendance Tracking, Leave Management, Payroll, and Email Notifications.

[![Node.js](https://img.shields.io/badge/Node.js-14+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## 🌟 Features

### Core Features
- ✅ **Employee Management** - Add, edit, view employee records
- ✅ **Attendance Tracking** - Check-in/out with time validation
- ✅ **Leave Management** - Request, approve/reject leave
- ✅ **Department Management** - Organize by departments
- ✅ **User Roles** - Admin, Manager, Employee permissions
- ✅ **ID Badge Generator** - Print employee ID cards
- ✅ **Payroll System** - Ethiopian tax-compliant salary calculation
- ✅ **Reports & Analytics** - Attendance, leave, employee reports
- ✅ **Email Notifications** - Daily reports via email

### Technical Features
- 📱 **Responsive Design** - Works on desktop, tablet, mobile
- 🔒 **Session-based Authentication** - Secure login system
- 📊 **File-based Database** - Simple data.json storage
- 🎨 **Dark Theme UI** - Modern, professional interface
- 📧 **Email Integration** - Nodemailer with Gmail
- ⏰ **Real-time Clock** - Display current time
- 🔔 **Notification System** - In-app notifications
- 📥 **Data Export** - JSON and Excel backup

## 🖥️ Screenshots

### Dashboard
![Dashboard](docs/dashboard-screenshot.png)

### Attendance Tracking
![Attendance](docs/attendance-screenshot.png)

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ installed
- Gmail account (for email notifications)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR-USERNAME/employee-management-system.git
cd employee-management-system

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your Gmail credentials

# Start the server
npm start
```

Open http://localhost:8080 in your browser.

### Default Login
```
Email: admin@company.com
Password: admin123
```
⚠️ **Change default passwords immediately!**

## 📦 Database

This system uses **data.json** as a file-based database. No external database required!

- All data stored in `data.json`
- Simple JSON format
- Easy backup and restore
- Perfect for small to medium teams

## 🌐 Deployment

### Deploy to Render (Free)

1. Push to GitHub
2. Connect to Render
3. Add environment variables
4. Deploy!

**Full guide:** See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)  
**Quick guide:** See [QUICK_DEPLOY.md](QUICK_DEPLOY.md)

## 📧 Email Setup

1. Get Gmail App Password: https://myaccount.google.com/apppasswords
2. Add to `.env`:
```
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```
3. Test by clicking "Send Daily Report" on dashboard

**Full guide:** See [EMAIL_SETUP_INSTRUCTIONS.md](EMAIL_SETUP_INSTRUCTIONS.md)

## 📁 Project Structure

```
employee-management-system/
├── simple-server.js          # Main server file
├── data.json                 # Database file
├── config.json               # Server configuration
├── package.json              # Dependencies
├── .env                      # Environment variables (not in git)
├── assets/                   # CSS, JS, images
│   ├── css/
│   ├── js/
│   └── webfonts/
├── *.html                    # Frontend pages
├── docs/                     # Documentation
└── backups/                  # Data backups
```

## 🛠️ Configuration

### Server Configuration (config.json)
```json
{
  "server": {
    "host": "localhost",
    "port": 8080,
    "allowExternalConnections": false
  }
}
```

### Email Configuration (.env)
```
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

## 👥 User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access - manage employees, departments, view all data, configure system |
| **Manager** | View reports, approve leave requests, view attendance |
| **Employee** | Check-in/out, request leave, view own records |

## 📊 Features Breakdown

### Attendance System
- Morning & afternoon sessions
- Time-based validation (8 AM - 12 PM, 1 PM - 5 PM)
- Total hours calculation
- Attendance history
- Policy management

### Leave Management
- Annual, sick, casual, maternity/paternity leave
- Leave balance tracking
- Approval workflow
- Leave history

### Payroll System
- Ethiopian tax calculation
- Gross salary, deductions, net pay
- Pension contribution (11%)
- Income tax (progressive rates)
- Monthly payroll summary

### Reports
- Attendance report
- Leave report
- Employee report
- Department report
- Export to Excel/JSON

## 🔒 Security

- ✅ Session-based authentication
- ✅ Role-based access control
- ✅ Environment variables for secrets
- ✅ Input validation
- ✅ HTTPS ready
- ✅ CORS configured
- ⚠️ Change default passwords
- ⚠️ Keep .env out of version control

## 🐛 Troubleshooting

### Server won't start
```bash
# Check if port 8080 is in use
netstat -ano | findstr :8080
# Kill the process using the port
taskkill /PID <process_id> /F
```

### Can't login
- Check data.json has valid user accounts
- Verify email/password match
- Clear browser cache

### Email not sending
- Verify .env has correct EMAIL_USER and EMAIL_PASS
- Use Gmail App Password (not regular password)
- Check server logs for SMTP errors

## 📝 License

MIT License - see [LICENSE](LICENSE) file

## 👨‍💻 Author

**Wondwosen Tefera**

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

- Create an issue on GitHub
- Check [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for deployment help
- See [EMAIL_SETUP_INSTRUCTIONS.md](EMAIL_SETUP_INSTRUCTIONS.md) for email setup

## 🗺️ Roadmap

- [ ] Add MongoDB support
- [ ] Real-time notifications with WebSockets
- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Biometric attendance (fingerprint)
- [ ] Performance reviews module
- [ ] Training & development tracking

## ⭐ Star this repo if you find it useful!

---

**Made with ❤️ by Wondwosen Tefera**
