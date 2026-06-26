# ✅ Pre-Deployment Checklist

Complete this checklist before deploying to production.

## 🗄️ Database

- [ ] **Backup data.json** - Save a copy somewhere safe
- [ ] **Review data.json** - Remove test/dummy data
- [ ] **Check user accounts** - Verify all users are real
- [ ] **Update passwords** - Change all default passwords (admin123, etc.)
- [ ] **Review employee data** - Ensure accuracy

## 🔒 Security

- [ ] **Change admin password** - Don't use "admin123"
- [ ] **Remove test users** - Delete any test@example.com accounts
- [ ] **Verify .gitignore** - Ensure .env is excluded
- [ ] **Check .env file** - Verify EMAIL_USER and EMAIL_PASS are correct
- [ ] **Review user roles** - Ensure proper permissions (admin/manager/employee)
- [ ] **Test authentication** - Login/logout works properly

## 📧 Email Configuration

- [ ] **Gmail app password created** - 16-character password
- [ ] **EMAIL_USER set** - wondwossentefera@gmail.com
- [ ] **EMAIL_PASS set** - foga rlxx ystg vxsl
- [ ] **Test email locally** - Send daily report works
- [ ] **Verify recipient** - Emails go to correct address

## 🧪 Testing

- [ ] **Test all pages** - Every page loads without errors
- [ ] **Test attendance** - Check-in/out works
- [ ] **Test leave requests** - Request, approve, reject
- [ ] **Test reports** - All reports generate
- [ ] **Test email** - Daily report sends successfully
- [ ] **Test on mobile** - Responsive design works
- [ ] **Test different roles** - Admin, Manager, Employee access
- [ ] **Check console** - No JavaScript errors

## 📦 Code Quality

- [ ] **Remove console.logs** - Clean up debug statements
- [ ] **Remove commented code** - Clean up old code
- [ ] **Update package.json** - Correct name, version, author
- [ ] **Update README.md** - Accurate instructions
- [ ] **Check dependencies** - All packages in package.json

## 🌐 GitHub Preparation

- [ ] **Git initialized** - `git init` done
- [ ] **All files added** - `git add .` done
- [ ] **Initial commit** - `git commit -m "message"` done
- [ ] **GitHub repo created** - Repository ready
- [ ] **Remote added** - `git remote add origin ...` done
- [ ] **Pushed to GitHub** - `git push -u origin main` done

## 🚀 Render Configuration

- [ ] **Render account created** - Signed up with GitHub
- [ ] **Repository connected** - Linked to Render
- [ ] **Environment variables added** - EMAIL_USER, EMAIL_PASS
- [ ] **Build command set** - `npm install`
- [ ] **Start command set** - `node simple-server.js`
- [ ] **Region selected** - Closest to users

## 📊 Data Persistence

- [ ] **Understand free tier** - Data resets on restart
- [ ] **Consider upgrade** - $7/month for persistent disk
- [ ] **Backup strategy** - Plan to download data.json regularly
- [ ] **Alternative database** - Consider MongoDB if needed

## 📱 Post-Deployment

- [ ] **Site loads** - URL accessible
- [ ] **Login works** - Can access system
- [ ] **HTTPS enabled** - Green padlock in browser
- [ ] **All features work** - Tested on production
- [ ] **Email works** - Notifications sending
- [ ] **Mobile responsive** - Works on phone
- [ ] **No errors** - Check Render logs

## 📝 Documentation

- [ ] **Update README** - Correct URL, instructions
- [ ] **Document credentials** - Store securely
- [ ] **User guide** - How to use the system
- [ ] **Admin guide** - System administration
- [ ] **Share URL** - With team/customers

## 🎯 Go-Live

- [ ] **Monitor logs** - Watch Render for errors
- [ ] **Test with users** - Get feedback
- [ ] **Set up monitoring** - Check system health
- [ ] **Plan maintenance** - Schedule updates
- [ ] **Customer support** - Ready to help users

---

## 🚨 Critical Items (Must Do!)

These are **absolutely required** before going live:

1. ✅ Change admin password from "admin123"
2. ✅ Remove test data from data.json
3. ✅ Set EMAIL_USER and EMAIL_PASS in Render
4. ✅ Test login on production URL
5. ✅ Verify HTTPS is enabled (green padlock)

---

## 📞 Emergency Contacts

**Render Status:** https://status.render.com  
**GitHub Status:** https://www.githubstatus.com  
**Your Email:** wondwossentefera@gmail.com

---

## ⏱️ Estimated Time

- GitHub Setup: 5 minutes
- Render Setup: 5 minutes
- Testing: 10 minutes
- **Total: ~20 minutes**

---

When all boxes are checked, you're ready to deploy! 🚀
