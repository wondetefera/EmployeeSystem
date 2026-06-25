# Design Document

## Overview

The Daily Analytics Email Notifications feature adds automated analytics tracking and daily email reporting to the Employee Management System. The system captures page visits and user interactions across all tracked pages, stores analytics data in the existing data.json file, and sends daily email reports to administrators at a configured time.

### Design Principles

1. **Minimal Invasiveness**: Integrate with existing server architecture using middleware pattern for analytics tracking
2. **JSON Storage**: Leverage existing data.json persistence layer to store analytics data alongside other system data
3. **Scheduled Automation**: Use Node.js scheduling to trigger daily email generation and delivery
4. **HTML Email Reports**: Generate professional HTML-formatted emails with clear data visualization
5. **Error Resilience**: Handle missing configuration and SMTP errors gracefully with appropriate logging

## Architecture

### System Context

The feature integrates into the existing simple-server.js Node.js HTTP server:

- **Analytics Middleware**: Intercepts all HTTP requests to track page visits
- **Interaction API Endpoints**: New endpoints to receive client-side interaction tracking
- **Email Scheduler**: Background process that triggers daily at configured time
- **SMTP Integration**: Uses nodemailer for email delivery via configured SMTP server

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      HTTP Request Flow                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │ Analytics_Middleware  │
                  │  - Track page visits  │
                  │  - Extract session    │
                  └───────────┬───────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │ Analytics_Repository  │
                  │  - Store visit data   │
                  │  - Store interactions │
                  │  - Aggregate stats    │
                  └───────────┬───────────┘
                              │
                              ▼
                     ┌────────────────┐
                     │   data.json    │
                     │  { analytics:  │
                     │    { visits,   │
                     │  interactions }}│
                     └────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Client-Side Interaction Tracking              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────────┐
              │  POST /api/analytics/interaction  │
              └───────────────┬───────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │ Analytics_Repository  │
                  └───────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Daily Email Workflow                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │   Email_Scheduler     │
                  │  - node-cron daily    │
                  │  - Configured time    │
                  └───────────┬───────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │  Email_Generator      │
                  │  - Query yesterday    │
                  │  - Aggregate stats    │
                  │  - Format HTML        │
                  └───────────┬───────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │    Email_Sender       │
                  │  - Get admin users    │
                  │  - Send via SMTP      │
                  │  - Log results        │
                  └───────────────────────┘
```

## Component Specifications

### 1. Analytics_Middleware

**Purpose**: Intercept HTTP requests to track page visits before routing to handlers.

**Location**: Integrated into server request handler in simple-server.js

**Behavior**:
- Execute on every HTTP request before routing logic
- Extract session data to get user_id
- Check if requested path matches tracked pages
- If tracked, record visit with Analytics_Repository
- Continue to existing request handler

**Tracked Pages** (12 total):
- /login
- /dashboard
- /employees
- /attendance
- /leave
- /departments
- /reports
- /payroll
- /profile
- /employee-detail
- /id-badges
- /add-employee
- /leave-request

**Implementation Notes**:
- Use existing getSession() function to extract user_id
- Only track GET requests to HTML pages (ignore API calls, assets)
- Non-blocking - analytics recording should not delay response
- If session is missing or user_id unavailable, track as 'anonymous' or skip

### 2. Analytics_Repository

**Purpose**: Manage storage and retrieval of analytics data in data.json.

**Data Structure in data.json**:

```javascript
{
  "employees": [...],
  "users": {...},
  "departments": [...],
  "leaveRequests": [...],
  "attendanceRecords": [...],
  "attendancePolicy": {...},
  "notifications": [...],
  "analytics": {
    "pageVisits": [
      {
        "user_id": 1,
        "page_name": "dashboard",
        "timestamp": "2024-12-24T08:30:15.000Z",
        "date": "2024-12-24"
      }
    ],
    "interactions": [
      {
        "user_id": 1,
        "page_name": "employees",
        "interaction_type": "button_click",
        "element_id": "add-employee-btn",
        "timestamp": "2024-12-24T08:35:22.000Z",
        "date": "2024-12-24"
      }
    ]
  }
}
```

**Methods**:


- `recordPageVisit(userId, pageName)`: Store a page visit record
- `recordInteraction(userId, pageName, interactionType, elementId)`: Store an interaction record
- `getVisitsByDateRange(startDate, endDate)`: Retrieve page visits for date range
- `getInteractionsByDateRange(startDate, endDate)`: Retrieve interactions for date range
- `aggregateDailyVisits(date)`: Count unique (user, page, day) tuples for a specific date
- `aggregateInteractionsByType(date)`: Group interactions by type with counts for a specific date

**Implementation Notes**:
- Use existing saveData() function to persist to data.json
- Use existing loadData() function to load analytics data at startup
- Timestamps use ISO 8601 format: `new Date().toISOString()`
- Date field uses YYYY-MM-DD format: `new Date().toISOString().split('T')[0]`
- Aggregation uses in-memory filtering and grouping (no database queries)

### 3. Interaction API Endpoint

**Purpose**: Receive interaction tracking data from client-side JavaScript.

**Route**: `POST /api/analytics/interaction`

**Request Body**:
```javascript
{
  "page_name": "employees",
  "interaction_type": "button_click",  // button_click, form_submission, dropdown_selection, tab_change
  "element_id": "add-employee-btn"
}
```

**Response**:
```javascript
{
  "success": true,
  "message": "Interaction recorded"
}
```

**Handler Logic**:
1. Extract session to get user_id
2. Validate interaction_type is one of allowed types
3. Call Analytics_Repository.recordInteraction()
4. Return success response
5. If no session, return 401 Unauthorized

**Client-Side Integration**:
- Add JavaScript to track button clicks, form submissions, dropdown selections, tab changes
- Use event listeners to capture interactions
- Send POST request to /api/analytics/interaction endpoint
- Non-blocking - use fire-and-forget pattern (don't wait for response)

### 4. Email_Scheduler

**Purpose**: Trigger daily email generation and sending at configured time.

**Implementation**: Use `node-cron` npm package

**Schedule Configuration**:
- Read from config.json: `email.sendTime` (format: "HH:MM", e.g., "09:00")
- Convert to cron expression: `MM HH * * *` (e.g., "0 9 * * *" for 9:00 AM)
- Default to "09:00" if configuration missing or invalid

**Scheduler Setup**:
```javascript
const cron = require('node-cron');

// Load config
const emailSendTime = config.email?.sendTime || "09:00";
const [hour, minute] = emailSendTime.split(':');
const cronExpression = `${minute} ${hour} * * *`;

// Schedule daily task
cron.schedule(cronExpression, async () => {
  console.log('Starting daily analytics email generation...');
  await generateAndSendDailyEmail();
});
```

**Error Handling**:
- Log errors but continue scheduling for next day
- Invalid configuration logs warning and uses default time
- Server restart does NOT trigger missed emails (only schedules forward)


### 5. Email_Generator

**Purpose**: Query analytics data and format HTML email content.

**Data Scope**: Generate report for previous calendar day (yesterday)

**Query Logic**:
```javascript
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const dateStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD

// Get raw data
const visits = getVisitsByDateRange(dateStr, dateStr);
const interactions = getInteractionsByDateRange(dateStr, dateStr);

// Aggregate
const dailyVisitsByPage = aggregateDailyVisits(dateStr); // { "dashboard": 5, "employees": 3, ... }
const interactionsByType = aggregateInteractionsByType(dateStr); // { "button_click": 10, "form_submission": 5, ... }
```

**HTML Email Template Structure**:

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
    .total { font-weight: bold; }
  </style>
</head>
<body>
  <h1>Daily Analytics Report</h1>
  <p><strong>Date:</strong> {{date}}</p>
  
  <h2>Page Visits</h2>
  <table>
    <tr><th>Page</th><th>Unique Daily Visits</th></tr>
    <!-- For each tracked page -->
    <tr><td>{{page_name}}</td><td>{{count}}</td></tr>
    <!-- ... -->
    <tr class="total"><td>Total</td><td>{{total_visits}}</td></tr>
  </table>
  
  <h2>User Interactions</h2>
  <table>
    <tr><th>Interaction Type</th><th>Count</th></tr>
    <tr><td>Button Clicks</td><td>{{button_clicks}}</td></tr>
    <tr><td>Form Submissions</td><td>{{form_submissions}}</td></tr>
    <tr><td>Dropdown Selections</td><td>{{dropdown_selections}}</td></tr>
    <tr><td>Tab Changes</td><td>{{tab_changes}}</td></tr>
    <tr class="total"><td>Total</td><td>{{total_interactions}}</td></tr>
  </table>
</body>
</html>
```

**Empty Data Handling**:
- If no visits and no interactions: Add message "No activity was recorded for this date."
- Still include all 12 tracked pages in table with count of 0
- Include all 4 interaction types with count of 0

**Method Signature**:
```javascript
function generateEmailHTML(date, visitsByPage, interactionsByType) {
  // Returns HTML string
}
```

### 6. Email_Sender

**Purpose**: Deliver emails to admin users via SMTP.

**Dependencies**: `nodemailer` npm package

**SMTP Configuration** (in config.json):
```json
{
  "email": {
    "smtp": {
      "host": "smtp.gmail.com",
      "port": 587,
      "secure": false,
      "auth": {
        "user": "system@company.com",
        "pass": "app-specific-password"
      }
    },
    "from": "system@company.com",
    "sendTime": "09:00"
  }
}
```

**Recipient List**:
- Query users object from data.json
- Filter for users where `role === 'admin'`
- Extract email addresses

**Email Sending Logic**:
```javascript
const nodemailer = require('nodemailer');

async function sendDailyEmail(htmlContent, date) {
  // Validate SMTP configuration
  if (!config.email?.smtp) {
    console.error('SMTP configuration missing, skipping email send');
    return;
  }
  
  // Create transporter
  const transporter = nodemailer.createTransport(config.email.smtp);
  
  // Get admin users
  const adminEmails = Object.entries(users)
    .filter(([email, userData]) => userData.role === 'admin')
    .map(([email, userData]) => email);
  
  if (adminEmails.length === 0) {
    console.log('No admin users found, skipping email send');
    return;
  }
  
  // Send to each admin
  for (const email of adminEmails) {
    try {
      await transporter.sendMail({
        from: config.email.from,
        to: email,
        subject: `Daily Analytics Report - ${date}`,
        html: htmlContent
      });
      console.log(`✅ Analytics email sent successfully to ${email} at ${new Date().toISOString()}`);
    } catch (error) {
      console.error(`❌ Failed to send email to ${email} at ${new Date().toISOString()}: ${error.message}`);
    }
  }
}
```


**Error Handling**:
- Missing SMTP configuration: Log error, skip sending
- Invalid SMTP credentials: Log error with recipient details, continue to next recipient
- Network errors: Log error, continue to next recipient
- All errors logged with timestamp and recipient email

## Data Models

### Page Visit Record

```javascript
{
  "user_id": number,          // From session.user_id
  "page_name": string,        // One of 12 tracked pages
  "timestamp": string,        // ISO 8601: "2024-12-24T08:30:15.000Z"
  "date": string             // YYYY-MM-DD: "2024-12-24"
}
```

### Interaction Record

```javascript
{
  "user_id": number,          // From session.user_id
  "page_name": string,        // Page where interaction occurred
  "interaction_type": string, // "button_click" | "form_submission" | "dropdown_selection" | "tab_change"
  "element_id": string,       // DOM element identifier
  "timestamp": string,        // ISO 8601: "2024-12-24T08:35:22.000Z"
  "date": string             // YYYY-MM-DD: "2024-12-24"
}
```

### Daily Visit Aggregation

```javascript
{
  "login": 5,
  "dashboard": 12,
  "employees": 8,
  "attendance": 6,
  "leave": 3,
  "departments": 2,
  "reports": 4,
  "payroll": 3,
  "profile": 7,
  "employee-detail": 9,
  "id-badges": 1,
  "add-employee": 2,
  "leave-request": 2
}
```

### Interaction Type Aggregation

```javascript
{
  "button_click": 25,
  "form_submission": 8,
  "dropdown_selection": 12,
  "tab_change": 6
}
```

## Integration Points

### Existing Server Components

**Session Management**:
- Use existing `getSession(req)` function to extract user_id
- Analytics middleware must handle missing/invalid sessions gracefully

**Data Persistence**:
- Use existing `saveData()` function to persist analytics data
- Use existing `loadData()` function to load analytics at startup
- Integrate analytics section into data.json structure
- Leverage existing batched save mechanism (100ms debounce)

**User Management**:
- Query existing `users` object to get admin email list
- Filter by `role === 'admin'`

### New Dependencies

**npm packages to install**:
```json
{
  "nodemailer": "^6.9.0",
  "node-cron": "^3.0.0"
}
```

**Installation command**:
```bash
npm install nodemailer node-cron
```

## Configuration

### Config Schema Extension

Add to existing config.json:

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 8080,
    "allowExternalConnections": true
  },
  "email": {
    "smtp": {
      "host": "smtp.gmail.com",
      "port": 587,
      "secure": false,
      "auth": {
        "user": "system@company.com",
        "pass": "app-specific-password"
      }
    },
    "from": "system@company.com",
    "sendTime": "09:00"
  }
}
```

**Configuration Validation**:
- Check for `config.email.smtp` existence before sending
- Validate `sendTime` format: `/^\d{2}:\d{2}$/` (HH:MM)
- Default sendTime to "09:00" if invalid or missing

## Error Handling

### Analytics Tracking Errors

**Page Visit Recording Failure**:
- Log error but do not block request handling
- Continue serving the requested page
- Error logged: `console.error('Failed to record page visit:', error.message)`

**Interaction Recording Failure**:
- Return 500 error to client
- Log error: `console.error('Failed to record interaction:', error.message)`
- Client should handle gracefully (not critical to user workflow)

### Email Sending Errors

**Missing SMTP Configuration**:
- Log error: `console.error('SMTP configuration missing, skipping email send')`
- Do not attempt to send
- Scheduler continues for next day


**SMTP Connection Failure**:
- Log error with timestamp and recipient: `console.error(`❌ Failed to send email to ${email} at ${timestamp}: ${error.message}`)`
- Continue attempting other recipients
- Do not retry failed sends

**No Admin Users Found**:
- Log message: `console.log('No admin users found, skipping email send')`
- Normal operation (not an error)

**Email Generation Failure**:
- Log error: `console.error('Failed to generate email content:', error.message)`
- Skip sending for that day
- Scheduler continues for next day

## Performance Considerations

### Analytics Tracking

**Request Handling Impact**:
- Analytics middleware must be non-blocking
- Use async/await for repository calls
- Do not delay response to client
- If tracking fails, log and continue

**Storage Impact**:
- Analytics data grows continuously
- Consider archiving old data (manual process, not in initial implementation)
- Estimate: 100 page visits + 50 interactions per day = ~150 records/day
- 1 year = ~55,000 records (~5-10 MB in JSON)

### Email Generation

**Query Performance**:
- Filter visits and interactions by date in memory (simple array filter)
- For 1 year of data (~55K records), filtering is < 100ms
- Aggregation uses JavaScript Map/Object grouping (efficient for this scale)

**Email Delivery**:
- Send emails sequentially to admins (1-2 second delay per email)
- For 5 admin users: ~10 seconds total
- Acceptable for daily overnight/morning job

## Security Considerations

### Data Privacy

**User Tracking**:
- Only track authenticated users (session-based)
- Store user_id (numeric), not sensitive personal information
- No IP address or device fingerprinting

**Access Control**:
- Analytics data viewable only by admins (future dashboard feature)
- Interaction API endpoint requires valid session
- Email reports only sent to admin role users

### SMTP Security

**Credential Storage**:
- SMTP password stored in config.json (plaintext)
- Recommend using environment variables in production
- Use app-specific passwords for Gmail (not actual password)

**Email Content**:
- Analytics reports contain aggregate statistics only
- No personal user information in emails
- Subject line includes date but no sensitive data

## Testing Strategy

### Unit Tests

**Analytics Repository**:
- Test recordPageVisit() stores correct data structure
- Test recordInteraction() validates interaction types
- Test aggregateDailyVisits() correctly deduplicates by (user, page, day)
- Test date/timestamp formatting (ISO 8601 and YYYY-MM-DD)

**Email Generator**:
- Test HTML generation with sample data
- Test empty data case includes "no activity" message
- Test all 12 tracked pages included with zero counts
- Test subject line includes correct date

**Email Sender**:
- Test admin user filtering from users object
- Test SMTP configuration validation
- Test error logging for failed sends

### Property-Based Tests

**Daily Visit Deduplication**:
- For any set of page visits, verify aggregation counts unique (user, page, day) tuples
- Generator: random arrays of visit records with varying user_id, page_name, date
- Property: count(unique((user_id, page_name, date))) === aggregated count

**Timestamp Format Validation**:
- For any page visit or interaction record, verify timestamp matches ISO 8601 format
- Generator: random records with various data
- Property: timestamp matches regex `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/`

**Date Format Validation**:
- For any page visit or interaction record, verify date matches YYYY-MM-DD format
- Generator: random records with various data
- Property: date matches regex `/^\d{4}-\d{2}-\d{2}$/`

**Email HTML Completeness**:
- For any aggregated data, verify email HTML includes all 12 tracked pages
- Generator: random visit/interaction data with some pages missing
- Property: HTML contains all 12 page names

### Integration Tests

**Analytics Middleware**:
- Test page visit recorded when GET request to tracked page
- Test visit not recorded for API endpoints
- Test visit not recorded for static assets
- Test user_id correctly extracted from session


**Interaction API**:
- Test POST /api/analytics/interaction records interaction
- Test 401 returned for missing session
- Test 400 returned for invalid interaction_type

**Email Scheduler**:
- Test scheduler triggers at configured time (mock system time)
- Test default time used when configuration invalid
- Test no backlog emails after server restart

**End-to-End**:
- Test full workflow: page visit → storage → email generation → email sending
- Test with empty data (no activity message in email)
- Test SMTP error handling (mock transporter)

## Implementation Phases

### Phase 1: Analytics Tracking
1. Add analytics section to data.json structure
2. Implement Analytics_Repository with storage methods
3. Add Analytics_Middleware to request handler
4. Add POST /api/analytics/interaction endpoint
5. Unit test repository methods

### Phase 2: Email Generation
1. Install nodemailer and node-cron dependencies
2. Implement Email_Generator with HTML template
3. Implement aggregation methods in repository
4. Unit test email generation with various data scenarios

### Phase 3: Email Scheduling and Delivery
1. Add email configuration to config.json
2. Implement Email_Sender with nodemailer
3. Implement Email_Scheduler with node-cron
4. Test SMTP connection and email delivery
5. Integration test full workflow

### Phase 4: Client-Side Tracking
1. Add JavaScript to track button clicks
2. Add JavaScript to track form submissions
3. Add JavaScript to track dropdown selections
4. Add JavaScript to track tab changes
5. Test interaction tracking on various pages

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

After reviewing the prework analysis, I identified several logically redundant properties. For example:
- Properties testing individual interaction types (button_click, form_submission, etc.) can be combined into one comprehensive property about interaction type recording
- Properties about field presence in records can be consolidated
- Email content validation properties can be merged where they test related aspects

The following properties represent the unique, non-redundant validation requirements:

### Property 1: Page Visit Recording Completeness

*For any* authenticated user accessing any tracked page, the Analytics_Tracker SHALL record a page visit with all required fields: user_id, page_name, timestamp, and date.

**Validates: Requirements 1.1, 1.2**

### Property 2: Daily Visit Deduplication

*For any* set of page visits by the same user to the same page on the same calendar day, the Analytics_Repository aggregation SHALL count exactly one Daily_Visit regardless of the number of actual visits.

**Validates: Requirements 1.3, 3.1, 3.2, 3.3**

### Property 3: Role-Agnostic Tracking

*For any* user with any role (admin, manager, employee), the Analytics_Tracker SHALL record page visits equally without filtering or differentiation by role.

**Validates: Requirements 1.6**

### Property 4: Interaction Recording with Type Classification


*For any* user interaction of types button_click, form_submission, dropdown_selection, or tab_change, the Analytics_Tracker SHALL record the interaction with all required fields: user_id, page_name, interaction_type, element_id, timestamp, and date.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

### Property 5: Timestamp Format Consistency

*For any* page visit or interaction record stored by the Analytics_Repository, the timestamp field SHALL conform to ISO 8601 format (e.g., "2024-12-24T08:30:15.000Z") and the date field SHALL conform to YYYY-MM-DD format.

**Validates: Requirements 7.5, 7.6**

### Property 6: Visit Record Schema Compliance

*For any* page visit record stored by the Analytics_Repository, the record SHALL contain exactly the required fields: user_id, page_name, timestamp, and date.

**Validates: Requirements 7.2**

### Property 7: Interaction Record Schema Compliance

*For any* interaction record stored by the Analytics_Repository, the record SHALL contain exactly the required fields: user_id, page_name, interaction_type, element_id, timestamp, and date.

**Validates: Requirements 7.3**

### Property 8: Email Content Date Range Inclusion

*For any* date used to generate an analytics email, the Email_Generator SHALL include that date in the email content.

**Validates: Requirements 5.1**

### Property 9: Email Visit Table Completeness

*For any* aggregated daily visit data, the Email_Generator SHALL include all 12 tracked pages in the visit table, showing count of 0 for pages with no visits.

**Validates: Requirements 5.2, 5.7**


### Property 10: Email Total Visit Count Accuracy

*For any* set of page visit counts in the email, the total Daily_Visits SHALL equal the sum of individual page counts.

**Validates: Requirements 5.3**

### Property 11: Email Interaction Breakdown Completeness

*For any* aggregated interaction data, the Email_Generator SHALL include a breakdown showing all 4 interaction types (button_click, form_submission, dropdown_selection, tab_change) with their counts.

**Validates: Requirements 5.4**

### Property 12: Email Total Interaction Count Accuracy

*For any* set of interaction type counts in the email, the total interaction count SHALL equal the sum of counts across all interaction types.

**Validates: Requirements 5.5**

### Property 13: Email HTML Format Validity

*For any* email content generated by the Email_Generator, the content SHALL be valid HTML that can be parsed without errors.

**Validates: Requirements 5.6**

### Property 14: Admin-Only Email Recipients

*For any* email sending operation, the Email_Sender SHALL deliver emails only to users where role === 'admin' in the users object.

**Validates: Requirements 6.1**

### Property 15: Email Subject Date Inclusion

*For any* analytics email sent by the Email_Sender, the subject line SHALL include the date of the analytics report.

**Validates: Requirements 6.5**

### Property 16: SMTP Configuration Validation

*For any* SMTP configuration object, the Email_Sender SHALL validate the presence of required fields (host, port, auth.user, auth.pass) before attempting to send emails.

**Validates: Requirements 8.5**


## Example Code Snippets

### Analytics Middleware Integration

```javascript
// In simple-server.js, before routing logic
const server = http.createServer(async (req, res) => {
    const clientIP = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    console.log(`📡 ${new Date().toISOString()} - ${clientIP} - ${req.method} ${req.url}`);
    
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    // Analytics tracking middleware
    if (req.method === 'GET' && isTrackedPage(pathname)) {
        try {
            const session = getSession(req);
            if (session && session.user_id) {
                await recordPageVisit(session.user_id, pathname.substring(1) || 'login');
            }
        } catch (error) {
            console.error('Failed to record page visit:', error.message);
            // Continue serving the page despite analytics failure
        }
    }
    
    // ... existing CORS and routing logic
});

function isTrackedPage(pathname) {
    const trackedPages = [
        '/login', '/dashboard', '/employees', '/attendance', '/leave',
        '/departments', '/reports', '/payroll', '/profile', 
        '/employee-detail', '/id-badges', '/add-employee', '/leave-request'
    ];
    return trackedPages.includes(pathname) || pathname === '/';
}
```

### Analytics Repository Implementation

```javascript
// Analytics data structure
let analytics = {
    pageVisits: [],
    interactions: []
};

function recordPageVisit(userId, pageName) {
    const now = new Date();
    const visit = {
        user_id: userId,
        page_name: pageName,
        timestamp: now.toISOString(),
        date: now.toISOString().split('T')[0]
    };
    
    analytics.pageVisits.push(visit);
    saveData(); // Use existing save function
}

function recordInteraction(userId, pageName, interactionType, elementId) {
    const now = new Date();
    const interaction = {
        user_id: userId,
        page_name: pageName,
        interaction_type: interactionType,
        element_id: elementId,
        timestamp: now.toISOString(),
        date: now.toISOString().split('T')[0]
    };
    
    analytics.interactions.push(interaction);
    saveData();
}

function aggregateDailyVisits(date) {
    const visitsForDate = analytics.pageVisits.filter(v => v.date === date);
    
    // Deduplicate by (user_id, page_name, date)
    const uniqueVisits = new Map();
    visitsForDate.forEach(visit => {
        const key = `${visit.user_id}-${visit.page_name}`;
        uniqueVisits.set(key, visit);
    });
    
    // Count by page
    const countsByPage = {};
    const trackedPages = [
        'login', 'dashboard', 'employees', 'attendance', 'leave',
        'departments', 'reports', 'payroll', 'profile',
        'employee-detail', 'id-badges', 'add-employee', 'leave-request'
    ];
    
    // Initialize all pages with 0
    trackedPages.forEach(page => {
        countsByPage[page] = 0;
    });
    
    // Count unique visits
    uniqueVisits.forEach(visit => {
        if (countsByPage.hasOwnProperty(visit.page_name)) {
            countsByPage[visit.page_name]++;
        }
    });
    
    return countsByPage;
}

function aggregateInteractionsByType(date) {
    const interactionsForDate = analytics.interactions.filter(i => i.date === date);
    
    const countsByType = {
        button_click: 0,
        form_submission: 0,
        dropdown_selection: 0,
        tab_change: 0
    };
    
    interactionsForDate.forEach(interaction => {
        if (countsByType.hasOwnProperty(interaction.interaction_type)) {
            countsByType[interaction.interaction_type]++;
        }
    });
    
    return countsByType;
}
```

### Email Scheduler Setup

```javascript
const cron = require('node-cron');

// Initialize scheduler on server startup
function initializeEmailScheduler() {
    const emailSendTime = config.email?.sendTime || "09:00";
    
    // Validate format
    if (!/^\d{2}:\d{2}$/.test(emailSendTime)) {
        console.error(`Invalid email send time format: ${emailSendTime}, using default 09:00`);
        emailSendTime = "09:00";
    }
    
    const [hour, minute] = emailSendTime.split(':');
    const cronExpression = `${minute} ${hour} * * *`;
    
    console.log(`📧 Daily analytics email scheduled for ${emailSendTime} (cron: ${cronExpression})`);
    
    cron.schedule(cronExpression, async () => {
        console.log('🕒 Starting daily analytics email generation...');
        try {
            await generateAndSendDailyEmail();
        } catch (error) {
            console.error('❌ Failed to generate/send daily email:', error.message);
        }
    });
}

async function generateAndSendDailyEmail() {
    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    // Aggregate data
    const visitsByPage = aggregateDailyVisits(dateStr);
    const interactionsByType = aggregateInteractionsByType(dateStr);
    
    // Generate HTML
    const htmlContent = generateEmailHTML(dateStr, visitsByPage, interactionsByType);
    
    // Send email
    await sendDailyEmail(htmlContent, dateStr);
}

// Call on server startup
initializeEmailScheduler();
```

### Email HTML Generation

```javascript
function generateEmailHTML(date, visitsByPage, interactionsByType) {
    const totalVisits = Object.values(visitsByPage).reduce((sum, count) => sum + count, 0);
    const totalInteractions = Object.values(interactionsByType).reduce((sum, count) => sum + count, 0);
    
    let visitsTableRows = '';
    for (const [page, count] of Object.entries(visitsByPage)) {
        visitsTableRows += `<tr><td>${page}</td><td>${count}</td></tr>\n`;
    }
    
    const noActivityMessage = (totalVisits === 0 && totalInteractions === 0) 
        ? '<p><em>No activity was recorded for this date.</em></p>' 
        : '';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
    .total { font-weight: bold; background-color: #f0f0f0; }
  </style>
</head>
<body>
  <h1>Daily Analytics Report</h1>
  <p><strong>Date:</strong> ${date}</p>
  ${noActivityMessage}
  
  <h2>Page Visits</h2>
  <table>
    <tr><th>Page</th><th>Unique Daily Visits</th></tr>
    ${visitsTableRows}
    <tr class="total"><td>Total</td><td>${totalVisits}</td></tr>
  </table>
  
  <h2>User Interactions</h2>
  <table>
    <tr><th>Interaction Type</th><th>Count</th></tr>
    <tr><td>Button Clicks</td><td>${interactionsByType.button_click}</td></tr>
    <tr><td>Form Submissions</td><td>${interactionsByType.form_submission}</td></tr>
    <tr><td>Dropdown Selections</td><td>${interactionsByType.dropdown_selection}</td></tr>
    <tr><td>Tab Changes</td><td>${interactionsByType.tab_change}</td></tr>
    <tr class="total"><td>Total</td><td>${totalInteractions}</td></tr>
  </table>
</body>
</html>
    `.trim();
}
```

### Client-Side Interaction Tracking

```javascript
// Add to pages that need interaction tracking
document.addEventListener('DOMContentLoaded', () => {
    // Track button clicks
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', () => {
            trackInteraction('button_click', button.id || button.className);
        });
    });
    
    // Track form submissions
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', () => {
            trackInteraction('form_submission', form.id || form.className);
        });
    });
    
    // Track dropdown selections
    document.querySelectorAll('select').forEach(select => {
        select.addEventListener('change', () => {
            trackInteraction('dropdown_selection', select.id || select.name);
        });
    });
    
    // Track tab changes (if using tabs)
    document.querySelectorAll('.nav-tabs a, .tab-button').forEach(tab => {
        tab.addEventListener('click', () => {
            trackInteraction('tab_change', tab.id || tab.getAttribute('data-tab'));
        });
    });
});

function trackInteraction(type, elementId) {
    const pageName = window.location.pathname.substring(1) || 'login';
    
    fetch('/api/analytics/interaction', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            page_name: pageName,
            interaction_type: type,
            element_id: elementId
        })
    }).catch(error => {
        // Silent failure - analytics should not disrupt user experience
        console.debug('Analytics tracking failed:', error);
    });
}
```

## Deployment Checklist

### Prerequisites
- [ ] Node.js server running simple-server.js
- [ ] data.json file with existing data structure
- [ ] SMTP server credentials available

### Installation Steps
1. [ ] Install npm dependencies: `npm install nodemailer node-cron`
2. [ ] Add email configuration to config.json
3. [ ] Update data.json structure to include analytics section
4. [ ] Add analytics middleware to simple-server.js
5. [ ] Add POST /api/analytics/interaction endpoint
6. [ ] Add email scheduler initialization
7. [ ] Test SMTP connection with test email
8. [ ] Add client-side tracking JavaScript to HTML pages

### Configuration
- [ ] Set email.smtp.host in config.json
- [ ] Set email.smtp.port in config.json
- [ ] Set email.smtp.auth.user in config.json
- [ ] Set email.smtp.auth.pass in config.json (use app-specific password)
- [ ] Set email.from in config.json
- [ ] Set email.sendTime in config.json (HH:MM format)

### Testing
- [ ] Verify page visits are recorded in data.json
- [ ] Verify interactions are recorded in data.json
- [ ] Test daily visit deduplication
- [ ] Test email generation with sample data
- [ ] Test email generation with empty data
- [ ] Send test email to admin users
- [ ] Verify scheduled email triggers at configured time

### Monitoring
- [ ] Check server logs for analytics tracking errors
- [ ] Check server logs for email send success/failure
- [ ] Monitor data.json file size growth
- [ ] Verify admin users receive daily emails
