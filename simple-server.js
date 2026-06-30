const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const zlib = require('zlib');
const nodemailer = require('nodemailer');
const cron = require('node-cron');

// Load environment variables
require('dotenv').config();

// Initialize data.json if it doesn't exist (for Render deployment)
try {
    const { initializeDataFile } = require('./init-data');
    initializeDataFile();
} catch (error) {
    console.log('⚠️  init-data.js not found, skipping data file initialization');
}

// Initialize database connection
const { initializeDatabase, categorizeError, getPool } = require('./db/connection');
const { createTables } = require('./db/schema');
const dbOps = require('./db/operations');

// Optional modules - wrap in try-catch to handle missing files
let employeeOps, analyticsRepo, emailScheduler;
try {
    employeeOps = require('./db/employees');
} catch (e) {
    console.log('⚠️  employees.js not found');
    employeeOps = null;
}

try {
    analyticsRepo = require('./db/Analytics_Repository');
} catch (e) {
    console.log('⚠️  Analytics_Repository.js not found');
    analyticsRepo = null;
}

try {
    emailScheduler = require('./db/Email_Scheduler');
} catch (e) {
    console.log('⚠️  Email_Scheduler.js not found');
    emailScheduler = null;
}

// Log database configuration
console.log('📦 Database Configuration:');
console.log(`   DB_HOST: ${process.env.DB_HOST || 'not set'}`);
console.log(`   DB_PORT: ${process.env.DB_PORT || 'not set'}`);
console.log(`   DB_NAME: ${process.env.DB_NAME || 'not set'}`);
console.log(`   DB_USER: ${process.env.DB_USER || 'not set'}`);
console.log(`   DB_SSL: ${process.env.DB_SSL || 'not set'}`);

// Initialize the database connection pool
console.log('🔄 Initializing database connection...');
initializeDatabase();
console.log('✅ Database initialization call sent');

// Import error handling utility
const { handleDatabaseError } = require('./db/connection');

/**
 * Standardized error response helper
 * Requirement 6.1, 6.7: Log errors appropriately and send client-safe messages
 * 
 * @param {Error} error - Database error object
 * @param {Object} res - HTTP response object
 * @param {string} context - Context for logging (e.g., "handleGetEmployees")
 * @returns {void}
 */
function sendErrorResponse(error, res, context) {
    // Check if error has been categorized by database module
    if (error.statusCode && error.clientMessage) {
        // Use categorized error information
        if (error.statusCode >= 500) {
            console.error(`❌ [${context}] Database Error:`, {
                statusCode: error.statusCode,
                category: error.errorCategory,
                code: error.code,
                message: error.message
            });
        } else {
            console.info(`ℹ️ [${context}] Database Info:`, {
                statusCode: error.statusCode,
                category: error.errorCategory
            });
        }
        
        res.writeHead(error.statusCode);
        res.end(JSON.stringify({ error: error.clientMessage }));
    } else {
        // Error not categorized - log and send generic message
        console.error(`❌ [${context}] Unexpected Error:`, {
            code: error.code,
            message: error.message
        });
        
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Operation failed. Please try again later.' }));
    }
}

// Database mode flag - controlled by USE_DATABASE environment variable
// When true, uses MySQL database; when false, uses file-based storage (data.json)
const USE_DATABASE = process.env.USE_DATABASE === 'true';

// Helper function to load data from data.json
function loadDataFromFile() {
    try {
        if (fs.existsSync('data.json')) {
            return JSON.parse(fs.readFileSync('data.json', 'utf8'));
        }
        return { users: {}, employees: [], departments: [], leaveRequests: [], attendance: [], notifications: [] };
    } catch (error) {
        console.error('Error loading data.json:', error);
        return { users: {}, employees: [], departments: [], leaveRequests: [], attendance: [], notifications: [] };
    }
}

// Helper function to save data to data.json
function saveDataToFile(data) {
    try {
        fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving data.json:', error);
        return false;
    }
}

// Load configuration
let config = {};
try {
    if (fs.existsSync('config.json')) {
        config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
    }
} catch (error) {
    console.log('Warning: Could not load config.json, using defaults');
}

// Server configuration with defaults - UPDATED FOR CLOUD/RENDER DEPLOYMENT
const SERVER_CONFIG = {
    // Cloud platforms (Render, Heroku, etc.) require binding to 0.0.0.0
    // Use environment variable PORT if available (cloud), otherwise use config or default
    host: process.env.PORT ? '0.0.0.0' : (config.server?.host || 'localhost'),
    port: process.env.PORT || config.server?.port || 3000,
    allowExternalConnections: process.env.PORT ? true : (config.server?.allowExternalConnections || false)
};

// Email configuration and transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Email sending function
async function sendEmail(subject, text) {
    try {
        // Validate email configuration
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.error('❌ Email configuration missing. Please set EMAIL_USER and EMAIL_PASS environment variables.');
            return { success: false, error: 'Email configuration missing' };
        }

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // Send to yourself (you can change this)
            subject: subject,
            text: text,
            html: `<div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>${subject}</h2>
                <p>${text}</p>
                <hr>
                <p style="color: #666; font-size: 12px;">Sent from Employee Management System</p>
            </div>`
        });
        
        console.log('✅ Report email sent successfully');
        return { success: true };
    } catch (error) {
        console.error('❌ Error sending email:', error);
        return { success: false, error: error.message };
    }
}

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml'
};

// Session storage - load from file or memory
let sessions = new Map();

// Load sessions from file on startup
function loadSessions() {
    try {
        const fileData = loadDataFromFile();
        if (fileData.sessions && Array.isArray(fileData.sessions)) {
            sessions = new Map(fileData.sessions);
            console.log(`✅ Loaded ${sessions.size} sessions from file`);
            // Log session IDs for debugging (first 8 chars only)
            if (sessions.size > 0) {
                const sessionIds = Array.from(sessions.keys()).map(id => id.substring(0, 8));
                console.log(`   Session IDs: ${sessionIds.join(', ')}...`);
            }
        } else {
            console.log('⚠️  No sessions array found in data.json');
        }
    } catch (error) {
        console.log('⚠️  No existing sessions to load:', error.message);
    }
}

// Save sessions to file
function saveSessions() {
    try {
        const fileData = loadDataFromFile();
        fileData.sessions = Array.from(sessions.entries());
        saveDataToFile(fileData);
        console.log(`💾 Saved ${sessions.size} sessions to file`);
    } catch (error) {
        console.error('❌ Error saving sessions:', error);
    }
}

// Initialize sessions on startup
loadSessions();

// Compression helper
function shouldCompress(req, contentType) {
    const acceptEncoding = req.headers['accept-encoding'] || '';
    return acceptEncoding.includes('gzip') && 
           (contentType.includes('json') || contentType.includes('html') || contentType.includes('css') || contentType.includes('javascript'));
}

function sendCompressedResponse(res, data, contentType, statusCode = 200) {
    const headers = { 'Content-Type': contentType };
    
    if (shouldCompress({ headers: { 'accept-encoding': 'gzip' } }, contentType)) {
        headers['Content-Encoding'] = 'gzip';
        zlib.gzip(data, (err, compressed) => {
            if (err) {
                res.writeHead(statusCode, { 'Content-Type': contentType });
                res.end(data);
            } else {
                res.writeHead(statusCode, headers);
                res.end(compressed);
            }
        });
    } else {
        res.writeHead(statusCode, headers);
        res.end(data);
    }
}

function generateSessionId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function getSession(req) {
    const cookies = req.headers.cookie;
    console.log('🔍 [getSession] Raw cookies from request headers:', cookies || 'NO COOKIES');
    console.log(`🔍 [getSession] Current sessions in memory: ${sessions.size}`);
    
    if (!cookies) {
        console.log('❌ [getSession] No cookies in request');
        return null;
    }
    
    const sessionCookie = cookies.split(';').find(c => c.trim().startsWith('sessionId='));
    if (!sessionCookie) {
        console.log('❌ [getSession] No sessionId cookie found in:', cookies);
        return null;
    }
    
    console.log('✅ [getSession] sessionId cookie was found');
    const sessionId = sessionCookie.split('=')[1];
    console.log(`🔍 [getSession] Looking up session with ID: ${sessionId}`);
    
    const session = sessions.get(sessionId);
    
    if (session) {
        console.log(`✅ [getSession] Session FOUND for ${sessionId}`);
        const sessionDataPreview = JSON.stringify(session).substring(0, 100);
        console.log(`✅ [getSession] Session data (first 100 chars): ${sessionDataPreview}`);
    } else {
        console.log(`❌ [getSession] Session NOT FOUND for ${sessionId}`);
        // List all available session IDs for debugging
        const allSessionIds = Array.from(sessions.keys()).map(id => id.substring(0, 8) + '...');
        console.log(`📊 [getSession] Available sessions: ${allSessionIds.join(', ')}`);
    }
    
    return session;
}

function setSession(req, res, sessionData) {
    const sessionId = generateSessionId();
    sessions.set(sessionId, sessionData);
    saveSessions(); // Persist sessions to file
    
    // Detect actual HTTPS protocol from request object
    // req.protocol works on HTTP servers behind proxies (like Render)
    // req.headers['x-forwarded-proto'] is set by reverse proxies (common on cloud platforms)
    const isHttps = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https';
    
    const cookieAttributes = [
        `sessionId=${sessionId}`,
        'HttpOnly', // Prevents JavaScript access (XSS protection)
        'Path=/',
        'Max-Age=86400' // 24 hours
    ];
    
    // Set Secure flag only when actually using HTTPS
    if (isHttps) {
        cookieAttributes.push('Secure');
        console.log(`🔒 HTTPS detected: Setting Secure flag`);
    } else {
        console.log(`🔓 HTTP detected: Secure flag not set`);
    }
    
    // Use SameSite=Lax for all environments (more compatible than None)
    cookieAttributes.push('SameSite=Lax');
    console.log(`📋 SameSite=Lax set for all environments`);
    
    const cookieString = cookieAttributes.join('; ');
    console.log(`🍪 Setting session cookie with attributes: HttpOnly, Path=/, Max-Age=86400, ${isHttps ? 'Secure, ' : ''}SameSite=Lax`);
    console.log(`🍪 Full cookie string: ${cookieString}`);
    res.setHeader('Set-Cookie', cookieString);
    
    console.log(`✅ Session created: ${sessionId} for user data: ${JSON.stringify(sessionData).substring(0, 100)}...`);
    return sessionId;
}

// Helper function to check if a pathname is a tracked page for analytics
function isTrackedPage(pathname) {
    const trackedPages = [
        '/login',
        '/dashboard',
        '/employees',
        '/attendance',
        '/leave',
        '/departments',
        '/reports',
        '/payroll',
        '/profile',
        '/employee-detail',
        '/id-badges',
        '/add-employee',
        '/leave-request'
    ];
    return trackedPages.includes(pathname) || pathname === '/';
}

const server = http.createServer((req, res) => {
    const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    console.log(`📡 ${new Date().toISOString()} - ${clientIP} - ${req.method} ${req.url}`);
    console.log(`🌐 Request Headers - Origin: ${req.headers.origin}, Referer: ${req.headers.referer}`);
    
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    // Firefox-compatible CORS headers - simplified approach
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const host = req.headers.host;
    
    // Determine the correct origin to allow
    let allowedOrigin;
    if (origin) {
        allowedOrigin = origin;
    } else if (referer) {
        try {
            allowedOrigin = new URL(referer).origin;
        } catch (e) {
            allowedOrigin = `http://${host}`;
        }
    } else {
        allowedOrigin = `http://${host}`;
    }
    
    console.log(`🌐 CORS - Setting origin to: ${allowedOrigin}`);
    
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    
    // Completely permissive CSP - allow all resources from all sources
    // This fixes CSP blocking issues with images, scripts, styles, etc.
    res.setHeader('Content-Security-Policy', "default-src *; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; img-src * data:; font-src * data:");
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Analytics middleware - track page visits for GET requests to tracked pages
    if (req.method === 'GET' && isTrackedPage(pathname)) {
        try {
            const session = getSession(req);
            if (session && session.user_id) {
                // Extract page name from pathname (remove leading slash, or use 'login' for root)
                const pageName = pathname === '/' ? 'login' : pathname.substring(1);
                
                // Import Analytics_Repository and record the page visit
                try {
                    if (analyticsRepo && analyticsRepo.recordPageVisit) {
                        analyticsRepo.recordPageVisit(session.user_id, pageName);
                    }
                } catch (e) {
                    // Silently skip if analytics not available
                }
            }
        } catch (error) {
            // Non-blocking error handling - log the error but don't block the response
            console.error('Failed to record page visit:', error.message);
        }
    }

    // API Routes
    if (pathname.startsWith('/api/')) {
        handleAPI(req, res, pathname);
        return;
    }

    // Static file serving
    let filePath = pathname === '/' ? '/index.html' : pathname;
    
    // Route HTML files
    if (pathname === '/login') filePath = '/login.html';
    if (pathname === '/dashboard') filePath = '/dashboard.html';
    if (pathname === '/employees') filePath = '/employees.html';
    if (pathname === '/add-employee') filePath = '/add-employee.html';
    if (pathname === '/departments') filePath = '/departments.html';
    if (pathname === '/attendance') filePath = '/attendance.html';
    if (pathname === '/leave') filePath = '/leave.html';
    if (pathname === '/leave-request') filePath = '/leave-request.html';
    if (pathname === '/reports') filePath = '/reports.html';
    if (pathname === '/id-badges') filePath = '/id-badges.html';
    if (pathname === '/profile') filePath = '/profile.html';
    if (pathname === '/employee-detail') filePath = '/employee-detail.html';
    if (pathname === '/payroll') filePath = '/payroll.html';
    if (pathname === '/test') filePath = '/test-simple.html';
    
    filePath = path.join(__dirname, filePath);
    
    // Debug logging
    console.log(`Requested path: ${pathname}`);
    console.log(`Resolved file path: ${filePath}`);
    
    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.log(`File not found: ${filePath}`);
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(`<h1>404 - File Not Found</h1><p>Requested: ${pathname}</p><p>Looking for: ${filePath}</p>`);
            return;
        }
        
        const ext = path.extname(filePath);
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        
        console.log(`Serving file: ${filePath}`);
        
        fs.readFile(filePath, (err, data) => {
            if (err) {
                console.log(`Error reading file: ${err.message}`);
                res.writeHead(500);
                res.end('Server Error: ' + err.message);
                return;
            }
            
            // Add caching headers for static assets
            const headers = { 'Content-Type': contentType };
            if (ext === '.css' || ext === '.js' || ext === '.png' || ext === '.jpg' || ext === '.gif' || ext === '.ico' || ext === '.svg') {
                headers['Cache-Control'] = 'public, max-age=3600'; // Cache for 1 hour
            }
            
            res.writeHead(200, headers);
            res.end(data);
        });
    });
});

function handleAPI(req, res, pathname) {
    console.log(`🔍 API Request: ${req.method} ${pathname}`);
    
    let body = '';
    
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', () => {
        try {
            const data = body ? JSON.parse(body) : {};
            console.log(`📋 API Data received for ${pathname}:`, data);
            
            res.setHeader('Content-Type', 'application/json');
            
            if (pathname === '/api/login' && req.method === 'POST') {
                console.log(`🔑 Login API called from ${req.connection.remoteAddress}`);
                handleLogin(req, res, data);
            } else if (pathname === '/api/server-info' && req.method === 'GET') {
                handleServerInfo(req, res);
            } else if (pathname === '/api/logout' && req.method === 'POST') {
                handleLogout(req, res);
            } else if (pathname === '/api/user' && req.method === 'GET') {
                handleGetUser(req, res);
            } else if (pathname === '/api/attendance' && req.method === 'POST') {
                handleAttendance(req, res, data);
            } else if (pathname === '/api/attendance/today' && req.method === 'GET') {
                handleTodayAttendance(req, res);
            } else if (pathname.startsWith('/api/attendance/') && req.method === 'PUT') {
                handleUpdateAttendance(req, res, pathname, data);
            } else if (pathname === '/api/attendance/overtime' && req.method === 'POST') {
                handleOvertimeRecord(req, res, data);
            } else if (pathname === '/api/attendance/create' && req.method === 'POST') {
                handleCreateAttendance(req, res, data);
            } else if (pathname === '/api/attendance/policy' && req.method === 'GET') {
                handleGetAttendancePolicy(req, res);
            } else if (pathname === '/api/attendance/policy' && req.method === 'POST') {
                handleSaveAttendancePolicy(req, res, data);
            } else if (pathname === '/api/attendance/violations' && req.method === 'GET') {
                handleGetViolations(req, res);
            } else if (pathname === '/api/attendance/excuse-violations' && req.method === 'POST') {
                handleExcuseViolations(req, res, data);
            } else if (pathname === '/api/attendance/history' && req.method === 'GET') {
                handleAttendanceHistory(req, res);
            } else if (pathname === '/api/employees' && req.method === 'GET') {
                handleGetEmployees(req, res);
            } else if (pathname === '/api/employees' && req.method === 'POST') {
                handleAddEmployee(req, res, data);
            } else if (pathname === '/api/departments' && req.method === 'GET') {
                handleGetDepartments(req, res);
            } else if (pathname === '/api/departments' && req.method === 'POST') {
                handleAddDepartment(req, res, data);
            } else if (pathname === '/api/leave-request' && req.method === 'POST') {
                handleLeaveRequest(req, res, data);
            } else if (pathname === '/api/leave-requests' && req.method === 'GET') {
                handleGetLeaveRequests(req, res);
            } else if (pathname.startsWith('/api/leave-requests/') && req.method === 'PUT') {
                handleUpdateLeaveRequest(req, res, pathname, data);
            } else if (pathname === '/api/reports/attendance' && req.method === 'GET') {
                handleAttendanceReport(req, res);
            } else if (pathname === '/api/reports/leave' && req.method === 'GET') {
                handleLeaveReport(req, res);
            } else if (pathname === '/api/reports/employee' && req.method === 'GET') {
                handleEmployeeReport(req, res);
            } else if (pathname === '/api/reports/department' && req.method === 'GET') {
                handleDepartmentReport(req, res);
            } else if (pathname === '/api/change-password' && req.method === 'POST') {
                handleChangePassword(req, res, data);
            } else if (pathname === '/api/reset-password' && req.method === 'POST') {
                handleResetPassword(req, res, data);
            } else if (pathname.startsWith('/api/employees/') && req.method === 'PUT') {
                handleUpdateEmployee(req, res, pathname, data);
            } else if (pathname.startsWith('/api/employees/') && req.method === 'DELETE') {
                handleDeleteEmployee(req, res, pathname);
            } else if (pathname === '/api/reports/export/pdf' && req.method === 'POST') {
                handlePDFExport(req, res, data);
            } else if (pathname === '/api/reports/export/excel' && req.method === 'POST') {
                handleExcelExport(req, res, data);
            } else if (pathname === '/api/user-role' && req.method === 'POST') {
                handleGetUserRole(req, res, data);
            } else if (pathname === '/api/upload-photo' && req.method === 'POST') {
                handlePhotoUpload(req, res);
            } else if (pathname === '/api/leave-balance' && req.method === 'GET') {
                handleGetLeaveBalance(req, res);
            } else if (pathname === '/api/notifications' && req.method === 'GET') {
                handleGetNotifications(req, res);
            } else if (pathname === '/api/notifications' && req.method === 'POST') {
                handleSendNotification(req, res, data);
            } else if (pathname.startsWith('/api/notifications/') && req.method === 'PUT') {
                handleMarkNotificationRead(req, res, pathname);
            } else if (pathname === '/api/notifications/mark-viewed' && req.method === 'POST') {
                handleMarkNotificationsViewed(req, res);
            } else if (pathname === '/api/config' && req.method === 'GET') {
                handleGetConfig(req, res);
            } else if (pathname === '/api/config' && req.method === 'POST') {
                handleUpdateConfig(req, res, data);
            } else if (pathname === '/api/config/test' && req.method === 'POST') {
                handleTestConfig(req, res, data);
            } else if (pathname === '/api/backup/download' && req.method === 'GET') {
                handleBackupDownload(req, res);
            } else if (pathname === '/api/backup/download/excel' && req.method === 'GET') {
                handleBackupDownloadExcel(req, res);
            } else if (pathname === '/api/send-report' && req.method === 'POST') {
                handleSendReport(req, res);
            } else if (pathname === '/api/analytics/interaction' && req.method === 'POST') {
                handleAnalyticsInteraction(req, res, data);
            } else {
                console.log(`❌ No matching route found for: ${req.method} ${pathname}`);
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'API endpoint not found' }));
            }
        } catch (error) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
    });
}

function handleServerInfo(req, res) {
    // Public endpoint that returns basic server configuration
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    
    // Get the actual host IP that clients should use
    const clientHost = SERVER_CONFIG.host === '0.0.0.0' ? '10.192.230.251' : SERVER_CONFIG.host;
    
    res.end(JSON.stringify({ 
        success: true, 
        data: {
            server: {
                host: clientHost,
                port: SERVER_CONFIG.port,
                allowExternalConnections: SERVER_CONFIG.allowExternalConnections
            },
            system: {
                name: 'Employee Management System',
                version: '1.0.0',
                timezone: 'local'
            },
            features: {
                notifications: true,
                overtime: true,
                leaveManagement: true,
                attendanceTracking: true
            }
        }
    }));
}

async function handleLogin(req, res, data) {
    const { email, password } = data;
    
    console.log(`🔐 Login attempt: ${email} from ${req.connection.remoteAddress}`);
    console.log(`🔍 USE_DATABASE: ${USE_DATABASE}`);
    
    try {
        let user;
        
        if (USE_DATABASE) {
            // Use database
            user = await dbOps.getUserByEmail(email);
        } else {
            // Use file-based storage
            const fileData = loadDataFromFile();
            user = fileData.users[email];
            console.log(`📄 File-based auth - Found user: ${!!user}`);
        }
        
        if (user && user.password === password) {
            const sessionData = {
                user_id: user.id,
                email: email,
                role: user.role
            };
            
            const sessionId = setSession(req, res, sessionData);
            console.log(`✅ Login successful for ${email}, session: ${sessionId}`);
            
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, redirect: '/dashboard' }));
        } else {
            console.log(`❌ Login failed for ${email} - user found: ${!!user}, password match: ${user && user.password === password}`);
            res.writeHead(200);
            res.end(JSON.stringify({ success: false, message: 'Invalid credentials' }));
        }
    } catch (error) {
        // Use centralized error handling for database errors
        console.error('❌ Error during login:', {
            code: error.code,
            message: error.message,
            category: error.errorCategory
        });
        
        // Use error categorization if available, otherwise default to generic error
        if (error.statusCode && error.clientMessage) {
            res.writeHead(error.statusCode);
            res.end(JSON.stringify({ error: error.clientMessage }));
        } else {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Authentication error. Please try again.' }));
        }
    }
}

function handleLogout(req, res) {
    console.log(`🚪 Logout request received`);
    console.log(`🚪 Cookies header: ${req.headers.cookie || 'NONE'}`);
    
    // Extract session ID from cookie to invalidate it
    const cookies = req.headers.cookie;
    if (cookies) {
        const sessionCookie = cookies.split(';').find(c => c.trim().startsWith('sessionId='));
        if (sessionCookie) {
            const sessionId = sessionCookie.split('=')[1];
            console.log(`🚪 Logout requested for session: ${sessionId}`);
            
            if (sessions.has(sessionId)) {
                sessions.delete(sessionId);
                saveSessions();
                console.log(`✅ Session ${sessionId} deleted from memory and file`);
                console.log(`📊 Remaining sessions in memory: ${sessions.size}`);
            } else {
                console.log(`⚠️  Session ${sessionId} not found in memory`);
            }
        } else {
            console.log(`⚠️  No sessionId cookie found in: ${cookies}`);
        }
    } else {
        console.log(`⚠️  No cookies in logout request`);
    }
    
    // Clear the cookie in browser
    res.setHeader('Set-Cookie', 'sessionId=; HttpOnly; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    res.writeHead(200);
    res.end(JSON.stringify({ success: true }));
}

function handleGetUser(req, res) {
    const session = getSession(req);
    
    console.log(`Get user request, session:`, session);
    
    if (!session) {
        console.log('No session found, redirecting to login');
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }
    
    res.writeHead(200);
    res.end(JSON.stringify(session));
}

// Time validation function for attendance
function validateAttendanceTime(action, type, currentTime, dayOfWeek) {
    // Convert time string to minutes for comparison
    function timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }
    
    const currentMinutes = timeToMinutes(currentTime);
    
    // Define time windows
    const timeWindows = {
        // Monday to Friday (1-5)
        weekday: {
            morning: {
                start: timeToMinutes('08:00'), // 8:00 AM
                end: timeToMinutes('12:00')    // 12:00 PM (noon)
            },
            afternoon: {
                start: timeToMinutes('13:00'), // 1:00 PM
                end: timeToMinutes('17:00')    // 5:00 PM
            }
        },
        // Saturday (6)
        saturday: {
            morning: {
                start: timeToMinutes('08:00'), // 8:00 AM
                end: timeToMinutes('12:00')    // 12:00 PM (noon)
            }
        }
    };
    
    // Check if it's a valid working day
    if (dayOfWeek === 0) { // Sunday
        return {
            valid: false,
            error: 'Attendance not allowed on Sundays',
            message: 'Sunday is not a working day. Please check in during weekdays (Monday-Friday) or Saturday morning only.'
        };
    }
    
    // Saturday validation (morning only)
    if (dayOfWeek === 6) { // Saturday
        if (type === 'afternoon') {
            return {
                valid: false,
                error: 'Afternoon sessions not allowed on Saturday',
                message: 'Saturday work is morning only (8:00 AM - 12:00 PM). Afternoon sessions are not permitted.'
            };
        }
        
        const saturdayWindow = timeWindows.saturday.morning;
        if (currentMinutes < saturdayWindow.start || currentMinutes > saturdayWindow.end) {
            return {
                valid: false,
                error: 'Outside Saturday working hours',
                message: `Saturday attendance is only allowed between 8:00 AM and 12:00 PM. Current time: ${currentTime}`
            };
        }
    }
    
    // Monday to Friday validation
    if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday to Friday
        const sessionWindow = timeWindows.weekday[type];
        
        if (!sessionWindow) {
            return {
                valid: false,
                error: 'Invalid session type',
                message: 'Invalid session type specified.'
            };
        }
        
        if (currentMinutes < sessionWindow.start || currentMinutes > sessionWindow.end) {
            const startTime = Math.floor(sessionWindow.start / 60).toString().padStart(2, '0') + ':' + 
                            (sessionWindow.start % 60).toString().padStart(2, '0');
            const endTime = Math.floor(sessionWindow.end / 60).toString().padStart(2, '0') + ':' + 
                          (sessionWindow.end % 60).toString().padStart(2, '0');
            
            return {
                valid: false,
                error: `Outside ${type} working hours`,
                message: `${type.charAt(0).toUpperCase() + type.slice(1)} attendance is only allowed between ${startTime} and ${endTime}. Current time: ${currentTime}`
            };
        }
    }
    
    return { valid: true };
}

async function handleAttendance(req, res, data) {
    console.log('🔍 DEBUG: handleAttendance called with:', { action: data.action, type: data.type });
    
    const session = getSession(req);
    
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }
    
    try {
        const { action, type } = data;
        const now = new Date();
        const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM format
        const currentDate = now.toISOString().split('T')[0];
        const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        
        // Get employee from database
        const allEmployees = await dbOps.getAllEmployees();
        const employee = allEmployees.find(emp => emp.email === session.email);
            
        if (!employee) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Employee not found' }));
            return;
        }
        
        // Time-based validation rules
        const timeValidation = validateAttendanceTime(action, type, currentTime, dayOfWeek);
        if (!timeValidation.valid) {
            res.writeHead(400);
            res.end(JSON.stringify({ 
                error: timeValidation.error,
                message: timeValidation.message
            }));
            return;
        }
        
        // Find or create today's attendance record
        let todayRecord = await dbOps.getTodayAttendance(employee.id);
        
        if (!todayRecord) {
            // Create new record
            todayRecord = {
                employee_id: employee.id,
                employee_name: buildEmployeeName(employee),
                date: currentDate,
                morning_checkin: null,
                morning_checkout: null,
                afternoon_checkin: null,
                afternoon_checkout: null,
                total_hours: 0,
                status: 'present',
                created_at: new Date().toISOString()
            };
        }
        
        // Update the appropriate field
        const fieldName = `${type}_${action === 'checkin' ? 'checkin' : 'checkout'}`;
        
        // Validation: Check if already checked in/out
        if (todayRecord[fieldName]) {
            res.writeHead(400);
            res.end(JSON.stringify({ 
                error: `You have already ${action === 'checkin' ? 'checked in' : 'checked out'} for ${type}`,
                message: `Already ${action === 'checkin' ? 'checked in' : 'checked out'} at ${todayRecord[fieldName]}`
            }));
            return;
        }
        
        // Enhanced validation rules for proper workflow
        if (action === 'checkout') {
            // Rule 1: Must check in first before checking out
            const checkinField = `${type}_checkin`;
            if (!todayRecord[checkinField]) {
                res.writeHead(400);
                res.end(JSON.stringify({ 
                    error: `You must check in for ${type} before checking out`,
                    message: `Please check in for ${type} first`
                }));
                return;
            }
        }
        
        if (action === 'checkin' && type === 'afternoon') {
            console.log('🔍 DEBUG: Afternoon check-in validation - morning_checkin:', todayRecord.morning_checkin, 'morning_checkout:', todayRecord.morning_checkout);
            
            // Rule 2: Must check out from morning before checking in for afternoon (only if morning was started)
            if (todayRecord.morning_checkin && !todayRecord.morning_checkout) {
                console.log('🚫 DEBUG: Blocking afternoon check-in - morning session in progress');
                res.writeHead(400);
                res.end(JSON.stringify({ 
                    error: 'You must check out from morning session before checking in for afternoon',
                    message: `Please check out from morning session first. You checked in at ${todayRecord.morning_checkin} but haven't checked out yet.`
                }));
                return;
            }
            
            // Rule 3: Allow afternoon check-in even if morning session was missed
            if (!todayRecord.morning_checkin) {
                console.log('✅ DEBUG: Allowing afternoon check-in without morning session');
                console.log(`Employee ${employee.employee_id} checking in for afternoon session without morning session`);
            }
        }
        
        // Update the record using UPSERT pattern
        todayRecord[fieldName] = currentTime;
        
        // Calculate total hours if both morning and afternoon sessions are complete
        todayRecord.total_hours = calculateTotalHours(todayRecord);
        
        // Save using database recordAttendance (handles UPSERT)
        const employee_name = buildEmployeeName(employee);
        const updatedRecord = await dbOps.recordAttendance(employee.id, employee_name, type, action, currentTime);

        console.log(`✅ Attendance recorded for ${employee.employee_id}: ${type} ${action} at ${currentTime}`);
        
        res.writeHead(200);
        res.end(JSON.stringify({ 
            success: true, 
            data: updatedRecord,
            message: `You have successfully ${action === 'checkin' ? 'checked in' : 'checked out'} for ${type} at ${currentTime}`
        }));
    } catch (error) {
        // Use centralized error handling for database errors
        // Requirement 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7: Distinguish error types and use appropriate HTTP codes
        
        console.error('❌ Error recording attendance:', {
            code: error.code,
            category: error.errorCategory,
            message: error.message
        });
        
        // Use error categorization if available
        if (error.statusCode && error.clientMessage) {
            res.writeHead(error.statusCode);
            res.end(JSON.stringify({ 
                error: error.clientMessage,
                message: error.clientMessage
            }));
        } else {
            // Fallback to generic error
            res.writeHead(500);
            res.end(JSON.stringify({ 
                error: 'Failed to record attendance',
                message: 'An unexpected error occurred while recording your attendance. Please contact system administrator.'
            }));
        }
    }
}

// Helper function to build full employee name
function buildEmployeeName(employee) {
    let fullName = employee.first_name || '';
    if (employee.father_name) {
        fullName += ` ${employee.father_name}`;
    }
    if (employee.gfather_name) {
        fullName += ` ${employee.gfather_name}`;
    }
    if (employee.last_name) {
        fullName += ` ${employee.last_name}`;
    }
    return fullName.trim();
}

// Helper function to calculate total working hours
function calculateTotalHours(record) {
    let totalMinutes = 0;
    
    // Calculate morning hours
    if (record.morning_checkin && record.morning_checkout) {
        const morningIn = timeToMinutes(record.morning_checkin);
        const morningOut = timeToMinutes(record.morning_checkout);
        totalMinutes += morningOut - morningIn;
    }
    
    // Calculate afternoon hours
    if (record.afternoon_checkin && record.afternoon_checkout) {
        const afternoonIn = timeToMinutes(record.afternoon_checkin);
        const afternoonOut = timeToMinutes(record.afternoon_checkout);
        totalMinutes += afternoonOut - afternoonIn;
    }
    
    return Math.round((totalMinutes / 60) * 100) / 100; // Round to 2 decimal places
}

// Helper function to convert time string to minutes
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

async function handleTodayAttendance(req, res) {
    const session = getSession(req);
    
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }
    
    try {
        // Get employee from database
        const allEmployees = await dbOps.getAllEmployees();
        const employee = allEmployees.find(emp => emp.email === session.email);
        
        if (!employee) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Employee not found' }));
            return;
        }
        
        // Find today's attendance record from database
        const todayRecord = await dbOps.getTodayAttendance(employee.id);
        
        res.writeHead(200);
        res.end(JSON.stringify({ 
            success: true, 
            data: todayRecord || null
        }));
    } catch (error) {
        // Use centralized error handling for database errors
        console.error('❌ Error fetching today attendance:', {
            code: error.code,
            category: error.errorCategory,
            message: error.message
        });
        
        if (error.statusCode && error.clientMessage) {
            res.writeHead(error.statusCode);
            res.end(JSON.stringify({ error: error.clientMessage }));
        } else {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to fetch attendance' }));
        }
    }
}

async function handleUpdateAttendance(req, res, pathname, data) {
    const session = getSession(req);
    
    // Only admin can edit attendance times
    if (!session || session.role !== 'admin') {
        res.writeHead(403);
        res.end(JSON.stringify({ 
            error: 'Access denied. Only administrators can edit attendance times.' 
        }));
        return;
    }
    
    try {
        const attendanceId = parseInt(pathname.split('/').pop());
        
        // Validate time format (HH:MM)
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        const fieldsToUpdate = ['morning_checkin', 'morning_checkout', 'afternoon_checkin', 'afternoon_checkout'];
        
        const updates = {};
        for (const field of fieldsToUpdate) {
            if (data[field] !== undefined) {
                if (data[field] && !timeRegex.test(data[field])) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ 
                        error: `Invalid time format for ${field}. Use HH:MM format.` 
                    }));
                    return;
                }
                updates[field] = data[field] || null;
            }
        }
        
        // Add update metadata
        updates.updated_by = session.email;
        
        // Update in database
        const success = await dbOps.updateAttendance(attendanceId, updates);
        
        if (!success) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Attendance record not found' }));
            return;
        }
        
        // Fetch updated record
        const allRecords = await dbOps.getAttendanceHistory({});
        const record = allRecords.find(r => r.id === attendanceId);
        
        console.log(`Attendance updated by ${session.email} for ${record?.employee_name} on ${record?.date}`);
        
        res.writeHead(200);
        res.end(JSON.stringify({ 
            success: true, 
            data: record,
            message: 'Attendance times updated successfully'
        }));
    } catch (error) {
        // Use centralized error handling for database errors
        console.error('❌ Error updating attendance:', {
            code: error.code,
            category: error.errorCategory,
            message: error.message
        });
        
        if (error.statusCode && error.clientMessage) {
            res.writeHead(error.statusCode);
            res.end(JSON.stringify({ error: error.clientMessage }));
        } else {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to update attendance' }));
        }
    }
}

async function handleOvertimeRecord(req, res, data) {
    const session = getSession(req);
    
    // Only admin can record overtime
    if (!session || session.role !== 'admin') {
        res.writeHead(403);
        res.end(JSON.stringify({ 
            error: 'Access denied. Only administrators can record overtime.' 
        }));
        return;
    }
    
    const { employee_id, date, overtime_hours, overtime_reason } = data;
    
    // Validate required fields
    if (!employee_id || !date || overtime_hours === undefined) {
        res.writeHead(400);
        res.end(JSON.stringify({ 
            error: 'Employee ID, date, and overtime hours are required' 
        }));
        return;
    }
    
    // Validate overtime hours
    if (isNaN(overtime_hours) || overtime_hours < 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ 
            error: 'Overtime hours must be a positive number' 
        }));
        return;
    }
    
    try {
        // Find employee
        const allEmployees = await dbOps.getAllEmployees();
        const employee = allEmployees.find(emp => emp.id == employee_id);
        
        if (!employee) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Employee not found' }));
            return;
        }
        
        // Find or create attendance record for the date
        const filters = { employee_id: employee_id, start_date: date, end_date: date, limit: 1 };
        const records = await dbOps.getAttendanceHistory(filters);
        let attendanceRecord = records.length > 0 ? records[0] : null;
        
        if (!attendanceRecord) {
            // Create new attendance record for overtime
            const employeeName = buildEmployeeName(employee);
            await dbOps.recordAttendance(employee.id, employeeName, 'morning', 'checkin', null);
            
            // Get the newly created record
            const newRecords = await dbOps.getAttendanceHistory(filters);
            attendanceRecord = newRecords[0];
        }
        
        // Add overtime information
        const overtimeUpdates = {
            overtime_hours: parseFloat(overtime_hours),
            overtime_reason: overtime_reason || '',
            overtime_recorded_by: session.email,
            overtime_recorded_at: new Date().toISOString(),
            updated_by: session.email
        };
        
        await dbOps.updateAttendance(attendanceRecord.id, overtimeUpdates);
        
        // Fetch updated record
        const updatedRecords = await dbOps.getAttendanceHistory(filters);
        const updatedRecord = updatedRecords[0];
        
        console.log(`Overtime recorded by ${session.email}: ${overtime_hours} hours for ${buildEmployeeName(employee)} on ${date}`);
        
        res.writeHead(200);
        res.end(JSON.stringify({ 
            success: true, 
            data: updatedRecord,
            message: `Overtime of ${overtime_hours} hours recorded successfully for ${buildEmployeeName(employee)}`
        }));
    } catch (error) {
        console.error('❌ Error recording overtime:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to record overtime' }));
    }
}

async function handleCreateAttendance(req, res, data) {
    const session = getSession(req);
    
    // Only admin can create attendance records
    if (!session || session.role !== 'admin') {
        res.writeHead(403);
        res.end(JSON.stringify({ 
            error: 'Access denied. Only administrators can create attendance records.' 
        }));
        return;
    }
    
    const { employee_id, employee_name, date, morning_checkin, morning_checkout, afternoon_checkin, afternoon_checkout, status } = data;
    
    // Validate required fields
    if (!employee_id || !date) {
        res.writeHead(400);
        res.end(JSON.stringify({ 
            error: 'Employee ID and date are required' 
        }));
        return;
    }
    
    try {
        // Check if record already exists
        const filters = { employee_id: employee_id, start_date: date, end_date: date, limit: 1 };
        const existingRecords = await dbOps.getAttendanceHistory(filters);
        
        if (existingRecords.length > 0) {
            res.writeHead(400);
            res.end(JSON.stringify({ 
                error: 'Attendance record already exists for this employee and date' 
            }));
            return;
        }
        
        // Get employee to build name if not provided
        let empName = employee_name;
        if (!empName) {
            const allEmployees = await dbOps.getAllEmployees();
            const employee = allEmployees.find(emp => emp.id == employee_id);
            if (employee) {
                empName = buildEmployeeName(employee);
            } else {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Employee not found' }));
                return;
            }
        }
        
        // Create base record by calling recordAttendance with morning checkin
        await dbOps.recordAttendance(parseInt(employee_id), empName, 'morning', 'checkin', morning_checkin || null);
        
        // Now update with all the fields
        const updatedRecords = await dbOps.getAttendanceHistory(filters);
        const newRecord = updatedRecords[0];
        
        const updates = {
            morning_checkout: morning_checkout || null,
            afternoon_checkin: afternoon_checkin || null,
            afternoon_checkout: afternoon_checkout || null,
            status: status || 'present',
            created_by: session.email
        };
        
        await dbOps.updateAttendance(newRecord.id, updates);
        
        // Fetch the final record
        const finalRecords = await dbOps.getAttendanceHistory(filters);
        const finalRecord = finalRecords[0];
        
        console.log(`Attendance record created by ${session.email} for ${empName} on ${date}`);
        
        res.writeHead(200);
        res.end(JSON.stringify({ 
            success: true, 
            data: finalRecord,
            message: 'Attendance record created successfully'
        }));
    } catch (error) {
        // Use centralized error handling for database errors
        console.error('❌ Error creating attendance record:', {
            code: error.code,
            category: error.errorCategory,
            message: error.message
        });
        
        if (error.statusCode && error.clientMessage) {
            res.writeHead(error.statusCode);
            res.end(JSON.stringify({ error: error.clientMessage }));
        } else {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to create attendance record' }));
        }
    }
}

async function handleAttendanceHistory(req, res) {
    const session = getSession(req);
    
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }
    
    try {
        const parsedUrl = url.parse(req.url, true);
        const { action, start_date, end_date, month, year } = parsedUrl.query;
        
        let filters = {};
        
        // Role-based filtering
        if (session.role === 'employee') {
            const allEmployees = await dbOps.getAllEmployees();
            const employee = allEmployees.find(emp => emp.email === session.email);
            if (employee) {
                filters.employee_id = employee.id;
            }
        }
        
        // Date filtering
        if (start_date && end_date) {
            filters.start_date = start_date;
            filters.end_date = end_date;
        }
        
        // Get filtered records from database
        let filteredRecords = await dbOps.getAttendanceHistory(filters);
        
        // Handle different actions
        if (action === 'stats' && month && year) {
            // Calculate monthly statistics
            const monthRecords = filteredRecords.filter(record => {
                const recordDate = new Date(record.date);
                return recordDate.getMonth() === parseInt(month) - 1 && 
                       recordDate.getFullYear() === parseInt(year);
            });
            
            const stats = {
                present_days: monthRecords.filter(r => r.status === 'present').length,
                total_hours: monthRecords.reduce((sum, r) => sum + (r.total_hours || 0), 0),
                total_overtime: monthRecords.reduce((sum, r) => sum + (r.overtime_hours || 0), 0),
                absent_days: monthRecords.filter(r => r.status === 'absent').length
            };
            
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, data: stats }));
        } else {
            // Return filtered records
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, data: filteredRecords }));
        }
    } catch (error) {
        // Use centralized error handling for database errors
        console.error('❌ Error fetching attendance history:', {
            code: error.code,
            category: error.errorCategory,
            message: error.message
        });
        
        if (error.statusCode && error.clientMessage) {
            res.writeHead(error.statusCode);
            res.end(JSON.stringify({ error: error.clientMessage }));
        } else {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to fetch attendance history' }));
        }
    }
}

function handleSaveAttendancePolicy(req, res, data) {
    const session = getSession(req);
    
    // Only admin can set attendance policy
    if (!session || session.role !== 'admin') {
        res.writeHead(403);
        res.end(JSON.stringify({ 
            error: 'Access denied. Only administrators can set attendance policy.' 
        }));
        return;
    }
    
    const { morning_start, morning_end, afternoon_start, afternoon_end, late_tolerance, early_tolerance } = data;
    
    // Validate required fields
    if (!morning_start || !morning_end || !afternoon_start || !afternoon_end) {
        res.writeHead(400);
        res.end(JSON.stringify({ 
            error: 'All time fields are required' 
        }));
        return;
    }
    
    // Validate tolerance values
    if (late_tolerance < 0 || early_tolerance < 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ 
            error: 'Tolerance values must be positive' 
        }));
        return;
    }
    
    // Save policy (in production, this would go to a database)
    const policy = {
        morning_start,
        morning_end,
        afternoon_start,
        afternoon_end,
        late_tolerance: parseInt(late_tolerance) || 15,
        early_tolerance: parseInt(early_tolerance) || 15,
        updated_at: new Date().toISOString(),
        updated_by: session.email
    };
    
    // Store in global variable
    global.attendancePolicy = policy;
    
    // Save to data.json using the standard saveData function
    try {
        saveData();
        console.log('Attendance policy saved successfully');
    } catch (error) {
        console.log('Error saving attendance policy:', error.message);
        res.writeHead(500);
        res.end(JSON.stringify({ 
            error: 'Failed to save attendance policy',
            message: error.message
        }));
        return;
    }
    
    console.log(`Attendance policy updated by ${session.email}`);
    
    res.writeHead(200);
    res.end(JSON.stringify({ 
        success: true, 
        data: policy,
        message: 'Attendance policy saved successfully'
    }));
}

function handleGetAttendancePolicy(req, res) {
    const session = getSession(req);
    
    // Only admin and manager can view attendance policy
    if (!session || (session.role !== 'admin' && session.role !== 'manager')) {
        res.writeHead(403);
        res.end(JSON.stringify({ 
            error: 'Access denied. Only administrators and managers can view attendance policy.' 
        }));
        return;
    }
    
    // Get current policy or return default
    const policy = global.attendancePolicy || {
        morning_start: '08:00',
        morning_end: '12:55',
        afternoon_start: '13:00',
        afternoon_end: '18:00',
        late_tolerance: 15,
        early_tolerance: 15
    };
    
    res.writeHead(200);
    res.end(JSON.stringify({ 
        success: true, 
        data: policy
    }));
}

async function handleGetViolations(req, res) {
    const session = getSession(req);
    
    // Only admin and manager can view violations
    if (!session || (session.role !== 'admin' && session.role !== 'manager')) {
        res.writeHead(403);
        res.end(JSON.stringify({ 
            error: 'Access denied. Only administrators and managers can view violations.' 
        }));
        return;
    }
    
    const parsedUrl = url.parse(req.url, true);
    const { start_date, end_date, employee_id, violation_type } = parsedUrl.query;
    
    if (!start_date || !end_date) {
        res.writeHead(400);
        res.end(JSON.stringify({ 
            error: 'Start date and end date are required' 
        }));
        return;
    }
    
    // Get attendance policy
    const policy = global.attendancePolicy || {
        morning_start: '08:00',
        morning_end: '12:55',
        afternoon_start: '13:00',
        afternoon_end: '18:00',
        late_tolerance: 15,
        early_tolerance: 15
    };
    
    // Filter records by date range and employee using database
    let filters = { start_date, end_date };
    if (employee_id) {
        filters.employee_id = employee_id;
    }
    
    const filteredRecords = USE_DATABASE
        ? await dbOps.getAttendanceHistory(filters)
        : attendanceRecords.filter(record => {
            let match = record.date >= start_date && record.date <= end_date;
            if (employee_id) {
                match = match && record.employee_id == employee_id;
            }
            return match;
        });
    
    // Calculate violations
    const violations = [];
    
    filteredRecords.forEach(record => {
        const recordViolations = calculateAttendanceViolations(record, policy);
        violations.push(...recordViolations);
    });
    
    // Filter by violation type if specified
    let filteredViolations = violations;
    if (violation_type && violation_type !== 'all') {
        filteredViolations = violations.filter(v => v.violation_type === violation_type);
    }
    
    res.writeHead(200);
    res.end(JSON.stringify({ 
        success: true, 
        data: filteredViolations,
        policy: policy
    }));
}

async function handleExcuseViolations(req, res, data) {
    const session = getSession(req);
    
    // Only admin can excuse violations
    if (!session || session.role !== 'admin') {
        res.writeHead(403);
        res.end(JSON.stringify({ 
            error: 'Access denied. Only administrators can excuse violations.' 
        }));
        return;
    }
    
    const { employee_id, start_date, end_date, reason } = data;
    
    if (!employee_id || !start_date || !end_date || !reason) {
        res.writeHead(400);
        res.end(JSON.stringify({ 
            error: 'Employee ID, date range, and reason are required' 
        }));
        return;
    }
    
    try {
        // Find and update attendance records
        let excusedCount = 0;
        
        if (USE_DATABASE) {
            // Get records from database
            const records = await dbOps.getAttendanceHistory({
                employee_id,
                start_date,
                end_date
            });
            
            // Update each record
            for (const record of records) {
                const excusedData = {
                    excused_violations: JSON.stringify([{
                        excused_at: new Date().toISOString(),
                        excused_by: session.email,
                        reason: reason
                    }])
                };
                await dbOps.updateAttendance(record.id, excusedData);
                excusedCount++;
            }
        } else {
            // Fallback to file-based
            attendanceRecords.forEach(record => {
                if (record.employee_id == employee_id && 
                    record.date >= start_date && 
                    record.date <= end_date) {
                    
                    if (!record.excused_violations) {
                        record.excused_violations = [];
                    }
                    
                    record.excused_violations.push({
                        excused_at: new Date().toISOString(),
                        excused_by: session.email,
                        reason: reason
                    });
                    
                    excusedCount++;
                }
            });
            
            // Save data
            saveData();
        }
        
        console.log(`${excusedCount} violations excused by ${session.email} for employee ${employee_id}`);
        
        res.writeHead(200);
        res.end(JSON.stringify({ 
            success: true, 
            count: excusedCount,
            message: `${excusedCount} violations have been excused`
        }));
    } catch (error) {
        console.error('❌ Error excusing violations:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to excuse violations' }));
    }
}

// Helper function to calculate violations for a record
function calculateAttendanceViolations(record, policy) {
    const violations = [];
    
    // Helper function to convert time to minutes
    function timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }
    
    // Check morning late check-in
    if (record.morning_checkin) {
        const expectedTime = timeToMinutes(policy.morning_start);
        const actualTime = timeToMinutes(record.morning_checkin);
        const difference = actualTime - expectedTime;
        
        if (difference > policy.late_tolerance) {
            violations.push({
                employee_id: record.employee_id,
                employee_name: record.employee_name,
                date: record.date,
                violation_type: 'late_checkin',
                session: 'morning',
                expected_time: policy.morning_start,
                actual_time: record.morning_checkin,
                difference_minutes: difference,
                severity: difference > 30 ? 'high' : 'medium',
                excused: record.excused_violations && record.excused_violations.length > 0
            });
        }
    } else {
        // Missing morning check-in
        violations.push({
            employee_id: record.employee_id,
            employee_name: record.employee_name,
            date: record.date,
            violation_type: 'missed_checkin',
            session: 'morning',
            expected_time: policy.morning_start,
            actual_time: null,
            difference_minutes: null,
            severity: 'high',
            excused: record.excused_violations && record.excused_violations.length > 0
        });
    }
    
    // Check morning early check-out
    if (record.morning_checkout) {
        const expectedTime = timeToMinutes(policy.morning_end);
        const actualTime = timeToMinutes(record.morning_checkout);
        const difference = expectedTime - actualTime;
        
        if (difference > policy.early_tolerance) {
            violations.push({
                employee_id: record.employee_id,
                employee_name: record.employee_name,
                date: record.date,
                violation_type: 'early_checkout',
                session: 'morning',
                expected_time: policy.morning_end,
                actual_time: record.morning_checkout,
                difference_minutes: difference,
                severity: difference > 30 ? 'high' : 'medium',
                excused: record.excused_violations && record.excused_violations.length > 0
            });
        }
    } else if (record.morning_checkin) {
        // Missing morning check-out (but checked in)
        violations.push({
            employee_id: record.employee_id,
            employee_name: record.employee_name,
            date: record.date,
            violation_type: 'missed_checkout',
            session: 'morning',
            expected_time: policy.morning_end,
            actual_time: null,
            difference_minutes: null,
            severity: 'medium',
            excused: record.excused_violations && record.excused_violations.length > 0
        });
    }
    
    // Check afternoon late check-in
    if (record.afternoon_checkin) {
        const expectedTime = timeToMinutes(policy.afternoon_start);
        const actualTime = timeToMinutes(record.afternoon_checkin);
        const difference = actualTime - expectedTime;
        
        if (difference > policy.late_tolerance) {
            violations.push({
                employee_id: record.employee_id,
                employee_name: record.employee_name,
                date: record.date,
                violation_type: 'late_checkin',
                session: 'afternoon',
                expected_time: policy.afternoon_start,
                actual_time: record.afternoon_checkin,
                difference_minutes: difference,
                severity: difference > 30 ? 'high' : 'medium',
                excused: record.excused_violations && record.excused_violations.length > 0
            });
        }
    } else {
        // Missing afternoon check-in
        violations.push({
            employee_id: record.employee_id,
            employee_name: record.employee_name,
            date: record.date,
            violation_type: 'missed_checkin',
            session: 'afternoon',
            expected_time: policy.afternoon_start,
            actual_time: null,
            difference_minutes: null,
            severity: 'high',
            excused: record.excused_violations && record.excused_violations.length > 0
        });
    }
    
    // Check afternoon early check-out
    if (record.afternoon_checkout) {
        const expectedTime = timeToMinutes(policy.afternoon_end);
        const actualTime = timeToMinutes(record.afternoon_checkout);
        const difference = expectedTime - actualTime;
        
        if (difference > policy.early_tolerance) {
            violations.push({
                employee_id: record.employee_id,
                employee_name: record.employee_name,
                date: record.date,
                violation_type: 'early_checkout',
                session: 'afternoon',
                expected_time: policy.afternoon_end,
                actual_time: record.afternoon_checkout,
                difference_minutes: difference,
                severity: difference > 30 ? 'high' : 'medium',
                excused: record.excused_violations && record.excused_violations.length > 0
            });
        }
    } else if (record.afternoon_checkin) {
        // Missing afternoon check-out (but checked in)
        violations.push({
            employee_id: record.employee_id,
            employee_name: record.employee_name,
            date: record.date,
            violation_type: 'missed_checkout',
            session: 'afternoon',
            expected_time: policy.afternoon_end,
            actual_time: null,
            difference_minutes: null,
            severity: 'medium',
            excused: record.excused_violations && record.excused_violations.length > 0
        });
    }
    
    return violations;
}

function handleGetUserRole(req, res, data) {
    const session = getSession(req);
    
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }
    
    const { email } = data;
    const user = users[email];
    
    if (!user) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'User not found' }));
        return;
    }
    
    res.writeHead(200);
    res.end(JSON.stringify({ 
        success: true, 
        role: user.role || 'employee'
    }));
}

function handlePhotoUpload(req, res) {
    const session = getSession(req);
    
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }
    
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            const { employeeId, photoData } = data;
            
            // Find employee
            const employeeIndex = employees.findIndex(emp => emp.id == employeeId);
            if (employeeIndex === -1) {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Employee not found' }));
                return;
            }
            
            // Store photo as base64 data
            employees[employeeIndex].photo = photoData;
            employees[employeeIndex].updated_at = new Date().toISOString();
            employees[employeeIndex].updated_by = session.email;
            
            // Save data
            saveData();
            
            res.writeHead(200);
            res.end(JSON.stringify({ 
                success: true, 
                message: 'Photo uploaded successfully'
            }));
        } catch (error) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid request data' }));
        }
    });
}

// Data persistence functions with performance optimization
let saveTimeout = null;
let pendingSave = false;

function loadData() {
    try {
        if (fs.existsSync('data.json')) {
            const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
            return {
                employees: data.employees || [],
                users: data.users || {},
                departments: data.departments || [],
                leaveRequests: data.leaveRequests || [],
                attendanceRecords: data.attendanceRecords || [],
                attendancePolicy: data.attendancePolicy || null,
                notifications: data.notifications || [],
                analytics: data.analytics || { pageVisits: [], interactions: [] }
            };
        }
    } catch (error) {
        console.log('Error loading data:', error.message);
    }
    
    // Return default data if file doesn't exist or error occurs
    return {
        employees: [
            { id: 1, employee_id: '20240001', first_name: 'John', father_name: '', gfather_name: '', last_name: 'Admin', email: 'admin@company.com', department: 'Management', job_title: 'System Administrator', salary: 15000.00, start_date: '2024-01-01', status: 'active', annual_leave_days: 25 },
            { id: 2, employee_id: '20240002', first_name: 'Jane', father_name: '', gfather_name: '', last_name: 'Manager', email: 'manager@company.com', department: 'Human Resources', job_title: 'HR Manager', salary: 12000.00, start_date: '2024-01-15', status: 'active', annual_leave_days: 24 },
            { id: 3, employee_id: '20240003', first_name: 'Bob', father_name: '', gfather_name: '', last_name: 'Employee', email: 'employee@company.com', department: 'Information Technology', job_title: 'Software Developer', salary: 8000.00, start_date: '2024-02-01', status: 'active', annual_leave_days: 22 }
        ],
        users: {
            'admin@company.com': { id: 1, role: 'admin', password: 'admin123' },
            'manager@company.com': { id: 2, role: 'manager', password: 'manager123' },
            'employee@company.com': { id: 3, role: 'employee', password: 'employee123' }
        },
        departments: [
            { id: 1, name: 'Human Resources', description: 'Manages employee relations and policies' },
            { id: 2, name: 'Information Technology', description: 'Handles technical infrastructure' },
            { id: 3, name: 'Finance', description: 'Manages company finances' },
            { id: 4, name: 'Marketing', description: 'Handles marketing and promotions' },
            { id: 5, name: 'Management', description: 'Executive and administrative management' }
        ],
        leaveRequests: [
            { id: 1, employee_id: 3, employee_name: 'Bob Employee', leave_type: 'Annual Leave', start_date: '2024-12-20', end_date: '2024-12-24', days_requested: 3, reason: 'Christmas vacation', status: 'pending', created_at: '2024-12-10' }
        ],
        attendanceRecords: [
            { id: 1, employee_id: 3, employee_name: 'Bob Employee', date: '2024-12-12', morning_checkin: '09:00', morning_checkout: '12:00', afternoon_checkin: '13:00', afternoon_checkout: '17:00', total_hours: 7, status: 'present' }
        ],
        attendancePolicy: null,
        notifications: [],
        analytics: { pageVisits: [], interactions: [] }
    };
}

// Optimized save function with batching and async operations
function saveData() {
    // Clear any existing timeout
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    
    // Batch saves to avoid excessive file writes
    saveTimeout = setTimeout(() => {
        if (pendingSave) return; // Prevent concurrent saves
        
        pendingSave = true;
        const data = {
            employees,
            users,
            departments,
            leaveRequests,
            attendanceRecords,
            attendancePolicy: global.attendancePolicy || null,
            notifications,
            analytics: global.analytics || { pageVisits: [], interactions: [] }
        };
        
        // Use async file write to avoid blocking
        fs.writeFile('data.json', JSON.stringify(data, null, 2), (err) => {
            pendingSave = false;
            if (err) {
                console.log('Error saving data:', err.message);
            } else {
                console.log('Data saved successfully');
            }
        });
    }, 100); // Batch saves within 100ms window
}

// Immediate save function for critical operations
function saveDataImmediate() {
    if (pendingSave) return Promise.resolve(); // Don't save if already in progress
    
    return new Promise((resolve, reject) => {
        pendingSave = true;
        const data = {
            employees,
            users,
            departments,
            leaveRequests,
            attendanceRecords,
            attendancePolicy: global.attendancePolicy || null,
            notifications
        };
        
        fs.writeFile('data.json', JSON.stringify(data, null, 2), (err) => {
            pendingSave = false;
            if (err) {
                console.log('Error saving data:', err.message);
                reject(err);
            } else {
                console.log('Data saved successfully (immediate)');
                resolve();
            }
        });
    });
}

// Load initial data (only used when USE_DATABASE is false)
const initialData = loadData();
let employees = initialData.employees;
let users = initialData.users;
let leaveRequests = initialData.leaveRequests;
let attendanceRecords = initialData.attendanceRecords;
let notifications = initialData.notifications || [];
let departments = initialData.departments;

// Initialize analytics data
global.analytics = initialData.analytics || { pageVisits: [], interactions: [] };

// Expose saveData globally for modules like Analytics_Repository
global.saveData = saveData;

// Initialize attendance policy
global.attendancePolicy = initialData.attendancePolicy || {
    morning_start: '08:00',
    morning_end: '12:55',
    afternoon_start: '13:00',
    afternoon_end: '18:00',
    late_tolerance: 15,
    early_tolerance: 15
};

// Migration: Add default salary to employees that don't have one (file-based mode only)
if (!USE_DATABASE) {
    let migrationNeeded = false;
    employees.forEach(emp => {
        if (!emp.hasOwnProperty('salary') || emp.salary === null || emp.salary === undefined) {
            emp.salary = 5000.00; // Default salary in ETB
            migrationNeeded = true;
            console.log(`Added default salary to employee: ${buildEmployeeName(emp)}`);
        }
    });

    if (migrationNeeded) {
        console.log('Salary migration completed. Saving data...');
        saveData();
    }
}

async function handleGetEmployees(req, res) {
    const session = getSession(req);
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }

    try {
        // Get employees from database with parameterized SELECT query
        const employeeData = await dbOps.getAllEmployees();

        // Strict role-based filtering
        let filteredEmployees = employeeData;
        if (session.role === 'employee') {
            // Employees can ONLY see their own data
            filteredEmployees = employeeData.filter(emp => emp.email === session.email);
        }
        // Managers and Admins see all employees

        // Add current leave entitlement calculation and role-based permissions
        const enrichedData = filteredEmployees.map(emp => ({
            ...emp,
            current_leave_entitlement: calculateCurrentLeaveEntitlement(emp),
            canEdit: canEditEmployee(session, emp),
            canView: canViewEmployee(session, emp)
        }));

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: enrichedData, userRole: session.role }));
    } catch (error) {
        // Requirement 6.1, 6.2, 6.3, 6.4, 6.7: Use error categorization for all database operations
        sendErrorResponse(error, res, 'handleGetEmployees');
    }
}

async function handleAddEmployee(req, res, data) {
    const session = getSession(req);
    
    // ONLY ADMIN can add employees (including other admins and managers)
    if (!session || session.role !== 'admin') {
        res.writeHead(403);
        res.end(JSON.stringify({ 
            error: 'Access denied. Only administrators can register new employees.' 
        }));
        return;
    }

    // Validate required fields
    const requiredFields = ['first_name', 'email', 'department', 'job_title', 'start_date', 'salary'];
    for (const field of requiredFields) {
        if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: `${field.replace('_', ' ')} is required` }));
            return;
        }
    }

    // Validate salary
    const salary = parseFloat(data.salary);
    if (isNaN(salary) || salary < 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Salary must be a valid positive number' }));
        return;
    }

    try {
        // Always use database for new implementation
        // Check if email already exists (by checking both employees and users tables)
        const existingUser = await dbOps.getUserByEmail(data.email.trim().toLowerCase());
        
        // Check if email exists in employees table
        const allEmployees = await dbOps.getAllEmployees();
        const existingEmployee = allEmployees.find(emp => emp.email.toLowerCase() === data.email.trim().toLowerCase());
        
        if (existingUser || existingEmployee) {
            res.writeHead(409);
            res.end(JSON.stringify({ error: 'Email address already exists' }));
            return;
        }

        // Generate new employee ID
        const maxId = allEmployees.reduce((max, emp) => Math.max(max, emp.id || 0), 0);
        
        const currentYear = new Date().getFullYear();
        const newEmployee = {
            employee_id: `${currentYear}${String(maxId + 1).padStart(4, '0')}`,
            first_name: data.first_name.trim(),
            last_name: data.last_name ? data.last_name.trim() : '',
            father_name: data.father_name ? data.father_name.trim() : '',
            gfather_name: data.gfather_name ? data.gfather_name.trim() : '',
            email: data.email.trim().toLowerCase(),
            department: data.department.trim(),
            job_title: data.job_title.trim(),
            salary: salary,
            start_date: data.start_date,
            phone: data.phone || '',
            status: 'active',
            annual_leave_days: parseInt(data.annual_leave_days) || 22,
            leave_start_year: new Date().getFullYear(),
            created_at: new Date().toISOString(),
            created_by: session.email
        };

        // Generate temporary password
        const tempPassword = generateTempPassword();
        
        // Determine role (admin can assign roles)
        const assignedRole = data.role && ['admin', 'manager', 'employee'].includes(data.role) 
            ? data.role 
            : 'employee';
        
        const userData = {
            email: data.email.trim().toLowerCase(),
            role: assignedRole,
            password: tempPassword
        };

        // Save employee and user credentials using database transaction
        const result = await dbOps.addEmployee(newEmployee, userData);
        
        // Get the created employee
        const createdEmployee = await dbOps.getEmployeeById(result.employeeId);
        
        console.log(`✅ New ${assignedRole} added: ${newEmployee.first_name} ${newEmployee.father_name || ''}`);
        console.log(`   Login credentials - Email: ${data.email}, Password: ${tempPassword}, Role: ${assignedRole}`);

        res.writeHead(200);
        res.end(JSON.stringify({ 
            success: true, 
            data: createdEmployee,
            loginCredentials: {
                email: data.email.trim().toLowerCase(),
                password: tempPassword,
                role: assignedRole,
                message: `New ${assignedRole} account created successfully. Please share these credentials securely.`
            }
        }));
    } catch (error) {
        console.error('❌ Error adding employee:', error);
        
        // Use error categorization and centralized handling
        // Requirement 6.1, 6.7: Log errors without exposing internal details
        if (error.statusCode && error.clientMessage) {
            // Error already categorized by database module
            res.writeHead(error.statusCode);
            res.end(JSON.stringify({ 
                error: error.clientMessage 
            }));
        } else {
            // Fallback to generic error handling
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to add employee. Please try again.' }));
        }
    }
}

// Helper function to generate temporary password
function generateTempPassword() {
    // Use common password for all new employees and resets
    return '123456';
}

// Helper function to calculate current leave entitlement
function calculateCurrentLeaveEntitlement(employee) {
    const startDate = new Date(employee.start_date);
    const currentDate = new Date();
    const yearsOfService = Math.floor((currentDate - startDate) / (365.25 * 24 * 60 * 60 * 1000));
    
    // Base annual leave + 1 day per year of service
    return (employee.annual_leave_days || 22) + yearsOfService;
}

// Helper function to check if user can edit employee
function canEditEmployee(session, employee) {
    if (session.role === 'admin') {
        return true; // Admins can edit anyone
    } else if (session.role === 'manager') {
        // Managers can edit employees but not other managers/admins
        const targetUser = Object.values(users).find(user => user.id === employee.id);
        return !targetUser || targetUser.role === 'employee';
    } else if (session.role === 'employee') {
        // Employees can only edit themselves (limited fields)
        return employee.email === session.email;
    }
    return false;
}

// Helper function to check if user can view employee details
function canViewEmployee(session, employee) {
    if (session.role === 'admin' || session.role === 'manager') {
        return true; // Admins and managers can view all
    } else if (session.role === 'employee') {
        return employee.email === session.email; // Employees can only view themselves
    }
    return false;
}

async function handleGetDepartments(req, res) {
    const session = getSession(req);
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }

    try {
        const depts = USE_DATABASE
            ? await dbOps.getDepartments()
            : departments;
        
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: depts }));
    } catch (error) {
        console.error('❌ Error fetching departments:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to fetch departments' }));
    }
}

async function handleAddDepartment(req, res, data) {
    const session = getSession(req);
    
    // Only admin and manager can add departments
    if (!session || (session.role !== 'admin' && session.role !== 'manager')) {
        res.writeHead(403);
        res.end(JSON.stringify({ 
            error: 'Access denied. Only administrators and managers can add departments.' 
        }));
        return;
    }
    
    // Validate required fields
    if (!data.name || data.name.trim() === '') {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Department name is required' }));
        return;
    }
    
    try {
        // Check if department already exists
        const existingDepts = USE_DATABASE
            ? await dbOps.getDepartments()
            : departments;
        
        const existingDept = existingDepts.find(dept => 
            dept.name.toLowerCase() === data.name.trim().toLowerCase()
        );
        
        if (existingDept) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Department already exists' }));
            return;
        }
        
        if (USE_DATABASE) {
            // Add to database
            const departmentId = await dbOps.addDepartment(data.name.trim(), data.description ? data.description.trim() : null);
            
            const newDepartment = {
                id: departmentId,
                name: data.name.trim(),
                description: data.description ? data.description.trim() : '',
                created_at: new Date().toISOString(),
                created_by: session.email
            };
            
            console.log(`New department added by ${session.email}: ${newDepartment.name}`);
            
            res.writeHead(200);
            res.end(JSON.stringify({ 
                success: true, 
                data: newDepartment,
                message: 'Department added successfully'
            }));
        } else {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Database mode required for this operation' }));
        }
    } catch (error) {
        console.error('❌ Error adding department:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to add department' }));
    }
}

async function handleLeaveRequest(req, res, data) {
    const session = getSession(req);
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }

    try {
        const allEmployees = await dbOps.getAllEmployees();
        const employee = allEmployees.find(emp => emp.email === session.email);
        
        if (!employee) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Employee record not found' }));
            return;
        }

        // Check for duplicate/overlapping leave requests
        const { start_date, end_date } = data;
        if (start_date && end_date) {
            const requestStartDate = new Date(start_date);
            const requestEndDate = new Date(end_date);
            
            const allRequests = await dbOps.getLeaveRequests({ employee_id: employee.id });
            
            const overlappingRequests = allRequests.filter(leave => {
                // Only check pending or approved requests
                if (leave.status !== 'pending' && leave.status !== 'approved') return false;
                
                const existingStartDate = new Date(leave.start_date);
                const existingEndDate = new Date(leave.end_date);
                
                // Check for date overlap
                return (requestStartDate <= existingEndDate && requestEndDate >= existingStartDate);
            });

            if (overlappingRequests.length > 0) {
                const conflict = overlappingRequests[0];
                res.writeHead(400);
                res.end(JSON.stringify({ 
                    error: `You already have a ${conflict.status} leave request for overlapping dates (${conflict.start_date} to ${conflict.end_date}). Please choose different dates or cancel the existing request.`
                }));
                return;
            }
        }

        // Check leave balance validation
        const { days_requested } = data;
        if (days_requested && days_requested > 0) {
            // Calculate current leave balance
            const currentYear = new Date().getFullYear();
            const annualLeaveEntitlement = employee.annual_leave_days || 22;
            
            // Find all approved leave requests for current year
            const allRequests = await dbOps.getLeaveRequests({ employee_id: employee.id, status: 'approved' });
            
            const approvedLeaves = allRequests.filter(leave =>
                new Date(leave.start_date).getFullYear() === currentYear
            );
            
            // Calculate total days used
            const totalDaysUsed = approvedLeaves.reduce((total, leave) => {
                return total + (parseFloat(leave.days_requested) || 0);
            }, 0);
            
            // Calculate available days
            const availableDays = Math.max(0, annualLeaveEntitlement - totalDaysUsed);
            
            // Check if requested days exceed available balance
            if (days_requested > availableDays) {
                res.writeHead(400);
                res.end(JSON.stringify({ 
                    error: `Insufficient leave balance. You are requesting ${days_requested} days but only have ${availableDays} days available. Your annual entitlement is ${annualLeaveEntitlement} days and you have already used ${totalDaysUsed} days this year.`
                }));
                return;
            }
            
            console.log(`✅ Leave balance check passed: Requesting ${days_requested} days, Available: ${availableDays} days`);
        }

        // Add to database
        const requestData = {
                employee_id: employee.id,
                employee_name: buildEmployeeName(employee),
                leave_type: data.leave_type,
                leave_duration: data.leave_duration,
                start_date: data.start_date,
                end_date: data.end_date,
                reason: data.reason || null,
                days_requested: data.days_requested,
                created_by: session.email
            };
            
            const requestId = await dbOps.createLeaveRequest(requestData);
            
            const newRequest = {
                id: requestId,
                ...requestData,
                status: 'pending',
                created_at: new Date().toISOString().split('T')[0]
            };
            
            // Send notifications to managers and admins
            console.log(`📧 Sending notifications for leave request ID: ${newRequest.id}`);
            await sendLeaveRequestNotifications(newRequest, employee);
            
            console.log(`New leave request: ${newRequest.employee_name} - ${newRequest.leave_type}`);

            res.writeHead(200);
            res.end(JSON.stringify({ success: true, data: newRequest }));
    } catch (error) {
        console.error('❌ Error creating leave request:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to create leave request' }));
    }
}

async function handleGetLeaveRequests(req, res) {
    const session = getSession(req);
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }

    try {
        // Use database operations
        let filters = {};
        
        // Filter by role - employees can only see their own requests
        if (session.role === 'employee') {
            const allEmployees = await dbOps.getAllEmployees();
            const currentEmployee = allEmployees.find(emp => emp.email === session.email);
            filters.employee_id = currentEmployee ? currentEmployee.id : session.user_id;
        }
        
        const requests = await dbOps.getLeaveRequests(filters);
        
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: requests }));
    } catch (error) {
        console.error('Error fetching leave requests:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to fetch leave requests' }));
    }
}

async function handleUpdateLeaveRequest(req, res, pathname, data) {
    const session = getSession(req);
    if (!session || (session.role !== 'admin' && session.role !== 'manager')) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Access denied. Only admins and managers can approve/reject leave requests.' }));
        return;
    }

    try {
        const requestId = parseInt(pathname.split('/').pop());
        
        // Validate status
        const validStatuses = ['approved', 'rejected', 'cancelled'];
        if (!data.status || !validStatuses.includes(data.status)) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid status. Must be approved, rejected, or cancelled.' }));
            return;
        }
        
        // Add approval metadata
        const status = data.status;
        const notes = data.notes || null;
        const updatedBy = session.email;
        
        // Update leave request in database with transaction
        // This ensures leave update and notification creation both succeed or both fail
        await dbOps.updateLeaveRequestStatus(requestId, status, notes, updatedBy);
        
        // Fetch updated request to return
        const allRequests = await dbOps.getLeaveRequests({});
        const updatedRequest = allRequests.find(req => req.id === requestId);
        
        if (!updatedRequest) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Request not found' }));
            return;
        }
        
        console.log(`✅ Leave request updated by ${session.email}: ${requestId} - ${status}`);

        res.writeHead(200);
        res.end(JSON.stringify({ 
            success: true, 
            data: updatedRequest,
            message: `Leave request has been ${status} successfully`
        }));
    } catch (error) {
        console.error('❌ Error updating leave request:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to update leave request' }));
    }
}

async function handleAttendanceReport(req, res) {
    const session = getSession(req);
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }

    try {
        const parsedUrl = url.parse(req.url, true);
        const { start_date, end_date, department } = parsedUrl.query;

        let filters = {};
        
        // Filter by date range
        if (start_date && end_date) {
            filters.start_date = start_date;
            filters.end_date = end_date;
        }
        
        // Get all employees if needed for department filtering
        const allEmployees = USE_DATABASE ? await dbOps.getAllEmployees() : employees;

        // Role-based filtering
        if (session.role === 'employee') {
            const employee = allEmployees.find(emp => emp.email === session.email);
            if (employee) {
                filters.employee_id = employee.id;
            }
        }

        // Get records from database or file
        let filteredRecords = USE_DATABASE
            ? await dbOps.getAttendanceHistory(filters)
            : attendanceRecords.filter(record => {
                if (start_date && end_date) {
                    return record.date >= start_date && record.date <= end_date;
                }
                return true;
            });

        // Filter by department (client-side filtering)
        if (department) {
            const deptEmployees = allEmployees.filter(emp => emp.department === department);
            const deptEmployeeIds = deptEmployees.map(emp => emp.id);
            
            filteredRecords = filteredRecords.filter(record => 
                deptEmployeeIds.includes(record.employee_id)
            );
        }

        // Role-based filtering for file-based
        if (!USE_DATABASE && session.role === 'employee') {
            const employee = allEmployees.find(emp => emp.email === session.email);
            if (employee) {
                filteredRecords = filteredRecords.filter(record => record.employee_id === employee.id);
            }
        }

        // Sort by date (most recent first)
        filteredRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: filteredRecords }));
    } catch (error) {
        console.error('❌ Error fetching attendance report:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to fetch attendance report' }));
    }
}

async function handleLeaveReport(req, res) {
    const session = getSession(req);
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }

    try {
        const parsedUrl = url.parse(req.url, true);
        const { start_date, end_date, department } = parsedUrl.query;

        // Get all leave requests and employees
        const allRequests = USE_DATABASE ? await dbOps.getLeaveRequests({}) : leaveRequests;
        const allEmployees = USE_DATABASE ? await dbOps.getAllEmployees() : employees;
        
        let filteredRequests = [...allRequests];

        // Filter by date range (based on leave request creation date)
        if (start_date && end_date) {
            filteredRequests = filteredRequests.filter(request => {
                const requestDate = request.created_at.split('T')[0]; // Get date part only
                return requestDate >= start_date && requestDate <= end_date;
            });
        }

        // Filter by department
        if (department) {
            // Get employees from the specified department
            const deptEmployees = allEmployees.filter(emp => emp.department === department);
            const deptEmployeeIds = deptEmployees.map(emp => emp.id);
            
            filteredRequests = filteredRequests.filter(request => 
                deptEmployeeIds.includes(request.employee_id)
            );
        }

        // Role-based filtering
        if (session.role === 'employee') {
            const employee = allEmployees.find(emp => emp.email === session.email);
            if (employee) {
                filteredRequests = filteredRequests.filter(request => request.employee_id === employee.id);
            }
        }

        // Sort by creation date (most recent first)
        filteredRequests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: filteredRequests }));
    } catch (error) {
        console.error('❌ Error fetching leave report:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to fetch leave report' }));
    }
}

async function handleEmployeeReport(req, res) {
    const session = getSession(req);
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }

    try {
        const parsedUrl = url.parse(req.url, true);
        const { department } = parsedUrl.query;

        const allEmployees = USE_DATABASE ? await dbOps.getAllEmployees() : employees;
        let filteredEmployees = [...allEmployees];

        // Filter by department
        if (department) {
            filteredEmployees = filteredEmployees.filter(emp => emp.department === department);
        }

        // Role-based filtering
        if (session.role === 'employee') {
            filteredEmployees = filteredEmployees.filter(emp => emp.email === session.email);
        }

        // Sort by name
        filteredEmployees.sort((a, b) => buildEmployeeName(a).localeCompare(buildEmployeeName(b)));

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: filteredEmployees }));
    } catch (error) {
        console.error('❌ Error fetching employee report:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to fetch employee report' }));
    }
}

async function handleDepartmentReport(req, res) {
    const session = getSession(req);
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }

    try {
        // Get departments and employees from database
        const allDepartments = USE_DATABASE ? await dbOps.getDepartments() : departments;
        const allEmployees = USE_DATABASE ? await dbOps.getAllEmployees() : employees;

        // Get department statistics
        const departmentStats = await Promise.all(allDepartments.map(async dept => {
            const deptEmployees = allEmployees.filter(emp => emp.department === dept.name);
            const activeEmployees = deptEmployees.filter(emp => emp.status === 'active');
            
            // Calculate recent attendance for this department
            const recentDate = new Date();
            recentDate.setDate(recentDate.getDate() - 30); // Last 30 days
            const recentDateStr = recentDate.toISOString().split('T')[0];
            
            const deptEmployeeIds = deptEmployees.map(emp => emp.id);
            
            // Get attendance records
            const recentAttendance = USE_DATABASE
                ? await dbOps.getAttendanceHistory({ start_date: recentDateStr, end_date: new Date().toISOString().split('T')[0] })
                : attendanceRecords.filter(record => 
                    deptEmployeeIds.includes(record.employee_id) && record.date >= recentDateStr
                );
            
            // Filter by department employees
            const deptAttendance = recentAttendance.filter(record => 
                deptEmployeeIds.includes(record.employee_id)
            );
            
            const presentCount = deptAttendance.filter(r => r.status === 'present').length;
            const attendanceRate = deptAttendance.length > 0 ? 
                Math.round((presentCount / deptAttendance.length) * 100) : 0;

            return {
                ...dept,
                total_employees: deptEmployees.length,
                active_employees: activeEmployees.length,
                inactive_employees: deptEmployees.length - activeEmployees.length,
                attendance_rate: attendanceRate,
                recent_attendance_records: deptAttendance.length
            };
        }));

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: departmentStats }));
    } catch (error) {
        console.error('❌ Error fetching department report:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to fetch department report' }));
    }
}

async function handleChangePassword(req, res, data) {
    const session = getSession(req);
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }

    const { currentPassword, newPassword } = data;
    const userEmail = session.email;

    try {
        // Get user from database or file
        const user = USE_DATABASE
            ? await dbOps.getUserByEmail(userEmail)
            : users[userEmail];

        // Verify current password
        if (!user || user.password !== currentPassword) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Current password is incorrect' }));
            return;
        }

        // Update password
        await dbOps.updateUserPassword(userEmail, newPassword);
        
        console.log(`Password changed for user: ${userEmail}`);

        res.writeHead(200);
        res.end(JSON.stringify({ 
            success: true, 
            message: 'Password changed successfully' 
        }));
    } catch (error) {
        console.error('❌ Error changing password:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to change password' }));
    }
}

async function handleResetPassword(req, res, data) {
    const session = getSession(req);
    
    // Only admin and manager can reset passwords for other employees
    if (!session || (session.role !== 'admin' && session.role !== 'manager')) {
        res.writeHead(403);
        res.end(JSON.stringify({ 
            error: 'Access denied. Only administrators and managers can reset passwords.' 
        }));
        return;
    }

    const { targetEmail, newPassword } = data;
    
    // Validate input
    if (!targetEmail || !newPassword) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Target email and new password are required' }));
        return;
    }

    try {
        // Check if target user exists
        const targetUser = await dbOps.getUserByEmail(targetEmail);
        
        if (!targetUser) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'User not found' }));
            return;
        }

        // Additional access control: Managers cannot reset admin passwords
        if (session.role === 'manager' && targetUser.role === 'admin') {
            res.writeHead(403);
            res.end(JSON.stringify({ 
                error: 'Managers cannot reset administrator passwords' 
            }));
            return;
        }

        // Prevent users from resetting their own password through this endpoint
        if (targetEmail === session.email) {
            res.writeHead(400);
            res.end(JSON.stringify({ 
                error: 'Use change password feature to update your own password' 
            }));
            return;
        }

        // Use common password for reset
        const finalPassword = '123456';
        
        // Update password
        await dbOps.updateUserPassword(targetEmail, finalPassword);
        
        console.log(`Password reset by ${session.email} for user: ${targetEmail}`);

        res.writeHead(200);
        res.end(JSON.stringify({ 
            success: true, 
            message: 'Password reset successfully',
            newPassword: finalPassword,
            targetUser: targetEmail
        }));
    } catch (error) {
        console.error('❌ Error resetting password:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to reset password' }));
    }
}

async function handleUpdateEmployee(req, res, pathname, data) {
    const session = getSession(req);
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }

    try {
        // Check if employeeOps module is available
        if (!employeeOps) {
            res.writeHead(503);
            res.end(JSON.stringify({ error: 'Employee operations not available' }));
            return;
        }

        const employeeId = parseInt(pathname.split('/').pop());
        
        // Get employee from database using parameterized query
        const targetEmployee = await employeeOps.getEmployeeById(employeeId);

        if (!targetEmployee) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Employee not found' }));
            return;
        }

        // Strict role-based access control
        if (session.role === 'employee') {
            // Employees can ONLY edit their own profile and ONLY specific fields
            if (targetEmployee.email !== session.email) {
                res.writeHead(403);
                res.end(JSON.stringify({ 
                    error: 'Access denied: You can only edit your own profile' 
                }));
                return;
            }
            
            // Employees can only edit very limited fields
            const allowedFields = ['phone'];
            const filteredData = {};
            allowedFields.forEach(field => {
                if (data[field] !== undefined) {
                    filteredData[field] = data[field];
                }
            });
            
            if (Object.keys(filteredData).length === 0) {
                res.writeHead(403);
                res.end(JSON.stringify({ 
                    error: 'You can only update your phone number' 
                }));
                return;
            }
            
            data = filteredData;
        } else if (session.role === 'manager') {
            // Managers can edit most fields but NOT sensitive ones
            const restrictedFields = ['annual_leave_days', 'employee_id', 'start_date', 'status'];
            restrictedFields.forEach(field => {
                if (data[field] !== undefined) {
                    delete data[field];
                }
            });
            
            // Managers cannot edit other managers or admins
            const targetUser = await dbOps.getUserByEmail(targetEmployee.email);
                
            if (targetUser && (targetUser.role === 'admin' || targetUser.role === 'manager')) {
                res.writeHead(403);
                res.end(JSON.stringify({ 
                    error: 'Managers cannot edit other managers or administrators' 
                }));
                return;
            }
        }
        // Admins can edit all fields

        // Handle role updates (admin only)
        if (data.role && session.role === 'admin') {
            // Role updates will be handled separately
            delete data.role; // Remove from employee data as it's stored in users table
        }

        // Add update metadata
        data.updated_at = new Date().toISOString();
        data.updated_by = session.email;

        // Update employee data using parameterized UPDATE query (Requirement 4.5)
        // Returns true if update successful
        const updateSuccess = await employeeOps.updateEmployee(employeeId, data);
        
        if (!updateSuccess) {
            console.warn(`⚠️ Update returned false for employee ${employeeId} - no rows affected`);
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Failed to update employee - no changes applied' }));
            return;
        }
        
        // Fetch updated employee to return in response
        const updatedEmployee = await employeeOps.getEmployeeById(employeeId);
        
        console.log(`✅ Employee updated by ${session.email}: ${buildEmployeeName(updatedEmployee)}`);
        
        res.writeHead(200);
        res.end(JSON.stringify({ 
            success: true, 
            data: updatedEmployee,
            message: 'Employee updated successfully' 
        }));
    } catch (error) {
        // Handle database errors with appropriate HTTP status codes
        // Requirement 4.14, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7: 
        // Distinguish error types, use appropriate status codes, log without exposing details
        
        console.error('❌ Error updating employee:', {
            code: error.code,
            category: error.errorCategory,
            message: error.message,
            sqlState: error.sqlState
        });
        
        // Use error categorization from database module if available
        if (error.statusCode && error.clientMessage) {
            res.writeHead(error.statusCode);
            res.end(JSON.stringify({ error: error.clientMessage }));
        } else {
            // Fallback to generic error (should not reach here if database module is working)
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to update employee. Please try again.' }));
        }
    }
}

async function handleDeleteEmployee(req, res, pathname) {
    const session = getSession(req);
    
    // ONLY ADMIN can delete employees
    if (!session || session.role !== 'admin') {
        res.writeHead(403);
        res.end(JSON.stringify({ 
            error: 'Access denied. Only administrators can remove employees.' 
        }));
        return;
    }

    try {
        const employeeId = parseInt(pathname.split('/').pop());
        
        // Get employee from database
        const targetEmployee = await dbOps.getEmployeeById(employeeId);

        if (!targetEmployee) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Employee not found' }));
            return;
        }

        // Prevent admin from deleting their own account
        if (targetEmployee.email === session.email) {
            res.writeHead(400);
            res.end(JSON.stringify({ 
                error: 'You cannot delete your own account' 
            }));
            return;
        }

        // Store employee info for logging before deletion
        const deletedEmployee = { ...targetEmployee };

        // Use database soft delete (sets status='inactive')
        // This also deactivates the user record within a transaction
        // Requirements: 4.2, 4.6, 5.4
        await dbOps.deleteEmployee(employeeId);

        console.log(`✅ Employee deleted by ${session.email}: ${deletedEmployee.first_name} ${deletedEmployee.last_name} (${deletedEmployee.email})`);

        res.writeHead(200);
        res.end(JSON.stringify({ 
            success: true, 
            message: `Employee ${deletedEmployee.first_name} ${deletedEmployee.last_name} has been removed successfully`,
            deletedEmployee: {
                name: `${deletedEmployee.first_name} ${deletedEmployee.last_name || ''}`.trim(),
                email: deletedEmployee.email,
                employee_id: deletedEmployee.employee_id
            }
        }));
    } catch (error) {
        // Handle specific database errors with appropriate HTTP status codes
        // Requirement 4.14: Distinguish between connection, syntax, constraint violation, and timeout errors
        const errorCategory = categorizeError(error);
        
        // Log error with appropriate level
        if (errorCategory.shouldLog) {
            console.error(`❌ Error deleting employee (${errorCategory.errorCategory}):`, {
                code: error.code,
                message: error.message,
                details: errorCategory.details
            });
        } else {
            console.warn(`⚠️ Expected error deleting employee (${errorCategory.errorCategory}):`, error.message);
        }
        
        // Return 500 status if database connection fails (Requirement 5.4)
        res.writeHead(errorCategory.statusCode);
        res.end(JSON.stringify({ error: errorCategory.clientMessage }));
    }
}

// PDF Export Handler
async function handlePDFExport(req, res, data) {
    const session = getSession(req);
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }

    const { reportType, dateRange } = data;
    let reportData = [];
    let reportTitle = '';

    try {
        if (reportType === 'attendance') {
            reportData = USE_DATABASE ? await dbOps.getAttendanceHistory({}) : attendanceRecords;
            reportTitle = 'Attendance Report';
        } else if (reportType === 'employees') {
            reportData = USE_DATABASE ? await dbOps.getAllEmployees() : employees;
            reportTitle = 'Employee Report';
        } else if (reportType === 'leave') {
            reportData = USE_DATABASE ? await dbOps.getLeaveRequests({}) : leaveRequests;
            reportTitle = 'Leave Report';
        }

        // Generate HTML for PDF conversion
        const htmlContent = generateReportHTML(reportTitle, reportData, reportType);
        
        res.writeHead(200, { 
            'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ 
            success: true, 
            html: htmlContent,
            filename: `${reportType}_report_${new Date().toISOString().split('T')[0]}.pdf`
        }));
    } catch (error) {
        console.error('❌ Error generating PDF report:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to generate PDF report' }));
    }
}

async function handleExcelExport(req, res, data) {
    const session = getSession(req);
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }

    const { reportType } = data;
    let reportData = [];

    try {
        if (reportType === 'attendance') {
            reportData = USE_DATABASE ? await dbOps.getAttendanceHistory({}) : attendanceRecords;
        } else if (reportType === 'employees') {
            reportData = USE_DATABASE ? await dbOps.getAllEmployees() : employees;
        } else if (reportType === 'leave') {
            reportData = USE_DATABASE ? await dbOps.getLeaveRequests({}) : leaveRequests;
        }

        // Generate CSV data (Excel-compatible)
        const csvContent = generateCSV(reportData, reportType);
        
        res.writeHead(200, { 
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${reportType}_report_${new Date().toISOString().split('T')[0]}.csv"`
        });
        res.end(csvContent);
    } catch (error) {
        console.error('❌ Error generating Excel report:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to generate Excel report' }));
    }
}

// Generate HTML for PDF reports
function generateReportHTML(title, data, type) {
    let tableHeaders = '';
    let tableRows = '';

    if (type === 'attendance') {
        tableHeaders = '<th>Employee</th><th>Date</th><th>Morning Check-in</th><th>Morning Check-out</th><th>Afternoon Check-in</th><th>Afternoon Check-out</th><th>Total Hours</th><th>Status</th>';
        tableRows = data.map(record => `
            <tr>
                <td>${record.employee_name}</td>
                <td>${record.date}</td>
                <td>${record.morning_checkin || '-'}</td>
                <td>${record.morning_checkout || '-'}</td>
                <td>${record.afternoon_checkin || '-'}</td>
                <td>${record.afternoon_checkout || '-'}</td>
                <td>${record.total_hours || 0}</td>
                <td>${record.status}</td>
            </tr>
        `).join('');
    } else if (type === 'employees') {
        tableHeaders = '<th>Employee ID</th><th>Name</th><th>Email</th><th>Department</th><th>Job Title</th><th>Start Date</th><th>Status</th>';
        tableRows = data.map(emp => `
            <tr>
                <td>${emp.employee_id}</td>
                <td>${buildEmployeeName(emp)}</td>
                <td>${emp.email}</td>
                <td>${emp.department}</td>
                <td>${emp.job_title}</td>
                <td>${emp.start_date}</td>
                <td>${emp.status}</td>
            </tr>
        `).join('');
    } else if (type === 'leave') {
        tableHeaders = '<th>Employee</th><th>Leave Type</th><th>Start Date</th><th>End Date</th><th>Days</th><th>Reason</th><th>Status</th>';
        tableRows = data.map(leave => `
            <tr>
                <td>${leave.employee_name}</td>
                <td>${leave.leave_type}</td>
                <td>${leave.start_date}</td>
                <td>${leave.end_date}</td>
                <td>${leave.days_requested}</td>
                <td>${leave.reason}</td>
                <td>${leave.status}</td>
            </tr>
        `).join('');
    }

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #333; text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; font-weight: bold; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                .report-info { margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            <div class="report-info">
                <p><strong>Generated on:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>Total Records:</strong> ${data.length}</p>
            </div>
            <table>
                <thead>
                    <tr>${tableHeaders}</tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </body>
        </html>
    `;
}

// Generate CSV for Excel export
function generateCSV(data, type) {
    let headers = [];
    let rows = [];

    if (type === 'attendance') {
        headers = ['Employee', 'Date', 'Morning Check-in', 'Morning Check-out', 'Afternoon Check-in', 'Afternoon Check-out', 'Total Hours', 'Status'];
        rows = data.map(record => [
            record.employee_name,
            record.date,
            record.morning_checkin || '',
            record.morning_checkout || '',
            record.afternoon_checkin || '',
            record.afternoon_checkout || '',
            record.total_hours || 0,
            record.status
        ]);
    } else if (type === 'employees') {
        headers = ['Employee ID', 'First Name', 'Last Name', 'Email', 'Department', 'Job Title', 'Start Date', 'Status'];
        rows = data.map(emp => [
            emp.employee_id,
            emp.first_name,
            emp.last_name,
            emp.email,
            emp.department,
            emp.job_title,
            emp.start_date,
            emp.status
        ]);
    } else if (type === 'leave') {
        headers = ['Employee', 'Leave Type', 'Start Date', 'End Date', 'Days Requested', 'Reason', 'Status'];
        rows = data.map(leave => [
            leave.employee_name,
            leave.leave_type,
            leave.start_date,
            leave.end_date,
            leave.days_requested,
            leave.reason,
            leave.status
        ]);
    }

    const csvContent = [headers.join(','), ...rows.map(row => row.map(field => `"${field}"`).join(','))].join('\n');
    return csvContent;
}

async function handleGetLeaveBalance(req, res) {
    const session = getSession(req);
    
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }
    
    try {
        // Find the current user's employee record
        const allEmployees = USE_DATABASE ? await dbOps.getAllEmployees() : employees;
        const employee = allEmployees.find(emp => emp.email === session.email);
        
        if (!employee) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Employee record not found' }));
            return;
        }
        
        // Calculate leave balance
        const currentYear = new Date().getFullYear();
        const annualLeaveEntitlement = employee.annual_leave_days || 22;
        
        // Find all approved leave requests for current year
        const allLeaveRequests = USE_DATABASE 
            ? await dbOps.getLeaveRequests({ employee_id: employee.id, status: 'approved' })
            : leaveRequests.filter(leave => 
                leave.employee_id === employee.id && 
                leave.status === 'approved'
            );
        
        const approvedLeaves = allLeaveRequests.filter(leave =>
            new Date(leave.start_date).getFullYear() === currentYear
        );
        
        // Calculate total days used (including half-day leaves)
        const totalDaysUsed = approvedLeaves.reduce((total, leave) => {
            return total + (parseFloat(leave.days_requested) || 0);
        }, 0);
        
        // Calculate pending leave requests for current year
        const allPendingRequests = USE_DATABASE
            ? await dbOps.getLeaveRequests({ employee_id: employee.id, status: 'pending' })
            : leaveRequests.filter(leave => 
                leave.employee_id === employee.id && 
                leave.status === 'pending'
            );
        
        const pendingLeaves = allPendingRequests.filter(leave =>
            new Date(leave.start_date).getFullYear() === currentYear
        );
        
        const totalPendingDays = pendingLeaves.reduce((total, leave) => {
            return total + (parseFloat(leave.days_requested) || 0);
        }, 0);
        
        const leaveBalance = {
            annual_entitlement: annualLeaveEntitlement,
            days_used: totalDaysUsed,
            days_pending: totalPendingDays,
            days_available: Math.max(0, annualLeaveEntitlement - totalDaysUsed),
            current_year: currentYear,
            employee_name: buildEmployeeName(employee),
            leave_start_year: employee.leave_start_year || currentYear
        };
        
        res.writeHead(200);
        res.end(JSON.stringify({ 
            success: true, 
            data: leaveBalance 
        }));
    } catch (error) {
        console.error('❌ Error fetching leave balance:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to fetch leave balance' }));
    }
}

// Function to send notifications for new leave requests
async function sendLeaveRequestNotifications(leaveRequest, employee) {
    try {
        console.log(`🔍 Looking for managers and admins...`);
        
        if (USE_DATABASE) {
            // In database mode, we need to get all users
            // For now, use the file-based users as a fallback
            // TODO: Add dbOps.getAllUsers() if needed
            const managersAndAdmins = Object.entries(users).filter(([email, user]) => {
                return user.role === 'manager' || user.role === 'admin';
            });

            console.log(`✅ Found ${managersAndAdmins.length} managers and admins for notifications`);
            
            // Create notification for each manager and admin
            for (const [email, user] of managersAndAdmins) {
                const notificationData = {
                    type: 'leave_request',
                    title: 'New Leave Request',
                    message: `${leaveRequest.employee_name} has submitted a new ${leaveRequest.leave_type} request for ${leaveRequest.days_requested} day(s) from ${leaveRequest.start_date} to ${leaveRequest.end_date}.`,
                    recipient_email: email,
                    sender_email: leaveRequest.created_by,
                    related_id: leaveRequest.id,
                    related_type: 'leave_request',
                    priority: 'normal'
                };
                
                const notificationId = await dbOps.createNotification(notificationData);
                console.log(`✅ Leave request notification created (ID: ${notificationId}) for ${email}`);
            }
        } else {
            // File-based mode
            console.log(`Total users: ${Object.keys(users).length}`);
            
            // Find all managers and admins
            const managersAndAdmins = Object.entries(users).filter(([email, user]) => {
                console.log(`User ${email}: role = ${user.role}`);
                return user.role === 'manager' || user.role === 'admin';
            });

            console.log(`✅ Found ${managersAndAdmins.length} managers and admins for notifications:`, managersAndAdmins.map(([email]) => email));
            
            // Create notification for each manager and admin
            managersAndAdmins.forEach(([email, user]) => {
                const maxId = notifications.length > 0 ? Math.max(...notifications.map(n => n.id)) : 0;
                const newId = maxId + 1;
                
                const notification = {
                    id: newId,
                    type: 'leave_request',
                    title: 'New Leave Request',
                    message: `${leaveRequest.employee_name} has submitted a new ${leaveRequest.leave_type} request for ${leaveRequest.days_requested} day(s) from ${leaveRequest.start_date} to ${leaveRequest.end_date}.`,
                    recipient_email: email,
                    sender_email: leaveRequest.created_by,
                    related_id: leaveRequest.id,
                    related_type: 'leave_request',
                    is_read: false,
                    is_viewed: false,
                    created_at: new Date().toISOString(),
                    priority: 'normal'
                };
                
                notifications.push(notification);
                console.log(`✅ Leave request notification created (ID: ${newId}) for ${email}: ${notification.title}`);
            });
        }
    } catch (error) {
        console.error('Error sending leave request notifications:', error);
    }
}

// Function to send notifications when leave request status changes
async function sendLeaveStatusNotification(leaveRequest, approverEmail, newStatus) {
    try {
        // Find the employee who made the request
        const allEmployees = await dbOps.getAllEmployees();
        const employee = allEmployees.find(emp => emp.id === leaveRequest.employee_id);
        if (!employee) return;
        
        let title, message;
        if (newStatus === 'approved') {
            title = 'Leave Request Approved';
            message = `Your ${leaveRequest.leave_type} request for ${leaveRequest.days_requested} day(s) from ${leaveRequest.start_date} to ${leaveRequest.end_date} has been approved.`;
        } else if (newStatus === 'rejected') {
            title = 'Leave Request Rejected';
            message = `Your ${leaveRequest.leave_type} request for ${leaveRequest.days_requested} day(s) from ${leaveRequest.start_date} to ${leaveRequest.end_date} has been rejected.`;
            if (leaveRequest.notes) {
                message += ` Reason: ${leaveRequest.notes}`;
            }
        } else {
            return; // Don't send notification for other status changes
        }
        
        const notificationData = {
            type: 'leave_status',
            title: title,
            message: message,
            recipient_email: employee.email,
            sender_email: approverEmail,
            related_id: leaveRequest.id,
            related_type: 'leave_request',
            priority: newStatus === 'rejected' ? 'high' : 'normal'
        };
        
        await dbOps.createNotification(notificationData);
        console.log(`Leave status notification sent to ${employee.email}: ${title}`);
        
    } catch (error) {
        console.error('Error sending leave status notification:', error);
    }
}

// Notification handlers
async function handleGetNotifications(req, res) {
    const session = getSession(req);
    
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }
    
    try {
        // Get notifications from database with proper ordering
        const userNotifications = await dbOps.getNotifications(session.email, 50);
        
        res.writeHead(200);
        res.end(JSON.stringify({ 
            success: true, 
            data: userNotifications 
        }));
    } catch (error) {
        console.error('❌ Error fetching notifications:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to fetch notifications' }));
    }
}

async function handleSendNotification(req, res, data) {
    const session = getSession(req);
    
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }
    
    const { type, title, message, recipient_email, violation_data } = data;
    
    // Validate required fields
    if (!type || !title || !message || !recipient_email) {
        res.writeHead(400);
        res.end(JSON.stringify({ 
            error: 'Type, title, message, and recipient_email are required' 
        }));
        return;
    }
    
    try {
        const senderName = await getSenderName(session.email);
        
        if (USE_DATABASE) {
            // Add to database
            const notificationData = {
                type: type,
                title: title,
                message: message,
                recipient_email: recipient_email,
                sender_email: session.email,
                related_id: violation_data?.id || null,
                related_type: violation_data ? 'violation' : null,
                priority: 'normal'
            };
            
            const notificationId = await dbOps.createNotification(notificationData);
            
            const notification = {
                id: notificationId,
                ...notificationData,
                sender_name: senderName,
                violation_data: violation_data || null,
                is_read: false,
                is_viewed: false,
                created_at: new Date().toISOString(),
                read_at: null,
                viewed_at: null
            };
            
            console.log(`Notification sent from ${session.email} to ${recipient_email}: ${title}`);
            
            res.writeHead(200);
            res.end(JSON.stringify({ 
                success: true, 
                data: notification,
                message: 'Notification sent successfully'
            }));
        } else {
            // Fallback to file-based operations
            const maxId = notifications.length > 0 ? Math.max(...notifications.map(n => n.id)) : 0;
            const notification = {
                id: maxId + 1,
                type: type,
                title: title,
                message: message,
                sender_email: session.email,
                sender_name: senderName,
                recipient_email: recipient_email,
                violation_data: violation_data || null,
                is_read: false,
                is_viewed: false,
                created_at: new Date().toISOString(),
                read_at: null,
                viewed_at: null
            };
            
            notifications.push(notification);
            
            // Save data
            saveData();
            
            console.log(`Notification sent from ${session.email} to ${recipient_email}: ${title}`);
            
            res.writeHead(200);
            res.end(JSON.stringify({ 
                success: true, 
                data: notification,
                message: 'Notification sent successfully'
            }));
        }
    } catch (error) {
        console.error('❌ Error sending notification:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to send notification' }));
    }
}

async function handleMarkNotificationRead(req, res, pathname) {
    const session = getSession(req);
    
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }
    
    try {
        const notificationId = parseInt(pathname.split('/').pop());
        
        // Update in database
        const success = await dbOps.markNotificationRead(notificationId);
        
        if (!success) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Notification not found' }));
            return;
        }
        
        // Fetch all user notifications to get the updated one
        const userNotifications = await dbOps.getNotifications(session.email);
        const notification = userNotifications.find(n => n.id === notificationId);
        
        res.writeHead(200);
        res.end(JSON.stringify({ 
            success: true, 
            data: notification
        }));
    } catch (error) {
        console.error('❌ Error marking notification as read:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to mark notification as read' }));
    }
}

async function handleMarkNotificationsViewed(req, res) {
    const session = getSession(req);
    
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }
    
    try {
        // Mark all unviewed notifications for this user as viewed
        let viewedCount = 0;
        
        if (USE_DATABASE) {
            viewedCount = await dbOps.markNotificationsViewed(session.email);
        } else {
            notifications.forEach(notification => {
                if (notification.recipient_email === session.email && !notification.is_viewed) {
                    notification.is_viewed = true;
                    notification.viewed_at = new Date().toISOString();
                    viewedCount++;
                }
            });
            
            // Save data
            saveData();
        }
        
        console.log(`Marked ${viewedCount} notifications as viewed for ${session.email}`);
        
        res.writeHead(200);
        res.end(JSON.stringify({ 
            success: true, 
            viewed_count: viewedCount,
            message: `${viewedCount} notifications marked as viewed`
        }));
    } catch (error) {
        console.error('❌ Error marking notifications as viewed:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to mark notifications as viewed' }));
    }
}

async function getSenderName(email) {
    if (USE_DATABASE) {
        const allEmployees = await dbOps.getAllEmployees();
        const employee = allEmployees.find(emp => emp.email === email);
        if (employee) {
            return buildEmployeeName(employee);
        }
    } else {
        const employee = employees.find(emp => emp.email === email);
        if (employee) {
            return buildEmployeeName(employee);
        }
    }
    return email;
}

// Configuration management handlers
function handleGetConfig(req, res) {
    const session = getSession(req);
    
    // Only admin can view configuration
    if (!session || session.role !== 'admin') {
        res.writeHead(403);
        res.end(JSON.stringify({ 
            error: 'Access denied. Only administrators can view system configuration.' 
        }));
        return;
    }
    
    res.writeHead(200);
    res.end(JSON.stringify({ 
        success: true, 
        data: {
            server: SERVER_CONFIG,
            system: config.system || {},
            features: config.features || {}
        }
    }));
}

function handleUpdateConfig(req, res, data) {
    const session = getSession(req);
    
    // Only admin can update configuration
    if (!session || session.role !== 'admin') {
        res.writeHead(403);
        res.end(JSON.stringify({ 
            error: 'Access denied. Only administrators can update system configuration.' 
        }));
        return;
    }
    
    try {
        // Validate configuration data
        const { server, system, features } = data;
        
        if (server) {
            // Validate server configuration
            if (server.port && (isNaN(server.port) || server.port < 1 || server.port > 65535)) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Port must be a number between 1 and 65535' }));
                return;
            }
            
            if (server.host && typeof server.host !== 'string') {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Host must be a valid string' }));
                return;
            }
        }
        
        // Update configuration
        const newConfig = {
            ...config,
            server: { ...config.server, ...server },
            system: { ...config.system, ...system },
            features: { ...config.features, ...features },
            updated_at: new Date().toISOString(),
            updated_by: session.email
        };
        
        // Save configuration to file
        fs.writeFileSync('config.json', JSON.stringify(newConfig, null, 2));
        
        console.log(`Configuration updated by ${session.email}`);
        
        res.writeHead(200);
        res.end(JSON.stringify({ 
            success: true, 
            message: 'Configuration updated successfully. Please restart the server for changes to take effect.',
            data: newConfig,
            requiresRestart: true
        }));
        
    } catch (error) {
        console.error('Error updating configuration:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ 
            error: 'Failed to update configuration',
            message: error.message 
        }));
    }
}

async function handleBackupDownload(req, res) {
    const session = getSession(req);
    
    // Only admin can download backups
    if (!session || session.role !== 'admin') {
        res.writeHead(403);
        res.end(JSON.stringify({ 
            error: 'Access denied. Only administrators can download system backups.' 
        }));
        return;
    }
    
    try {
        // Get data from database or file
        const allEmployees = USE_DATABASE ? await dbOps.getAllEmployees() : employees;
        const allDepartments = USE_DATABASE ? await dbOps.getDepartments() : departments;
        const allLeaveRequests = USE_DATABASE ? await dbOps.getLeaveRequests({}) : leaveRequests;
        const allAttendanceRecords = USE_DATABASE ? await dbOps.getAttendanceHistory({}) : attendanceRecords;
        const allNotifications = USE_DATABASE ? [] : (notifications || []); // Notifications from file only
        
        // Create comprehensive backup data
        const backupData = {
            metadata: {
                backup_date: new Date().toISOString(),
                backup_by: session.email,
                system_version: '1.0.0',
                total_employees: allEmployees.length,
                total_users: USE_DATABASE ? 0 : Object.keys(users).length,
                total_departments: allDepartments.length,
                total_leave_requests: allLeaveRequests.length,
                total_attendance_records: allAttendanceRecords.length,
                data_source: USE_DATABASE ? 'MySQL Database' : 'JSON File'
            },
            employees: allEmployees,
            users: USE_DATABASE ? {} : users,
            departments: allDepartments,
            leaveRequests: allLeaveRequests,
            attendanceRecords: allAttendanceRecords,
            attendancePolicy: global.attendancePolicy,
            notifications: allNotifications
        };
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                         new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
        const filename = `EMS_Backup_${timestamp}.json`;
        
        // Set headers for file download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', Buffer.byteLength(JSON.stringify(backupData, null, 2)));
        
        // Log backup activity
        console.log(`System backup downloaded by ${session.email} at ${new Date().toISOString()}`);
        
        res.writeHead(200);
        res.end(JSON.stringify(backupData, null, 2));
        
    } catch (error) {
        console.error('❌ Backup download error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ 
            error: 'Failed to create backup',
            message: error.message 
        }));
    }
}

async function handleBackupDownloadExcel(req, res) {
    const session = getSession(req);
    
    // Only admin can download backups
    if (!session || session.role !== 'admin') {
        res.writeHead(403);
        res.end(JSON.stringify({ 
            error: 'Access denied. Only administrators can download system backups.' 
        }));
        return;
    }
    
    try {
        // Get data from database or file
        const allEmployees = USE_DATABASE ? await dbOps.getAllEmployees() : employees;
        const allDepartments = USE_DATABASE ? await dbOps.getDepartments() : departments;
        const allLeaveRequests = USE_DATABASE ? await dbOps.getLeaveRequests({}) : leaveRequests;
        const allAttendanceRecords = USE_DATABASE ? await dbOps.getAttendanceHistory({}) : attendanceRecords;
        
        // Create Excel-style CSV data for each table
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                         new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
        
        // Helper function to escape CSV values
        function escapeCSV(value) {
            if (value === null || value === undefined) return '';
            const str = String(value);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        }
        
        // Helper function to convert array of objects to CSV
        function arrayToCSV(data, headers) {
            if (!data || data.length === 0) return headers.join(',') + '\n';
            
            const csvRows = [headers.join(',')];
            
            data.forEach(row => {
                const values = headers.map(header => {
                    const value = row[header] || '';
                    return escapeCSV(value);
                });
                csvRows.push(values.join(','));
            });
            
            return csvRows.join('\n');
        }
        
        // Create comprehensive backup data in Excel-compatible format
        let excelContent = '';
        
        // Metadata Sheet
        excelContent += '=== BACKUP METADATA ===\n';
        excelContent += `Backup Date,${new Date().toISOString()}\n`;
        excelContent += `Backup By,${session.email}\n`;
        excelContent += `System Version,1.0.0\n`;
        excelContent += `Total Employees,${allEmployees.length}\n`;
        excelContent += `Total Users,${USE_DATABASE ? 0 : Object.keys(users).length}\n`;
        excelContent += `Total Departments,${allDepartments.length}\n`;
        excelContent += `Total Leave Requests,${allLeaveRequests.length}\n`;
        excelContent += `Total Attendance Records,${allAttendanceRecords.length}\n`;
        excelContent += `Data Source,${USE_DATABASE ? 'MySQL Database' : 'JSON File'}\n\n`;
        
        // Employees Sheet
        excelContent += '=== EMPLOYEES ===\n';
        const employeeHeaders = ['id', 'employee_id', 'first_name', 'father_name', 'gfather_name', 'email', 'department', 'job_title', 'salary', 'start_date', 'status', 'annual_leave_days'];
        excelContent += arrayToCSV(allEmployees, employeeHeaders) + '\n\n';
        
        // Users Sheet (file-based only)
        if (!USE_DATABASE) {
            excelContent += '=== USERS ===\n';
            const usersArray = Object.entries(users).map(([email, userData]) => ({
                email: email,
                id: userData.id,
                role: userData.role,
                password: '***HIDDEN***' // Don't export actual passwords
            }));
            const userHeaders = ['email', 'id', 'role', 'password'];
            excelContent += arrayToCSV(usersArray, userHeaders) + '\n\n';
        }
        
        // Departments Sheet
        excelContent += '=== DEPARTMENTS ===\n';
        const departmentHeaders = ['id', 'name', 'description'];
        excelContent += arrayToCSV(allDepartments, departmentHeaders) + '\n\n';
        
        // Leave Requests Sheet
        excelContent += '=== LEAVE REQUESTS ===\n';
        const leaveHeaders = ['id', 'employee_id', 'employee_name', 'leave_type', 'start_date', 'end_date', 'days_requested', 'reason', 'status', 'created_at'];
        excelContent += arrayToCSV(allLeaveRequests, leaveHeaders) + '\n\n';
        
        // Attendance Records Sheet
        excelContent += '=== ATTENDANCE RECORDS ===\n';
        const attendanceHeaders = ['id', 'employee_id', 'employee_name', 'date', 'morning_checkin', 'morning_checkout', 'afternoon_checkin', 'afternoon_checkout', 'total_hours', 'status'];
        excelContent += arrayToCSV(allAttendanceRecords, attendanceHeaders) + '\n\n';
        
        // Attendance Policy Sheet
        excelContent += '=== ATTENDANCE POLICY ===\n';
        if (global.attendancePolicy) {
            const policyData = [global.attendancePolicy];
            const policyHeaders = ['morning_start', 'morning_end', 'afternoon_start', 'afternoon_end', 'late_tolerance', 'early_tolerance'];
            excelContent += arrayToCSV(policyData, policyHeaders) + '\n\n';
        }
        
        const filename = `EMS_Backup_${timestamp}.csv`;
        
        // Set headers for CSV download (Excel-compatible)
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', Buffer.byteLength(excelContent, 'utf8'));
        
        // Add BOM for Excel UTF-8 compatibility
        const bom = '\uFEFF';
        
        // Log backup activity
        console.log(`Excel backup downloaded by ${session.email} at ${new Date().toISOString()}`);
        
        res.writeHead(200);
        res.end(bom + excelContent);
        
    } catch (error) {
        console.error('❌ Excel backup download error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ 
            error: 'Failed to create Excel backup',
            message: error.message 
        }));
    }
}

function handleTestConfig(req, res, data) {
    const session = getSession(req);
    
    // Only admin can test configuration
    if (!session || session.role !== 'admin') {
        res.writeHead(403);
        res.end(JSON.stringify({ 
            error: 'Access denied. Only administrators can test system configuration.' 
        }));
        return;
    }
    
    try {
        const { host, port } = data;
        
        // Basic validation
        const testResults = {
            host_valid: false,
            port_valid: false,
            port_available: false,
            network_accessible: false
        };
        
        // Validate host
        if (host && typeof host === 'string' && host.length > 0) {
            testResults.host_valid = true;
        }
        
        // Validate port
        if (port && !isNaN(port) && port >= 1 && port <= 65535) {
            testResults.port_valid = true;
        }
        
        // Test port availability (basic check)
        if (testResults.port_valid) {
            try {
                const testServer = http.createServer();
                testServer.listen(port, host, () => {
                    testResults.port_available = true;
                    testResults.network_accessible = true;
                    testServer.close();
                });
                
                testServer.on('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        testResults.port_available = false;
                    }
                    testServer.close();
                });
                
                // Close test server after a short delay
                setTimeout(() => {
                    testServer.close();
                }, 1000);
                
            } catch (error) {
                testResults.network_accessible = false;
            }
        }
        
        const allTestsPassed = Object.values(testResults).every(result => result === true);
        
        res.writeHead(200);
        res.end(JSON.stringify({ 
            success: true, 
            data: testResults,
            overall_status: allTestsPassed ? 'passed' : 'failed',
            message: allTestsPassed ? 'All configuration tests passed' : 'Some configuration tests failed'
        }));
        
    } catch (error) {
        console.error('Error testing configuration:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ 
            error: 'Failed to test configuration',
            message: error.message 
        }));
    }
}

// Handler for sending email reports
async function handleSendReport(req, res) {
    const session = getSession(req);
    
    // Only authenticated users can send reports
    if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
    }
    
    try {
        // Get today's date for the report
        const today = new Date().toISOString().split('T')[0];
        
        // Generate attendance summary
        const todayAttendance = attendanceRecords.filter(record => record.date === today);
        const totalPresent = todayAttendance.length;
        const totalEmployees = employees.length;
        
        // Create report text
        const reportText = `
Daily Attendance Report - ${today}

Total Employees: ${totalEmployees}
Present Today: ${totalPresent}
Absent: ${totalEmployees - totalPresent}

Recent Attendance Records:
${todayAttendance.slice(0, 5).map(record => 
    `- ${record.employee_name}: ${record.total_hours} hours`
).join('\n')}

This report was generated automatically by the Employee Management System.
        `.trim();
        
        // Send the email
        const result = await sendEmail(`Daily Attendance Report - ${today}`, reportText);
        
        if (result.success) {
            res.writeHead(200);
            res.end(JSON.stringify({ 
                success: true, 
                message: 'Email report sent successfully!' 
            }));
        } else {
            res.writeHead(500);
            res.end(JSON.stringify({ 
                success: false, 
                error: result.error,
                message: 'Failed to send email. Please check your email configuration.' 
            }));
        }
    } catch (error) {
        console.error('Error in handleSendReport:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ 
            success: false, 
            error: error.message 
        }));
    }
}

// Handler for recording user interactions
function handleAnalyticsInteraction(req, res, data) {
    try {
        // Extract session to get user_id
        const session = getSession(req);
        
        // Return 401 if no session
        if (!session || !session.user_id) {
            console.log('❌ Analytics interaction: No session or user_id');
            res.writeHead(401);
            res.end(JSON.stringify({
                success: false,
                message: 'Unauthorized'
            }));
            return;
        }
        
        // Extract required fields from request body
        const { page_name, interaction_type, element_id } = data;
        
        // Validate all required fields are present
        if (!page_name || !interaction_type || !element_id) {
            console.log('❌ Analytics interaction: Missing required fields');
            res.writeHead(400);
            res.end(JSON.stringify({
                success: false,
                message: 'Missing required fields: page_name, interaction_type, element_id'
            }));
            return;
        }
        
        // Validate interaction_type is one of the allowed types
        const validInteractionTypes = ['button_click', 'form_submission', 'dropdown_selection', 'tab_change'];
        if (!validInteractionTypes.includes(interaction_type)) {
            console.log(`❌ Analytics interaction: Invalid interaction_type: ${interaction_type}`);
            res.writeHead(400);
            res.end(JSON.stringify({
                success: false,
                message: 'Invalid interaction_type'
            }));
            return;
        }
        
        // Call Analytics_Repository.recordInteraction() with request body data
        try {
            if (analyticsRepo && analyticsRepo.recordInteraction) {
                analyticsRepo.recordInteraction(session.user_id, page_name, interaction_type, element_id);
                console.log(`✅ Analytics interaction recorded: user_id=${session.user_id}, page=${page_name}, type=${interaction_type}, element=${element_id}`);
            }
            
            // Return success response
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                message: 'Interaction recorded'
            }));
        } catch (error) {
            console.error('❌ Failed to record interaction:', error.message);
            res.writeHead(500);
            res.end(JSON.stringify({
                success: false,
                message: 'Failed to record interaction'
            }));
        }
    } catch (error) {
        console.error('❌ Error in handleAnalyticsInteraction:', error.message);
        res.writeHead(500);
        res.end(JSON.stringify({
            success: false,
            message: 'Internal server error'
        }));
    }
}

// Start server with configuration - UPDATED FOR CLOUD DEPLOYMENT
// When running on cloud platforms, SERVER_CONFIG.host will already be '0.0.0.0'
// For local, respect the allowExternalConnections setting
const serverHost = SERVER_CONFIG.host === '0.0.0.0' ? '0.0.0.0' : 
                   (SERVER_CONFIG.allowExternalConnections ? '0.0.0.0' : SERVER_CONFIG.host);

// Initialize database before starting server
async function startServer() {
    if (USE_DATABASE) {
        console.log('🔌 Initializing database connection...');
        const dbConnected = await initializeDatabase();
        
        if (dbConnected) {
            console.log('✅ Database connected successfully');
            
            // Call createTables to ensure schema exists
            try {
                console.log('📋 Creating database tables...');
                const pool = getPool();
                await createTables(pool);
                console.log('✅ All database tables are ready');
            } catch (error) {
                console.error('❌ Failed to create database tables:', error.message);
                
                // In production, exit on schema creation failure
                if (process.env.NODE_ENV === 'production') {
                    console.error('💥 PRODUCTION: Exiting due to schema initialization failure');
                    process.exit(1);
                } else {
                    console.warn('⚠️  DEVELOPMENT: Continuing despite schema creation failure');
                    console.warn('   Database operations may fail if tables are missing');
                }
            }
        } else {
            console.warn('⚠️  Database initialization failed, some features may not work');
            
            // In production, exit on connection failure
            if (process.env.NODE_ENV === 'production') {
                console.error('💥 PRODUCTION: Exiting due to database connection failure');
                process.exit(1);
            }
        }
    }
    
    // Start HTTP server - only reaches here if database initialization succeeded or was not required
    server.listen(SERVER_CONFIG.port, serverHost, () => {
        const isCloudPlatform = !!process.env.PORT;
        
        console.log('');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`🚀 Employee Management System running on http://${serverHost}:${SERVER_CONFIG.port}`);
        console.log(`📊 Data Mode: ${USE_DATABASE ? 'MySQL Database' : 'File-based (data.json)'}`);
        console.log('═══════════════════════════════════════════════════════════');
        
        // Start connection pool monitoring if using database
        if (USE_DATABASE) {
            try {
                const { startPoolMonitoring } = require('./db/connection');
                const monitor = startPoolMonitoring();
                // Store reference for graceful shutdown later if needed
                process.poolMonitor = monitor;
                console.log('✅ Connection pool monitoring started');
            } catch (error) {
                console.warn('⚠️  Failed to start connection pool monitoring:', error.message);
            }
        }
        
        if (isCloudPlatform) {
            console.log('☁️  Running in CLOUD/PRODUCTION mode');
            console.log(`✅ Server bound to ${serverHost}:${SERVER_CONFIG.port}`);
        } else {
            console.log(`🏠 Application: http://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}`);
            console.log('');
            console.log('Server Configuration:');
            console.log(`- Host: ${SERVER_CONFIG.host}`);
            console.log(`- Port: ${SERVER_CONFIG.port}`);
            console.log(`- External Access: ${SERVER_CONFIG.allowExternalConnections ? 'Enabled' : 'Disabled'}`);
            console.log(`- Binding to: ${serverHost}`);
            console.log(`- Database Mode: ${USE_DATABASE ? 'Enabled' : 'Disabled'}`);
            console.log('');
            console.log('Network Access URLs:');
            console.log(`- Local: http://localhost:${SERVER_CONFIG.port}`);
            console.log(`- Network: http://10.192.230.251:${SERVER_CONFIG.port}`);
            console.log('');
            console.log('Default Login Credentials:');
            console.log('- Admin: admin@company.com / admin123');
            console.log('- Manager: manager@company.com / manager123');
            console.log('- Employee: employee@company.com / employee123');
        }
        
        // Initialize Email_Scheduler for daily analytics emails
        try {
            if (emailScheduler && emailScheduler.initializeScheduler) {
                emailScheduler.initializeScheduler();
            }
        } catch (error) {
            console.error('⚠️  Failed to initialize Email_Scheduler:', error.message);
            console.error('   Daily analytics emails will not be sent.');
        }
        
        console.log('✅ Server is ready to accept requests');
    });
}

// Start the server
startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});

module.exports = server;