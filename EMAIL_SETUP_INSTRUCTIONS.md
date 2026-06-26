# 📧 Email Notification Setup Instructions

## What Was Added

✅ **nodemailer** and **node-cron** packages installed  
✅ Email sending functionality in `simple-server.js`  
✅ API endpoint `/api/send-report` to trigger email  
✅ "Send Daily Report" button added to dashboard  

---

## Step 1: Get Gmail App Password

1. Go to your Google Account: https://myaccount.google.com/
2. Click **Security** (left sidebar)
3. Under "Signing in to Google", click **2-Step Verification** (you must enable this first if not already)
4. Scroll down and click **App passwords**
5. Select:
   - **App**: Mail
   - **Device**: Other (Custom name) - type "Employee System"
6. Click **Generate**
7. **Copy the 16-character password** (you'll use this as `EMAIL_PASS`)

---

## Step 2: Configure Environment Variables

### **For Local Development:**

Create a `.env` file in `c:\EmployeeSystem\` (if you don't have one):

```
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-character-app-password
```

Then add this to the top of `simple-server.js` (after the requires):
```javascript
require('dotenv').config();
```

And install dotenv:
```bash
npm install dotenv
```

### **For Render (Production):**

1. Go to your Render Dashboard: https://dashboard.render.com/
2. Click on your Web Service
3. Click **Environment** tab (left sidebar)
4. Add these two variables:
   - **Key**: `EMAIL_USER` | **Value**: `your-email@gmail.com`
   - **Key**: `EMAIL_PASS` | **Value**: `your-16-character-app-password`
5. Click **Save Changes**
6. Render will automatically restart your server

---

## Step 3: Test the Email Notification

### **Method 1: Using the Dashboard Button** (Easiest)

1. Open your Employee Management System
2. Login as any user
3. Go to **Dashboard**
4. Scroll down to the **Payroll System** section
5. Click the **"Send Daily Report"** button
6. You should see a success message and receive an email!

### **Method 2: Using Browser Console**

1. Open your dashboard
2. Press **F12** (or Right-click → Inspect)
3. Go to **Console** tab
4. Paste this code:

```javascript
fetch('/api/send-report', { method: 'POST' })
  .then(res => res.json())
  .then(data => console.log(data));
```

4. Press **Enter**
5. Check your email inbox!

---

## What Gets Sent?

The email includes:
- **Subject**: "Daily Attendance Report - YYYY-MM-DD"
- **Content**:
  - Total employees
  - Employees present today
  - Employees absent
  - Recent attendance records (top 5)
  - Hours worked per employee

---

## Troubleshooting

### ❌ "Email configuration missing"
- Make sure `EMAIL_USER` and `EMAIL_PASS` are set in environment variables
- For local: use `.env` file + `dotenv` package
- For Render: add in Environment tab

### ❌ "Invalid login"
- Make sure you're using an **App Password**, not your regular Gmail password
- The app password should be 16 characters (spaces are optional)

### ❌ "Failed to send email"
- Check your Gmail settings allow "Less secure app access" (usually not needed with app passwords)
- Try generating a new app password
- Check server logs for detailed error messages

---

## Future Enhancements

Want to add more features? You can:

1. **Schedule automatic daily emails** using the `node-cron` package (already installed!)
2. **Add analytics tracking** (track page visits, interactions)
3. **Send emails to multiple recipients** (admins only)
4. **Customize email templates** with HTML/CSS

Check the `.kiro/specs/daily-analytics-notifications/` folder for the full spec!

---

## Testing Checklist

- [ ] Environment variables set (EMAIL_USER, EMAIL_PASS)
- [ ] Server restarted after adding variables
- [ ] Dashboard loads successfully
- [ ] "Send Daily Report" button visible
- [ ] Clicking button shows loading state
- [ ] Email received in inbox
- [ ] Email content looks correct

---

**Need Help?** Check server logs with: `console.log` output in terminal

**Questions?** The email functionality is in `simple-server.js` starting around line 28.
