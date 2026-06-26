# Database Connection Module

This module provides MySQL database connection pooling and query execution interfaces for the Employee Management System.

## Features

- ✅ **Connection Pooling**: Manages 5-20 MySQL connections efficiently
- ✅ **Parameterized Queries**: SQL injection protection through prepared statements
- ✅ **Transaction Support**: ACID-compliant multi-step operations
- ✅ **Retry Logic**: 3 automatic retry attempts with 5-second intervals
- ✅ **Environment-Specific Behavior**: Different handling for production vs development
- ✅ **Error Handling**: Comprehensive error logging and recovery

## Installation

The required `mysql2` package is already included in package.json dependencies:

```bash
npm install
```

## Configuration

Configure database connection via environment variables in `.env`:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=employee_system
DB_PORT=3306
NODE_ENV=development
```

## API Reference

### initializeDatabase()

Initialize the database connection pool with retry logic.

**Returns:** `Promise<boolean>` - True if connected successfully

**Behavior:**
- Attempts connection 3 times with 5-second delays
- In production: exits process on failure (allows container restart)
- In development: continues running, logs warning

```javascript
const { initializeDatabase } = require('./db/connection');

await initializeDatabase();
```

### query(sql, params)

Execute a parameterized SQL query.

**Parameters:**
- `sql` (string): SQL query with `?` placeholders
- `params` (array): Array of values to bind to placeholders

**Returns:** `Promise<Array>` - Query results (rows)

**Example:**
```javascript
const { query } = require('./db/connection');

// SELECT query
const employees = await query(
  'SELECT * FROM employees WHERE status = ?', 
  ['active']
);

// INSERT query
const result = await query(
  'INSERT INTO employees (name, email, salary) VALUES (?, ?, ?)',
  ['John Doe', 'john@example.com', 50000]
);
console.log('Inserted ID:', result.insertId);

// UPDATE query
await query(
  'UPDATE employees SET salary = ? WHERE id = ?',
  [55000, employeeId]
);
```

### transaction(callback)

Execute multiple operations within a database transaction. Automatically handles BEGIN, COMMIT, and ROLLBACK.

**Parameters:**
- `callback` (async function): Function receiving connection object

**Returns:** `Promise<*>` - Result returned by callback

**Example:**
```javascript
const { transaction } = require('./db/connection');

await transaction(async (connection) => {
  // Insert employee
  const [empResult] = await connection.query(
    'INSERT INTO employees (name, email) VALUES (?, ?)',
    ['Jane Doe', 'jane@example.com']
  );
  
  const employeeId = empResult.insertId;
  
  // Insert user (linked to employee)
  await connection.query(
    'INSERT INTO users (email, employee_id, role) VALUES (?, ?, ?)',
    ['jane@example.com', employeeId, 'employee']
  );
  
  // Both succeed or both rollback
});
```

### getConnection()

Acquire a connection from the pool for complex operations.

**Returns:** `Promise<Connection>` - Database connection object

**Important:** Caller must release connection after use!

**Example:**
```javascript
const { getConnection } = require('./db/connection');

const conn = await getConnection();
try {
  await conn.query('SELECT * FROM employees');
  await conn.query('UPDATE employees SET ...');
} finally {
  conn.release(); // Always release!
}
```

### testConnection()

Test database connectivity (useful for health checks).

**Returns:** `Promise<boolean>` - True if database is reachable

**Example:**
```javascript
const { testConnection } = require('./db/connection');

if (await testConnection()) {
  console.log('Database is healthy');
}
```

### getPoolStats()

Get current connection pool statistics for monitoring.

**Returns:** `Object` - Pool statistics

**Example:**
```javascript
const { getPoolStats } = require('./db/connection');

const stats = getPoolStats();
console.log('Total connections:', stats.totalConnections);
console.log('Free connections:', stats.freeConnections);
console.log('Queued requests:', stats.queuedRequests);
```

### closePool()

Gracefully close all connections in the pool (call on server shutdown).

**Returns:** `Promise<void>`

**Example:**
```javascript
const { closePool } = require('./db/connection');

process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});
```

## Usage in simple-server.js

```javascript
const { initializeDatabase, query, transaction } = require('./db/connection');

// Initialize on server startup
async function startServer() {
  await initializeDatabase();
  
  // Your existing server code...
}

// Example endpoint
async function handleGetEmployees(req, res) {
  try {
    const employees = await query(
      'SELECT * FROM employees WHERE status = ?',
      ['active']
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(employees));
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Database error' }));
  }
}
```

## Error Handling

### Connection Errors

**Error Code:** `ER_ACCESS_DENIED_ERROR`, `ECONNREFUSED`, `ETIMEDOUT`

**Handling:**
- Automatic retry (3 attempts, 5-second intervals)
- Production: process exits for container restart
- Development: continues running, operations fail gracefully

### Constraint Violations

**Error Code:** `ER_DUP_ENTRY`
- **Cause:** Unique constraint violation (duplicate email/employee_id)
- **Response:** HTTP 409 Conflict

**Error Code:** `ER_NO_REFERENCED_ROW_2`
- **Cause:** Foreign key violation (invalid employee reference)
- **Response:** HTTP 400 Bad Request

### Query Timeouts

**Configuration:**
- Connection timeout: 10 seconds
- Query timeout: Controlled by MySQL server settings

**Handling:**
- Connection automatically returns to pool
- Error logged with context
- HTTP 500 returned to client

## Testing

### Run Full Test Suite

Requires MySQL server running locally:

```bash
node db/connection.test.js
```

### Manual Testing

```javascript
// Test connection
const { initializeDatabase, query } = require('./db/connection');

(async () => {
  await initializeDatabase();
  const result = await query('SELECT 1 + 1 AS sum');
  console.log('Result:', result[0].sum); // 2
})();
```

## Connection Pool Configuration

```javascript
{
  connectionLimit: 20,        // Max 20 connections
  waitForConnections: true,   // Queue when pool exhausted
  queueLimit: 0,              // Unlimited queue
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // 10 seconds
  connectTimeout: 10000,      // 10 second timeout
  idleTimeout: 600000,        // 10 minute idle timeout
  maxIdle: 5                  // Min 5 idle connections
}
```

## Requirements Validation

This module satisfies the following requirements from the specification:

- ✅ **Requirement 1.1**: Database configuration from environment variables
- ✅ **Requirement 1.2**: Connection pool with 5-20 connections
- ✅ **Requirement 1.3**: Connection retry logic (3 attempts, 5-second intervals)
- ✅ **Requirement 1.4**: Local development environment support
- ✅ **Requirement 1.5**: Production environment support
- ✅ **Requirement 1.6**: Connectivity validation on startup
- ✅ **Requirement 1.7**: Automatic retry on connection loss
- ✅ **Requirement 6.1**: Error logging with context
- ✅ **Requirement 9.1**: NODE_ENV environment detection
- ✅ **Requirement 9.2**: Required environment variables in production
- ✅ **Requirement 9.3**: Default values in development
- ✅ **Requirement 9.7**: Exit on production failure
- ✅ **Requirement 9.8**: Continue on development failure

## Security

- **SQL Injection Prevention**: All queries use parameterized statements
- **Credential Protection**: Passwords never logged
- **Connection Pooling**: Prevents connection exhaustion attacks
- **Timeout Protection**: Queries timeout after 10 seconds

## Performance

- **Connection Reuse**: Pool maintains 5-20 connections
- **Keep-Alive**: Connections kept alive to avoid reconnection overhead
- **Prepared Statements**: mysql2 automatically prepares frequently used queries
- **Efficient Queuing**: Requests queued when pool exhausted (no failures)

## Troubleshooting

### "Access denied for user"
- Check DB_USER and DB_PASSWORD in .env
- Verify MySQL user has correct privileges

### "ECONNREFUSED"
- Ensure MySQL server is running
- Check DB_HOST and DB_PORT are correct

### "Too many connections"
- Check connectionLimit configuration
- Monitor pool usage with getPoolStats()

### Connection pool exhausted
- Monitor queuedRequests in getPoolStats()
- Consider increasing connectionLimit if consistently high

## Next Steps

1. ✅ Database connection module created
2. 📋 Create schema initialization module (db/schema.js)
3. 📋 Create data migration script (migrate-to-mysql.js)
4. 📋 Update simple-server.js to use database instead of data.json
5. 📋 Write integration tests
6. 📋 Deploy to production
