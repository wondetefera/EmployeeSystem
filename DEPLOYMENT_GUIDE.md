# 🚀 Deployment Guide: GitHub + Render

## Database Information
**Database Type:** MySQL (persistent cloud database)  
**Production Requirement:** MySQL database via Render.com MySQL add-on ensures data persistence across container restarts. See [Database Setup](#step-0-database-setup) for configuration instructions.

---

## Step 0: Database Setup

### 📚 Comprehensive Database Documentation
For detailed MySQL setup, configuration, and troubleshooting, please refer to:
- **[database-setup.md](./database-setup.md)** - Complete setup guide for local development and production

### Quick Database Summary

**Development (Local):**
- MySQL running on `localhost:3306`
- Database: `employee_system`
- User: `emp_system_user` or `root`

**Production (Render.com):**
- MySQL database provisioned via Render add-on
- Automatic daily backups (Standard plan)
- External connection URL for local testing

### Database Configuration Checklist

Before proceeding to Step 1 (GitHub), ensure:

- [ ] MySQL installed and running locally
- [ ] Database `employee_system` created
- [ ] Database user configured with appropriate permissions
- [ ] `.env` file updated with database credentials (see .env.example)
- [ ] Connection verified successfully
- [ ] Data migrated from `data.json` to MySQL using `node migrate-to-mysql.js`

**Important:** The migration script will:
1. Create database tables automatically (schema initialization)
2. Backup `data.json` with timestamp
3. Migrate all existing employee, attendance, and leave data
4. Validate migration completeness

### Initial Database Setup Steps

1. **Create Database** (if using manual setup):
   ```bash
   mysql -u root -p
   ```
   
   ```sql
   CREATE DATABASE employee_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'emp_system_user'@'localhost' IDENTIFIED BY 'your_secure_password';
   GRANT ALL PRIVILEGES ON employee_system.* TO 'emp_system_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

2. **Configure Environment Variables** (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your database credentials:
   ```env
   DB_HOST=localhost
   DB_USER=emp_system_user
   DB_PASSWORD=your_secure_password
   DB_NAME=employee_system
   DB_PORT=3306
   NODE_ENV=development
   ```

3. **Run Migration Script**:
   ```bash
   npm install mysql2  # If not already installed
   node migrate-to-mysql.js
   ```

4. **Verify Migration**:
   ```bash
   npm start
   # Test login and CRUD operations
   ```

---

## 📋 Pre-Deployment Checklist

### ✅ What's Already Done:
- ✅ `.gitignore` configured (node_modules, .env excluded)
- ✅ `package.json` with start script
- ✅ Email functionality configured
- ✅ Environment variables ready
- ✅ Database schema configured (MySQL)
- ✅ Migration script prepared (migrate-to-mysql.js)

### ⚠️ Before You Deploy:

1. **Database Setup** - Complete Step 0 database configuration
2. **Test locally** - Make sure everything works on localhost:8080 with MySQL
3. **Run migration** - Execute `node migrate-to-mysql.js` to move data from data.json to MySQL
4. **Verify migration** - Confirm all records migrated successfully
5. **Remove sensitive data** from configuration if needed (test users, passwords)

---

## Step 1: Push to GitHub

### 1.1 Initialize Git (if not done):
```bash
cd c:\EmployeeSystem
git init
git add .
git commit -m "Initial commit - Employee Management System"
```

### 1.2 Create GitHub Repository:
1. Go to: https://github.com/new
2. Repository name: `employee-management-system`
3. Description: "Employee Management System with Attendance & Leave Management"
4. **Keep it Private** (recommended for business systems)
5. Click **"Create repository"**

### 1.3 Push to GitHub:
```bash
git remote add origin https://github.com/YOUR-USERNAME/employee-management-system.git
git branch -M main
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username.

---

## Step 2: Deploy on Render

### 2.0 Create MySQL Database on Render (FIRST)

**⚠️ Important:** Set up the MySQL database before creating the web service.

1. Log in to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → Select **"MySQL"** (under "Database")
3. Configure the MySQL database:
   - **Name**: `employee-system-db`
   - **Database**: `employee_system`
   - **Region**: Choose same region as web service for best performance
   - **Plan**: Select appropriate plan (Free or Standard)
4. Click **"Create Database"**
5. Wait for database to be provisioned (takes 2-3 minutes)
6. **Note:** Copy the connection details (hostname, port, username, password)

### 2.1 Create Render Account:
1. Go to: https://render.com
2. Sign up with GitHub (easiest)
3. Authorize Render to access your repositories

### 2.2 Create New Web Service:
1. Click **"New +"** → **"Web Service"**
2. Connect your repository: `employee-management-system`
3. Configure the service:

**Settings:**
```
Name: employee-management-system
Region: Choose closest to your users (SAME as MySQL database region)
Branch: main
Root Directory: (leave blank)
Environment: Node
Build Command: npm install
Start Command: node simple-server.js
Instance Type: Free (or Starter $7/month for better performance)
```

### 2.3 Add Environment Variables:
Click **"Advanced"** → **"Add Environment Variable"**

Add these variables:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `DB_HOST` | Database hostname from Render MySQL dashboard |
| `DB_USER` | Database username from Render MySQL dashboard |
| `DB_PASSWORD` | Database password from Render MySQL dashboard |
| `DB_NAME` | `employee_system` |
| `DB_PORT` | Database port from Render MySQL dashboard (usually 3306) |
| `EMAIL_USER` | `wondwossentefera@gmail.com` |
| `EMAIL_PASS` | `foga rlxx ystg vxsl` |

**How to get database connection details:**
1. Go to Render Dashboard → Select your MySQL database
2. Copy credentials from "Connections" section
3. Internal connection details are available for Render services
4. External connection details work from local machine

### 2.4 Deploy:
1. Click **"Create Web Service"**
2. Wait 3-5 minutes for deployment
3. Render will give you a URL like: `https://employee-management-system-xxxx.onrender.com`

### 2.5 Run Initial Database Setup on Render

After successful deployment, the application will:
1. Check for database tables on startup
2. Automatically create tables if they don't exist (schema initialization)
3. Connect using environment variables you configured

**Important:** The migration script (`migrate-to-mysql.js`) is for local development to transfer data from `data.json` to MySQL. For production, data has already been migrated locally before deployment.

---

## Step 3: Post-Deployment Setup

### 3.1 Verify Database Connection:
1. Go to Render Dashboard → Select your web service
2. Click **"Logs"** tab
3. Look for messages like: `✅ Database connected successfully`
4. Check for any connection errors

### 3.2 Test Your Live Site:
1. Open your Render URL
2. Try to login (validates database read operation)
3. Test attendance check-in (validates database write operation)
4. Test attendance check-out (validates database UPSERT operation)
5. Test email notification

### 3.3 Default Login:
Check your migrated database for default users. Common setup:
```
Email: admin@company.com
Password: admin123
```

**⚠️ IMPORTANT:** Change default passwords immediately after deployment!

### 3.4 Data Persistence:
✅ **Render MySQL Plan**: Data persists across restarts
- All employee, attendance, and leave data stored in MySQL
- Daily automatic backups (Standard plan and above)
- No data loss on container restart
- Upgrade to paid plan for enhanced backup retention

---

## Step 4: Configure Custom Domain (Optional)

### 4.1 Get a Domain:
- Buy from: Namecheap, GoDaddy, or Google Domains
- Cost: $10-15/year

### 4.2 Add to Render:
1. Go to your Web Service on Render
2. Click **"Settings"** → **"Custom Domain"**
3. Add your domain: `yourdomain.com`
4. Follow Render's DNS instructions

---

## Step 5: Enable HTTPS (Automatic)

Render provides free SSL certificates automatically! Your site will be:
- ✅ `https://your-app.onrender.com` (automatic)
- ✅ `https://yourdomain.com` (if you added custom domain)

---

## 🔒 Security Checklist

Before going live for customers:

- [ ] Change all default passwords in data.json
- [ ] Remove test/dummy data
- [ ] Set strong admin passwords
- [ ] Enable 2FA on your GitHub account
- [ ] Keep your Render account secure
- [ ] Never commit .env file to GitHub (already in .gitignore)
- [ ] Review user permissions (admin/manager/employee roles)
- [ ] Test all features on production URL

---

## 📊 Monitoring & Maintenance

### Check Server Logs:
1. Go to Render Dashboard
2. Select your web service
3. Click **"Logs"** tab
4. Monitor for errors

### Update Your App:
```bash
# Make changes locally
git add .
git commit -m "Update: [description]"
git push origin main
```
Render will automatically redeploy!

---

## 🆘 Troubleshooting

### Database Connection Issues

**"Database connection failed" error on Render:**
- Verify all database environment variables are set correctly:
  - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`
- Check that MySQL database status is "Available" in Render Dashboard
- Ensure web service region matches MySQL database region when possible
- Verify MySQL credentials copied from Render database page are exactly correct
- For detailed troubleshooting, see [database-setup.md - Troubleshooting](./database-setup.md#troubleshooting)

**"Connection refused" error locally:**
- Ensure MySQL service is running: `sudo systemctl status mysql` (Linux) or check Services (Windows)
- Verify `.env` file has correct database host (typically `localhost`)
- Check database port 3306 is accessible
- Verify database user and password in `.env` match MySQL configuration

**Slow database queries:**
- Check MySQL database metrics in Render Dashboard
- Monitor connection pool usage
- May indicate need to upgrade database plan
- See [database-setup.md - Troubleshooting](./database-setup.md#troubleshooting) for optimization tips

**"Application Error" on Render:**
- Check Render logs for database-related errors
- Verify environment variables are set and correct
- Check MySQL database is in "Available" status
- Ensure `simple-server.js` exists and starts without errors
- Check if port binding is correct (uses `process.env.PORT`)

### Data-Related Issues

**Missing data after deployment:**
- Verify migration script (`node migrate-to-mysql.js`) was run before pushing to GitHub
- Check that `data.json` was not modified after migration
- Verify all records are in MySQL tables:
  ```sql
  SELECT COUNT(*) FROM employees;
  SELECT COUNT(*) FROM users;
  SELECT COUNT(*) FROM attendance_records;
  SELECT COUNT(*) FROM leave_requests;
  ```

**Duplicate records after migration:**
- Re-running migration script multiple times can create duplicates
- Only run migration script once per `data.json` source
- If duplicates exist, backup is available in `backups/` folder
- Contact database administrator for recovery assistance

### Email Issues

**Email Not Sending:**
- Verify `EMAIL_USER` and `EMAIL_PASS` in Render environment variables
- Check Gmail app password is correct (16 characters with spaces removed)
- Look for SMTP errors in Render logs
- Ensure "Less secure app access" is allowed if using Gmail

### Other Issues

**Can't Login:**
- Verify user account exists in database: `SELECT * FROM users;`
- Check password is correct (passwords are hashed, can't be viewed)
- Clear browser cache and cookies
- Test with a known valid user from migrated data

**Attachment/Photo Upload Issues:**
- Check database column `photo` is TEXT type (stores base64)
- Verify sufficient disk space on MySQL server
- Check file size limits in application configuration

---

## 💰 Cost Summary

### Free Option:
- GitHub: Free (private repos included)
- Render Free Tier (Web): $0/month
- Render Free Tier (MySQL): $0/month
  - ✅ Free web hosting
  - ✅ Free MySQL database (limited resources)
  - ✅ Auto-deploy from GitHub
  - ✅ HTTPS included
  - ✅ Data persists across restarts
  - ⚠️ Limited database storage (512MB)
  - ⚠️ No backup retention

### Recommended Production Setup:
- Render Web Service: **$7+/month** (Starter plan)
  - ✅ Better performance
  - ✅ No sleep/downtime
  - ✅ Persistent disk
  - ✅ Priority support

- Render MySQL: **$15+/month** (Standard plan)
  - ✅ Persistent data with daily backups
  - ✅ 7-day backup retention
  - ✅ Higher database limits
  - ✅ Better performance
  - ✅ Professional support

**Total Recommended:** ~$22/month

### Optional Additions:
- Custom Domain: ~$12/year
- Additional backups/monitoring: Varies

---

## 🎯 Quick Commands Reference

```bash
# Database setup
mysql -u root -p                           # Connect to MySQL
node migrate-to-mysql.js                   # Migrate data from data.json to MySQL

# Local development
npm install                                # Install dependencies
npm start                                  # Start server locally
node simple-server.js                      # Alternative start

# Git commands
git status                                 # Check changes
git add .                                  # Stage all changes
git commit -m "message"                    # Commit changes
git push                                   # Push to GitHub (triggers Render deploy)

# View logs
git log --oneline                          # See commit history
# On Render: Dashboard → Web Service → Logs tab
```

---

## 📞 Support Resources

- **Render Docs:** https://render.com/docs
- **Render Status:** https://status.render.com
- **GitHub Docs:** https://docs.github.com
- **Node.js Docs:** https://nodejs.org/docs

---

## ✅ Post-Deployment Checklist

After deployment, verify:

- [ ] Database connection established (check logs for ✅ message)
- [ ] Site loads at Render URL
- [ ] Login works (tests database read)
- [ ] Dashboard displays correctly
- [ ] Attendance tracking works (tests database write)
- [ ] Leave requests work (tests database transactions)
- [ ] Email notifications work
- [ ] All pages accessible
- [ ] Mobile responsive
- [ ] HTTPS enabled (green padlock)
- [ ] No console errors in browser
- [ ] No database errors in Render logs
- [ ] Data persists after server restart

---

## 🚀 You're Ready!

Your Employee Management System is now live and accessible to customers worldwide!

**Your Production URL:** `https://your-app-name.onrender.com`

Share this URL with your team and customers. Make sure to:
1. Update documentation with production URL
2. Train users on the system
3. Set up regular data backups
4. Monitor Render logs for issues

**Good luck with your deployment!** 🎉
