# 🚀 Deployment Guide: GitHub + Render

## Database Information
**Database Type:** File-based (data.json)  
**No external database required!** Your system uses `data.json` as a simple JSON database. All employee, attendance, and leave data is stored in this file.

---

## 📋 Pre-Deployment Checklist

### ✅ What's Already Done:
- ✅ `.gitignore` configured (node_modules, .env excluded)
- ✅ `package.json` with start script
- ✅ Email functionality configured
- ✅ Environment variables ready

### ⚠️ Before You Deploy:

1. **Test locally** - Make sure everything works on localhost:8080
2. **Backup data.json** - Copy it somewhere safe
3. **Remove sensitive data** from data.json if needed (test users, passwords)

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
Region: Choose closest to your users
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
| `EMAIL_USER` | `wondwossentefera@gmail.com` |
| `EMAIL_PASS` | `foga rlxx ystg vxsl` |

### 2.4 Deploy:
1. Click **"Create Web Service"**
2. Wait 3-5 minutes for deployment
3. Render will give you a URL like: `https://employee-management-system-xxxx.onrender.com`

---

## Step 3: Post-Deployment Setup

### 3.1 Test Your Live Site:
1. Open your Render URL
2. Try to login
3. Test attendance check-in
4. Test email notification

### 3.2 Default Login:
Check your `data.json` file for default users. Common setup:
```
Email: admin@company.com
Password: admin123
```

**⚠️ IMPORTANT:** Change default passwords immediately after deployment!

### 3.3 Data Persistence:
**Note:** Render's free tier resets the filesystem on restart. This means:
- ✅ Your code persists
- ❌ `data.json` resets to initial state on server restart

**Solutions:**
1. **Upgrade to Paid Plan** ($7/month) - includes persistent disk
2. **Use a real database** - MongoDB Atlas (free tier available)
3. **Backup regularly** - Download data.json daily

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

### "Application Error" on Render:
- Check Render logs for errors
- Verify environment variables are set
- Ensure `simple-server.js` exists
- Check if port binding is correct (uses `process.env.PORT`)

### Data Lost After Restart:
- Render free tier resets filesystem
- Solution: Upgrade to paid plan with persistent disk
- Or: Use external database (MongoDB Atlas)

### Email Not Sending:
- Verify `EMAIL_USER` and `EMAIL_PASS` in Render environment variables
- Check Gmail app password is correct
- Look for SMTP errors in Render logs

### Can't Login:
- Check data.json has valid user accounts
- Verify passwords match
- Clear browser cache and cookies

---

## 💰 Cost Summary

### Free Option:
- GitHub: Free (private repos included)
- Render Free Tier: $0/month
  - ✅ Free hosting
  - ✅ Auto-deploy from GitHub
  - ✅ HTTPS included
  - ❌ Data resets on restart
  - ❌ Sleeps after 15 min inactivity

### Recommended Production Setup:
- Render Starter: **$7/month**
  - ✅ Persistent disk (data.json survives restarts)
  - ✅ No sleep/downtime
  - ✅ Better performance
  - ✅ Priority support

### Optional Additions:
- Custom Domain: ~$12/year
- MongoDB Atlas: Free tier (if you want real database)

---

## 🎯 Quick Commands Reference

```bash
# Local development
npm install        # Install dependencies
npm start          # Start server locally
node simple-server.js  # Alternative start

# Git commands
git status         # Check changes
git add .          # Stage all changes
git commit -m "message"  # Commit changes
git push           # Push to GitHub (triggers Render deploy)

# View logs
git log --oneline  # See commit history
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

- [ ] Site loads at Render URL
- [ ] Login works
- [ ] Dashboard displays correctly
- [ ] Attendance tracking works
- [ ] Leave requests work
- [ ] Email notifications work
- [ ] All pages accessible
- [ ] Mobile responsive
- [ ] HTTPS enabled (green padlock)
- [ ] No console errors in browser
- [ ] Server logs show no errors

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
