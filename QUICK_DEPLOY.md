# ⚡ Quick Deploy - 5 Minutes

Follow these exact steps to deploy your system:

## 🔑 Your Database
**You're using `data.json`** - a simple file-based database. No MongoDB, PostgreSQL, or other database needed!

---

## Step 1: Push to GitHub (2 minutes)

```bash
# Navigate to your project
cd c:\EmployeeSystem

# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit: Employee Management System"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR-USERNAME/employee-management-system.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy on Render (3 minutes)

1. **Go to:** https://render.com
2. **Sign up** with GitHub
3. Click **"New +"** → **"Web Service"**
4. **Connect:** your `employee-management-system` repo
5. **Fill in:**
   - Name: `employee-management-system`
   - Build Command: `npm install`
   - Start Command: `node simple-server.js`
6. **Add Environment Variables:**
   - `EMAIL_USER` = `wondwossentefera@gmail.com`
   - `EMAIL_PASS` = `foga rlxx ystg vxsl`
7. Click **"Create Web Service"**
8. **Wait 3-5 minutes** for deployment

---

## Step 3: Test Your Live Site

Your URL: `https://employee-management-system-xxxx.onrender.com`

1. Open the URL
2. Login with your credentials from data.json
3. Test the system
4. Test email notification!

---

## ⚠️ Important Notes:

### Render Free Tier Limitations:
- **Data resets** on server restart (data.json lost)
- Server **sleeps** after 15 min inactivity
- **Solution:** Upgrade to $7/month for:
  - ✅ Persistent disk (data saved)
  - ✅ No sleep
  - ✅ Better performance

### Security:
- ✅ `.env` is in `.gitignore` (safe)
- ✅ Email password not in GitHub
- ⚠️ Change default passwords after deployment
- ⚠️ Remove test data from data.json

---

## 🎯 That's It!

Your system is now live at: `https://your-app-name.onrender.com`

For detailed instructions, see `DEPLOYMENT_GUIDE.md`
