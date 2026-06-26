# MySQL Database Setup Guide

## Overview

This guide provides step-by-step instructions for setting up MySQL database for the Employee Management System in both local development and production (Render.com) environments.

## Table of Contents

1. [Local Development Setup](#local-development-setup)
2. [Production Setup (Render.com)](#production-setup-rendercom)
3. [Environment Variables Configuration](#environment-variables-configuration)
4. [Database Migration](#database-migration)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)
7. [Backup and Restore](#backup-and-restore)

---

## Local Development Setup

### Prerequisites

- Node.js 14.0.0 or higher
- MySQL 8.0 or higher

### Step 1: Install MySQL

#### Windows

1. Download MySQL Community Server from [MySQL Downloads](https://dev.mysql.com/downloads/mysql/)
2. Run the installer and choose "Developer Default"
3. Set root password during installation (remember this for later)
4. Complete the installation wizard

#### macOS

```bash
# Using Homebrew
brew install mysql

# Start MySQL service
brew services start mysql

# Secure installation
mysql_secure_installation
```

#### Linux (Ubuntu/Debian)

```bash
# Install MySQL
sudo apt update
sudo apt install mysql-server

# Start MySQL service
sudo systemctl start mysql
sudo systemctl enable mysql

# Secure installation
sudo mysql_secure_installation
```

#### Using Docker (All platforms)

```bash
# Run MySQL container
docker run --name mysql-dev \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=employee_system \
  -p 3306:3306 \
  -d mysql:8.0

# Verify container is running
docker ps
```

### Step 2: Create Database and User

Connect to MySQL:

```bash
# Using root user
mysql -u root -p
```

Execute the following SQL commands:

```sql
-- Create database
CREATE DATABASE employee_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create dedicated user (optional but recommended)
CREATE USER 'emp_system_user'@'localhost' IDENTIFIED BY 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON employee_system.* TO 'emp_system_user'@'localhost';

-- Flush privileges
FLUSH PRIVILEGES;

-- Verify database created
SHOW DATABASES;

-- Exit MySQL
EXIT;
```

### Step 3: Configure Environment Variables

1. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

2. Edit `.env` file with your database credentials:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=emp_system_user
DB_PASSWORD=your_secure_password
DB_NAME=employee_system
DB_PORT=3306

# Environment
NODE_ENV=development
```

**Note**: For Docker setup, use:
- `DB_USER=root`
- `DB_PASSWORD=root` (or whatever you set in docker run)

---

## Production Setup (Render.com)

### Step 1: Create MySQL Database on Render

1. Log in to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" button → Select "MySQL"
3. Configure database:
   - **Name**: `employee-system-db` (or your preferred name)
   - **Database**: `employee_system`
   - **User**: (auto-generated)
   - **Region**: Choose closest to your application
   - **Plan**: Select appropriate plan (Free tier available)
4. Click "Create Database"
5. Wait for database to be provisioned (takes 2-3 minutes)

### Step 2: Get Database Connection Details

After database is created, Render provides:
- **Internal Database URL** (for services on Render)
- **External Database URL** (for local testing)
- **Hostname**
- **Port**
- **Database Name**
- **Username**
- **Password**

### Step 3: Configure Environment Variables on Render

1. Go to your web service in Render Dashboard
2. Navigate to "Environment" tab
3. Add the following environment variables:

```
DB_HOST=<hostname from Render database>
DB_USER=<username from Render database>
DB_PASSWORD=<password from Render database>
DB_NAME=employee_system
DB_PORT=<port from Render database>
NODE_ENV=production
```

**Important**: You can also use the Internal Database URL format:
```
DATABASE_URL=mysql://<user>:<password>@<hostname>:<port>/employee_system
```

### Step 4: Update Application Configuration

If using `DATABASE_URL` instead of individual variables, update your database connection code to parse the URL:

```javascript
// Example parsing DATABASE_URL
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  const config = {
    host: url.hostname,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    port: url.port || 3306
  };
}
```

---

## Environment Variables Configuration

### Required Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | Database server hostname | `localhost` or `mysql-abc.render.com` | Yes |
| `DB_USER` | Database username | `root` or `emp_system_user` | Yes |
| `DB_PASSWORD` | Database password | `your_secure_password` | Yes |
| `DB_NAME` | Database name | `employee_system` | Yes |
| `DB_PORT` | Database port | `3306` | No (defaults to 3306) |
| `NODE_ENV` | Environment mode | `development` or `production` | No (defaults to development) |

### Environment-Specific Defaults

**Development** (`NODE_ENV=development`):
- Uses defaults for missing variables
- Connection failures allow server to continue running
- Detailed error logging
- DB_HOST defaults to `localhost`

**Production** (`NODE_ENV=production`):
- All variables are required
- Connection failures cause application to exit
- Sanitized error messages
- No defaults applied

---

## Database Migration

After configuring environment variables, migrate existing data from `data.json` to MySQL.

### Step 1: Run Migration Script

```bash
# Ensure database is created and environment variables are set
node migrate-to-mysql.js
```

The migration script will:
1. Create a timestamped backup of `data.json` in the `backups/` folder
2. Create all required database tables
3. Migrate data from `data.json` to MySQL tables
4. Validate migration completeness
5. Display migration summary

### Step 2: Review Migration Output

Expected output:
```
📦 Backing up data.json...
✅ Backup created: backups/data.json.backup.2025-01-15T10-30-00.json

🗄️  Creating database tables...
✅ All tables created successfully

📊 Migrating data...
✅ Migrated 45 employees
✅ Migrated 45 users
✅ Migrated 5 departments
✅ Migrated 1250 attendance records
✅ Migrated 78 leave requests
✅ Migrated 120 notifications
✅ Migrated 1 attendance policy

✅ Migration completed successfully!
```

### Migration Errors

If any records fail to migrate:
```
⚠️ Some records failed to migrate:
  - Employee ID 'EMP123': Invalid email format
  - Attendance record 456: Missing employee reference
```

Review failed records and correct issues in `data.json`, then re-run migration.

---

## Verification

### Verify Database Connection

```bash
# Test connection from application
node -e "require('dotenv').config(); const mysql = require('mysql2/promise'); const pool = mysql.createPool({host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME}); pool.query('SELECT 1').then(() => console.log('✅ Connected')).catch(err => console.error('❌ Error:', err));"
```

### Verify Tables Created

```sql
-- Connect to MySQL
mysql -u emp_system_user -p employee_system

-- List all tables
SHOW TABLES;

-- Expected output:
-- +---------------------------+
-- | Tables_in_employee_system |
-- +---------------------------+
-- | attendance_policy         |
-- | attendance_records        |
-- | departments               |
-- | employees                 |
-- | leave_requests            |
-- | notifications             |
-- | users                     |
-- +---------------------------+
```

### Verify Data Migrated

```sql
-- Check row counts
SELECT 'employees' AS table_name, COUNT(*) AS count FROM employees
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'departments', COUNT(*) FROM departments
UNION ALL
SELECT 'attendance_records', COUNT(*) FROM attendance_records
UNION ALL
SELECT 'leave_requests', COUNT(*) FROM leave_requests
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'attendance_policy', COUNT(*) FROM attendance_policy;
```

### Verify Sample Data

```sql
-- Check employee data structure
SELECT id, employee_id, email, first_name, last_name, department, status 
FROM employees 
LIMIT 5;

-- Verify relationships
SELECT e.employee_id, e.first_name, e.last_name, u.role 
FROM employees e 
LEFT JOIN users u ON e.email = u.email 
LIMIT 5;

-- Check for orphaned records (should return 0 rows)
SELECT COUNT(*) AS orphaned_attendance 
FROM attendance_records 
WHERE employee_id NOT IN (SELECT id FROM employees);

SELECT COUNT(*) AS orphaned_leave_requests 
FROM leave_requests 
WHERE employee_id NOT IN (SELECT id FROM employees);
```

### Test Application Endpoints

Start the server and test API endpoints:

```bash
# Start server
npm start

# Test login (should query database)
curl -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"admin123"}'

# Test get employees (should return database data)
curl http://localhost:8080/api/employees
```

---

## Troubleshooting

### Connection Refused Error

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:3306`

**Solutions**:
1. Verify MySQL is running:
   ```bash
   # Windows
   net start MySQL80
   
   # macOS/Linux
   sudo systemctl status mysql
   
   # Docker
   docker ps | grep mysql
   ```

2. Check port 3306 is listening:
   ```bash
   netstat -an | grep 3306
   ```

3. Verify firewall allows MySQL connections

### Authentication Failed

**Error**: `Error: Access denied for user 'root'@'localhost'`

**Solutions**:
1. Verify credentials in `.env` file
2. Reset MySQL password:
   ```bash
   mysql -u root
   ALTER USER 'root'@'localhost' IDENTIFIED BY 'new_password';
   FLUSH PRIVILEGES;
   ```

3. Check user exists and has permissions:
   ```sql
   SELECT user, host FROM mysql.user;
   SHOW GRANTS FOR 'emp_system_user'@'localhost';
   ```

### Database Does Not Exist

**Error**: `Error: Unknown database 'employee_system'`

**Solutions**:
1. Create database manually:
   ```sql
   CREATE DATABASE employee_system;
   ```

2. Verify database name in `.env` matches created database:
   ```sql
   SHOW DATABASES;
   ```

### Too Many Connections

**Error**: `Error: Too many connections`

**Solutions**:
1. Check current connections:
   ```sql
   SHOW STATUS LIKE 'Threads_connected';
   SHOW VARIABLES LIKE 'max_connections';
   ```

2. Increase max_connections (add to MySQL config):
   ```ini
   [mysqld]
   max_connections = 200
   ```

3. Review connection pool configuration in application

### Slow Queries

**Issue**: Database queries taking too long

**Solutions**:
1. Check indexes exist:
   ```sql
   SHOW INDEX FROM employees;
   SHOW INDEX FROM attendance_records;
   ```

2. Analyze slow queries:
   ```sql
   -- Enable slow query log
   SET GLOBAL slow_query_log = 'ON';
   SET GLOBAL long_query_time = 1;
   
   -- Check slow queries
   SELECT * FROM mysql.slow_log;
   ```

3. Run EXPLAIN on slow queries:
   ```sql
   EXPLAIN SELECT * FROM attendance_records WHERE employee_id = 123;
   ```

### Migration Failures

**Issue**: Migration script fails with foreign key errors

**Solutions**:
1. Ensure employees table is migrated before attendance_records and leave_requests
2. Verify all employee_id references exist in employees table
3. Temporarily disable foreign key checks:
   ```sql
   SET FOREIGN_KEY_CHECKS = 0;
   -- Run migration
   SET FOREIGN_KEY_CHECKS = 1;
   ```

---

## Backup and Restore

### Manual Backup

```bash
# Backup entire database
mysqldump -u emp_system_user -p employee_system > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup specific tables
mysqldump -u emp_system_user -p employee_system employees users > employees_backup.sql

# Backup with compression
mysqldump -u emp_system_user -p employee_system | gzip > backup.sql.gz
```

### Restore from Backup

```bash
# Restore entire database
mysql -u emp_system_user -p employee_system < backup_20250115_103000.sql

# Restore from compressed backup
gunzip < backup.sql.gz | mysql -u emp_system_user -p employee_system
```

### Automated Backup Script

Create a backup script (save as `backup-database.sh`):

```bash
#!/bin/bash
BACKUP_DIR="./database_backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

mysqldump -u emp_system_user -p$DB_PASSWORD employee_system \
  | gzip > $BACKUP_DIR/employee_system_$TIMESTAMP.sql.gz

# Keep only last 7 days of backups
find $BACKUP_DIR -type f -mtime +7 -delete

echo "✅ Backup completed: employee_system_$TIMESTAMP.sql.gz"
```

### Render.com Automatic Backups

Render provides automatic daily backups for paid MySQL plans:
- Backups retained for 7 days (Standard plan)
- Restore via Render Dashboard → Database → Backups tab

---

## Additional Resources

- [MySQL 8.0 Documentation](https://dev.mysql.com/doc/refman/8.0/en/)
- [mysql2 Node.js Driver](https://github.com/sidorares/node-mysql2)
- [Render MySQL Documentation](https://render.com/docs/databases)

## Security Best Practices

1. **Never commit `.env` file** - Keep credentials out of version control
2. **Use strong passwords** - Minimum 16 characters with mixed case, numbers, symbols
3. **Limit database user privileges** - Grant only necessary permissions
4. **Enable SSL/TLS** - Use encrypted connections in production
5. **Regular backups** - Automate daily backups with retention policy
6. **Monitor logs** - Watch for suspicious connection attempts
7. **Update regularly** - Keep MySQL and dependencies up to date

---

## Next Steps

After completing database setup:

1. ✅ Install mysql2 package (`npm install mysql2`)
2. ✅ Configure environment variables in `.env`
3. ✅ Verify database connection
4. ⏭️ Run migration script to import data from `data.json`
5. ⏭️ Update application code to use MySQL instead of file-based storage
6. ⏭️ Test all CRUD operations
7. ⏭️ Deploy to production

---

**For questions or issues, refer to the troubleshooting section or contact the development team.**
