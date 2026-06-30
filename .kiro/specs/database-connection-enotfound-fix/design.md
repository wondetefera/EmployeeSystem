# Database Connection ENOTFOUND Bugfix Design

## Overview

The Employee Management System currently fails when attempting to connect to an Aiven MySQL database with ENOTFOUND hostname resolution errors. The system exits the process on Render production deployments and provides unhelpful error messages to users. This design addresses the root causes of hostname resolution failures, implements comprehensive diagnostic logging, and introduces graceful degradation when database connectivity fails. The fix ensures the system:

1. **Validates Aiven Database Configuration** - Confirms hostname, port, credentials, and SSL settings are correct before attempting connection
2. **Provides Diagnostic Logging** - Shows attempted hostname, DNS resolution status, credentials (masked), SSL configuration, and network accessibility
3. **Gracefully Degrades** - Continues running when database fails but USE_DATABASE=true, logs diagnostic information, and falls back to file-based storage with warnings
4. **Improves Error Categorization** - Provides actionable guidance for ENOTFOUND and hostname resolution errors
5. **Pre-validates Connectivity** - Checks database accessibility early and surfaces issues before server accepts requests

This design maintains full backward compatibility with the existing connection.js module and preserves all existing behavior for non-buggy inputs.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the ENOTFOUND bug - when USE_DATABASE=true, the Aiven database hostname cannot be resolved via DNS lookup, resulting in socket-level failure and process exit or connection denial
- **Property (P)**: The desired behavior when the bug condition occurs - system validates configuration, logs diagnostic information, optionally falls back to file-based storage, and continues running
- **Preservation**: Existing file-based storage mode (USE_DATABASE=false) and successful database operations remain unchanged
- **ENOTFOUND**: Node.js error code indicating DNS resolution failure (getaddrinfo ENOTFOUND hostname)
- **Aiven_Configuration**: Environment variables specifying Aiven database hostname (DB_HOST), port (DB_PORT), credentials (DB_USER, DB_PASSWORD), database name (DB_NAME), and SSL mode (DB_SSL)
- **Connection_Pool**: The mysql2/promise connection pool managed by connection.js (5-20 connections)
- **Diagnostic_Information**: Logs showing attempted hostname, DNS resolution attempts, configured credentials (password masked), SSL settings, and network accessibility checks
- **Graceful_Degradation**: System continues running when database unavailable, logs diagnostic data, returns user-friendly errors, optionally falls back to file-based storage

## Bug Details

### Bug Condition

The bug manifests when the application starts with `USE_DATABASE=true` and attempts to resolve the Aiven MySQL hostname (e.g., `ems-db-wondwossentefera-5812.h.aivencloud.com`). The Node.js DNS resolution fails at the socket level with `getaddrinfo ENOTFOUND hostname`, preventing the connection pool from establishing any connections.

The hostname resolution failure occurs because:
1. The configured hostname in DB_HOST environment variable is incorrect or misspelled
2. The Aiven database service is not available or has been deleted
3. Network connectivity from the client (Render, local machine) to Aiven is blocked
4. DNS configuration is incomplete or invalid in the Aiven cloud environment
5. SSL certificate configuration is incompatible with the hostname

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type {
    useDatabase: boolean,
    dbHost: string,
    dbPort: number,
    dbUser: string,
    dbPassword: string,
    dbName: string,
    dbSsl: boolean,
    connectionAttempted: boolean
  }
  OUTPUT: boolean
  
  RETURN input.useDatabase == true
         AND input.dbHost != null
         AND input.dbHost != ""
         AND input.connectionAttempted == true
         AND dnsResolutionFailed(input.dbHost)
         AND systemExitedOrConnectionDenied()
END FUNCTION

FUNCTION dnsResolutionFailed(hostname)
  RETURN socketConnectFailed(hostname)
         AND errorCode == "ENOTFOUND"
         AND getaddrinfoError(hostname)
END FUNCTION
```

### Examples

**Example 1: Aiven Hostname Typo**
- Input: DB_HOST=`ems-db-wondwossentera-5812.h.aivencloud.com` (missing 'fe' in 'fera')
- Expected Behavior: System validates hostname syntax, attempts DNS resolution, logs "hostname resolution failed for ems-db-wondwossentera-5812.h.aivencloud.com", provides diagnostic information, and continues running
- Current Behavior: ENOTFOUND error thrown, process exits on Render, user sees "Database mode required"

**Example 2: Aiven Service Deleted**
- Input: DB_HOST=`ems-db-deleted-1234.h.aivencloud.com` (service no longer exists)
- Expected Behavior: System detects DNS resolution failure, logs diagnostic information including "hostname not found in DNS", suggests verifying Aiven service exists, continues running
- Current Behavior: ENOTFOUND error thrown, connection attempts exhausted after 3 retries, process exits on Render

**Example 3: Network Connectivity Issue**
- Input: DB_HOST=`ems-db-valid.h.aivencloud.com` (valid but unreachable from Render network)
- Expected Behavior: System logs diagnostic information including network accessibility check results, shows attempted hostname and port, logs "unable to reach hostname:port", continues running
- Current Behavior: ENOTFOUND or ETIMEDOUT after retries, process exits on Render

**Example 4: SSL Certificate Mismatch**
- Input: DB_HOST=`ems-db.h.aivencloud.com`, DB_SSL=true, certificate chain invalid
- Expected Behavior: System attempts connection, detects SSL error, logs "SSL configuration error for hostname", provides diagnostic information, continues running
- Current Behavior: Certificate error after retries, process exits on Render

**Example 5: Preserve Non-Buggy Behavior**
- Input: USE_DATABASE=false (file-based mode)
- Expected Behavior: System skips all database connection attempts, uses data.json, logs "USE_DATABASE is false - skipping database initialization"
- Current Behavior: No database connection attempted, operates normally with data.json
- Must Preserve: This behavior must remain unchanged

**Example 6: Successful Connection**
- Input: DB_HOST=`ems-db-valid.h.aivencloud.com`, all credentials valid, network accessible
- Expected Behavior: System establishes connection successfully, logs "Database connected successfully", all queries work normally
- Current Behavior: Connection succeeds, queries execute normally
- Must Preserve: This behavior must remain unchanged

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- When USE_DATABASE=false, the system SHALL CONTINUE TO skip database initialization entirely and use data.json for all operations
- When database connection succeeds, the system SHALL CONTINUE TO execute all SQL queries, transactions, and operations with identical behavior to the current implementation
- When non-connection errors occur (syntax errors, constraint violations, timeout errors), the system SHALL CONTINUE TO categorize and handle these errors identically to the current implementation
- The Connection_Pool configuration (5-20 connections, timeouts, keep-alive) SHALL CONTINUE TO work identically
- The query() function interface, transaction() interface, and all exported functions SHALL CONTINUE TO have the same signatures and behavior
- Error responses for non-connection scenarios SHALL CONTINUE TO use the same status codes and message formats

**Scope:**
All inputs that do NOT involve hostname resolution failure during database initialization should be completely unaffected by this fix. This includes:
- File-based storage mode (USE_DATABASE=false)
- Successful database connections and all subsequent operations
- Non-connection error handling (syntax, constraints, timeouts)
- All query execution and transaction management
- Connection pool behavior and monitoring
- Graceful shutdown procedures

## Hypothesized Root Cause

Based on the bug description, the most likely issues causing ENOTFOUND are:

1. **Incorrect Aiven Hostname Configuration**
   - DB_HOST environment variable is misspelled or contains incorrect service name
   - Hostname was copied from Aiven dashboard incorrectly (missing characters, wrong region)
   - Environment variable not set or loaded properly on Render platform
   - Render .env.example or deployment documentation doesn't include correct format

2. **Aiven Service Lifecycle Issues**
   - The database service was deleted or suspended in Aiven dashboard
   - Service was temporarily unavailable during deployment window
   - Aiven cluster is in maintenance mode with DNS temporarily unavailable
   - Service is in different AWS region than expected

3. **Network Connectivity and DNS Resolution Problems**
   - Render container cannot reach Aiven because of firewall/security group rules
   - Aiven has not whitelisted Render's IP address in firewall settings
   - Local development machine cannot reach Aiven due to network restrictions
   - DNS resolution works for some clients but not others (inconsistent routing)

4. **SSL Configuration Incompatibility**
   - DB_SSL=true but Aiven server certificate doesn't match hostname
   - Certificate chain validation fails on Render environment
   - SSL option not supported by specific Aiven plan
   - Self-signed certificate warning causes connection to fail

5. **Inadequate Error Handling and Diagnostics**
   - Current error handling catches ENOTFOUND but doesn't categorize or explain it
   - Error messages don't provide troubleshooting guidance
   - No diagnostic logging of hostname, port, credentials (masked), or SSL settings
   - Process exits immediately on Render without giving operators time to diagnose
   - Connection validation happens during retry loop without early detection

6. **Missing Pre-validation and Early Detection**
   - Configuration is not validated before attempting connection
   - No pre-check of hostname syntax or format
   - No DNS resolution test before full pool initialization
   - No network connectivity check before deep connection attempts
   - Issues are only discovered during full pool initialization after 15 seconds

## Correctness Properties

Property 1: Bug Condition - Hostname Resolution Failure Handling

_For any_ input where USE_DATABASE=true and hostname resolution fails (isBugCondition returns true), the fixed system SHALL attempt to validate the Aiven database configuration, log comprehensive diagnostic information (hostname, DNS resolution status, credentials masked, SSL settings, network accessibility), provide clear error feedback to users, and EITHER establish a successful connection OR continue running without exiting the process.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - File-Based Mode and Successful Connections

_For any_ input where the bug condition does NOT hold (isBugCondition returns false), the fixed system SHALL produce exactly the same result as the original system, preserving all file-based storage mode behavior, all successful database connection behavior, all query execution behavior, all error handling for non-connection scenarios, and all connection pool management behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct, the fix requires changes to connection.js and addition of a new diagnostic utility module. These changes implement the Root Cause Investigation Module, Connection Diagnostic Logging, Graceful Degradation, Enhanced Error Categorization, and Connection Validation.

**File**: `db/connection.js`

**Changes Summary**:
1. Enhance initializeDatabase() with configuration validation and diagnostic pre-checks
2. Add hostname resolution validation before pool initialization
3. Implement diagnostic logging that shows hostname, DNS resolution attempts, credentials (masked), SSL settings, and network accessibility
4. Change process behavior from exit to graceful continuation on connection failure in production
5. Add connection pre-validation before server starts accepting requests
6. Improve ENOTFOUND error categorization to provide actionable guidance

**Detailed Changes**:

1. **Configuration Validation Module** - NEW SECTION in initializeDatabase()
   - Validate DB_HOST is not empty or null
   - Validate DB_PORT is numeric and in valid range (1-65535)
   - Validate DB_USER is not empty
   - Validate DB_NAME is not empty
   - Log configuration being used (with password masked)
   - Detect common issues (hostname length, format, obvious typos)

2. **Hostname Resolution Pre-check** - NEW SECTION in initializeDatabase()
   - Before creating pool, attempt DNS resolution of DB_HOST
   - Use Node.js dns.lookup() or dns.resolve4() to test hostname resolution
   - Capture DNS resolution error details (ENOTFOUND, ENOTDIR, ECONNREFUSED, etc.)
   - Log whether hostname resolves to IP address successfully
   - Provide diagnostic guidance based on specific DNS error

3. **Enhanced Error Logging in initializeDatabase()** - MODIFY existing retry loop
   - For each failed connection attempt, log comprehensive diagnostic information:
     - Attempted hostname and port
     - Result of DNS resolution (succeeded/failed with error code)
     - Credentials being used (with password masked as `***`)
     - SSL configuration (enabled/disabled)
     - Error code and message from connection attempt
   - For ENOTFOUND specifically, provide guidance: "This usually means the hostname cannot be resolved via DNS. Verify: 1) hostname is spelled correctly, 2) Aiven service exists in correct region, 3) network can reach Aiven servers"

4. **Graceful Degradation on Connection Failure** - MODIFY retry exhaustion behavior
   - REMOVE: `process.exit(1)` call on Render/production when connection fails
   - CHANGE: From "exit process" to "log error and continue running"
   - Log message: "Database connection failed but server will continue. File-based storage will be used if available."
   - Set internal flag (dbConnectionFailed = true) to track connection status
   - Continue server startup to accept requests
   - When database operations are attempted, check dbConnectionFailed flag and either fall back to file-based storage or return user-friendly error

5. **Connection Status Tracking** - NEW GLOBAL STATE
   - Add module-level variable: `let connectionStatus = { isConnected: false, lastError: null, diagnosticInfo: {} }`
   - Update this variable when connection succeeds or fails
   - Provide function to check connection status for other modules
   - Allow other modules to fall back to file-based storage based on connection status

6. **Enhanced Error Categorization for ENOTFOUND** - MODIFY categorizeError()
   - For error code 'ENOTFOUND', provide specific guidance:
     - Include attempted hostname in error details
     - Suggest verification steps: "Check hostname spelling, verify Aiven service exists, check network connectivity"
     - Recommend checking Aiven dashboard and environment variables
   - Separate ENOTFOUND from generic CONNECTION_ERROR to provide targeted guidance

7. **Pre-connection Validation Helper** - NEW FUNCTION validateConfiguration()
   - Validate all environment variables are set correctly
   - Check hostname syntax (not obviously invalid)
   - Test DNS resolution before pool initialization
   - Check network connectivity (optional: simple port connectivity test)
   - Return structured validation result with specific issues identified

8. **Diagnostic Logging Utility** - NEW FUNCTION logConnectionDiagnostics()
   - Format diagnostic information consistently
   - Include: hostname, port, database name, SSL status, credentials (masked)
   - Include DNS resolution result
   - Include network accessibility check result
   - Include suggested troubleshooting steps based on error type

### Implementation Pseudocode

```
FUNCTION initializeDatabase()
  // NEW: Configuration Validation
  validationResult := validateConfiguration()
  IF validationResult.hasErrors THEN
    LOG validationResult.errors and suggestions
    // Continue despite validation warnings (graceful degradation)
  END IF

  // NEW: Hostname Resolution Pre-check
  dnsResult := testDnsResolution(DB_HOST)
  IF dnsResult.failed THEN
    LOG "WARNING: DNS resolution failed for hostname: " + DB_HOST
    LOG "Error: " + dnsResult.error
    LOG "This hostname may not be resolvable from your network"
  ELSE
    LOG "✓ DNS resolution successful: " + DB_HOST + " → " + dnsResult.ipAddress
  END IF

  // Existing: Create connection pool
  pool := mysql.createPool(config)

  // Existing: Retry loop with ENHANCEMENT
  FOR attempt = 1 TO maxRetries DO
    TRY
      AWAIT pool.query('SELECT 1')
      LOG "✓ Database connected successfully"
      connectionStatus.isConnected := true
      RETURN true
    CATCH error
      LOG "❌ Connection attempt " + attempt + " failed"
      logConnectionDiagnostics(error, DB_HOST, DB_PORT, ...)
      
      // NEW: Provide ENOTFOUND-specific guidance
      IF error.code == "ENOTFOUND" THEN
        LOG "ENOTFOUND Error - DNS resolution failed"
        LOG "Hostname: " + DB_HOST
        LOG "Suggested fixes:"
        LOG "  1. Verify hostname spelling matches Aiven dashboard"
        LOG "  2. Check that Aiven service exists and is active"
        LOG "  3. From your network, try: ping " + DB_HOST
        LOG "  4. Verify environment variable DB_HOST is set correctly"
      END IF
      
      IF attempt < maxRetries THEN
        SLEEP retryDelayMs
      END IF
    END TRY
  END FOR

  // CHANGED: Graceful degradation instead of exit
  LOG "🟡 Connection failed after " + maxRetries + " attempts"
  LOG "Server will continue running"
  LOG "File-based storage will be used where applicable"
  connectionStatus.isConnected := false
  connectionStatus.lastError := lastError
  connectionStatus.diagnosticInfo := {
    hostname: DB_HOST,
    port: DB_PORT,
    attemptCount: maxRetries,
    lastErrorCode: lastError.code,
    lastErrorMessage: lastError.message,
    dnsResolutionStatus: dnsResult
  }
  
  // NEW: Allow other modules to check connection status
  RETURN connectionStatus
END FUNCTION

FUNCTION validateConfiguration()
  issues := []
  
  IF DB_HOST is null OR DB_HOST == "" THEN
    issues.add("DB_HOST not configured")
  END IF
  
  IF DB_PORT is not numeric OR DB_PORT < 1 OR DB_PORT > 65535 THEN
    issues.add("DB_PORT must be numeric between 1-65535")
  END IF
  
  IF DB_USER is null OR DB_USER == "" THEN
    issues.add("DB_USER not configured")
  END IF
  
  IF DB_NAME is null OR DB_NAME == "" THEN
    issues.add("DB_NAME not configured")
  END IF
  
  // Detect common Aiven hostname format
  IF DB_HOST contains "aivencloud.com" THEN
    // Validate hostname format: name-id.region.aivencloud.com
    // Log if format looks suspicious
  END IF
  
  RETURN { hasErrors: issues.length > 0, errors: issues }
END FUNCTION

FUNCTION testDnsResolution(hostname)
  TRY
    ipAddress := dns.resolve4(hostname)  // Node.js dns.resolve4()
    RETURN { failed: false, ipAddress: ipAddress[0] }
  CATCH error
    RETURN { 
      failed: true, 
      error: error.message,
      errorCode: error.code
    }
  END TRY
END FUNCTION

FUNCTION logConnectionDiagnostics(error, hostname, port, user, dbname, sslEnabled)
  diagnostics := {
    timestamp: now(),
    attemptedHostname: hostname,
    attemptedPort: port,
    database: dbname,
    user: user,
    password: "***",  // ALWAYS mask
    sslEnabled: sslEnabled,
    errorCode: error.code,
    errorMessage: error.message,
    sqlState: error.sqlState || "N/A"
  }
  
  LOG "CONNECTION DIAGNOSTIC INFORMATION:"
  LOG "  Hostname: " + diagnostics.attemptedHostname
  LOG "  Port: " + diagnostics.attemptedPort
  LOG "  Database: " + diagnostics.database
  LOG "  User: " + diagnostics.user
  LOG "  Password: " + diagnostics.password
  LOG "  SSL: " + diagnostics.sslEnabled
  LOG "  Error Code: " + diagnostics.errorCode
  LOG "  Error Message: " + diagnostics.errorMessage
  
  RETURN diagnostics
END FUNCTION

FUNCTION categorizeError(error) for ENOTFOUND
  IF error.code == "ENOTFOUND" THEN
    RETURN {
      statusCode: 500,
      clientMessage: "Database connection unavailable. The hostname cannot be resolved. " +
                     "Please verify your database configuration. Contact support if this persists.",
      errorCategory: "HOSTNAME_RESOLUTION_ERROR",
      shouldLog: true,
      logLevel: "error",
      diagnosticGuidance: [
        "The hostname " + hostname + " could not be resolved via DNS",
        "Verify the hostname is spelled correctly in your Aiven dashboard",
        "Confirm that the Aiven service exists and is active",
        "Check network connectivity from your location to Aiven infrastructure",
        "If using Render, verify environment variable DB_HOST is set in settings"
      ]
    }
  END IF
END FUNCTION

FUNCTION getConnectionStatus()
  RETURN connectionStatus
END FUNCTION
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior. The fix requires both unit tests (for diagnostic functions) and integration tests (for full connection flow).

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: 
1. Create test environment with invalid Aiven hostname (typo)
2. Set USE_DATABASE=true with invalid DB_HOST
3. Attempt to start application and observe behavior
4. Verify that ENOTFOUND error is thrown and process exits (on unfixed code)
5. Capture the error message and stack trace

**Test Cases**:

1. **Typo in Aiven Hostname Test**: 
   - Set DB_HOST to `ems-db-typo-5812.h.aivencloud.com` (intentional typo)
   - Expected on unfixed code: ENOTFOUND error, process exits or no helpful error message
   - Purpose: Verify DNS resolution fails for invalid hostname

2. **Non-existent Service Test**: 
   - Set DB_HOST to `nonexistent-service-12345.h.aivencloud.com`
   - Expected on unfixed code: ENOTFOUND error after retries
   - Purpose: Simulate deleted or unavailable Aiven service

3. **Empty Hostname Test**: 
   - Set DB_HOST to empty string
   - Expected on unfixed code: Error during connection attempt or unclear error message
   - Purpose: Catch configuration validation issues

4. **Network Unreachable Test**: 
   - Set DB_HOST to valid format but unreachable IP (if possible)
   - Expected on unfixed code: Timeout or connection refused after retries
   - Purpose: Distinguish network issues from DNS issues

5. **Invalid Port Test**: 
   - Set DB_PORT to invalid value (e.g., 0 or 999999)
   - Expected on unfixed code: Connection error without clear guidance
   - Purpose: Verify port validation

**Expected Counterexamples**:
- ENOTFOUND error thrown without diagnostic information
- Process exits on Render environment
- Error message "Database mode required" instead of actionable guidance
- No information about attempted hostname, DNS resolution status, or suggested fixes

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := initializeDatabase_fixed(input)
  ASSERT result.isConnected == false OR result.isConnected == true
  ASSERT logContains("DIAGNOSTIC INFORMATION")
  ASSERT logContains("Hostname: " + input.hostname)
  ASSERT logContains("Error Code: " + expectedErrorCode)
  ASSERT processNotExited()  // Server continues running
  ASSERT NOT logContains(input.password)  // Password never logged
END FOR
```

**Test Cases**:

1. **Hostname Resolution Failure Graceful Handling**:
   - Set DB_HOST to typo hostname with USE_DATABASE=true
   - Expected: System logs diagnostic info, continues running, no process exit
   - Verify: Logs contain hostname, DNS resolution status, suggested fixes
   - Verify: Password is masked in all logs

2. **Diagnostic Logging Completeness**:
   - Set invalid DB_HOST, observe server startup
   - Expected: Logs include hostname, port, database name, user, SSL status, error code, error message
   - Verify: All diagnostic information is present and formatted consistently
   - Verify: Password is consistently masked as "***"

3. **Connection Status Available for Fallback**:
   - Check connectionStatus after failed connection attempt
   - Expected: connectionStatus.isConnected == false
   - Expected: connectionStatus.lastError populated with error details
   - Expected: connectionStatus.diagnosticInfo contains hostname, DNS result, etc.
   - Verify: Other modules can check connectionStatus and fall back to file-based storage

4. **Process Does Not Exit on Render**:
   - Set NODE_ENV=production with invalid hostname
   - Expected: No process.exit() call, server continues running
   - Verify: Server accepts HTTP requests even without database connection
   - Verify: API endpoints return user-friendly error messages instead of 500 errors

5. **ENOTFOUND Specific Guidance**:
   - Capture error when DNS resolution fails
   - Expected: categorizeError returns HOSTNAME_RESOLUTION_ERROR category
   - Expected: Client message includes actionable guidance
   - Verify: Suggests checking hostname spelling, Aiven service, network connectivity

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  resultOriginal := initializeDatabase_original(input)
  resultFixed := initializeDatabase_fixed(input)
  ASSERT resultOriginal.isConnected == resultFixed.isConnected
  ASSERT resultOriginal.pool.config == resultFixed.pool.config
  IF resultOriginal.isConnected THEN
    ASSERT query_original(sql) == query_fixed(sql)
  END IF
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking. The fuzzing should generate:
- Valid Aiven hostnames (different regions, formats)
- Valid credentials and SSL configurations
- Various environment settings (NODE_ENV, USE_DATABASE)
- Different database names and ports

**Test Cases**:

1. **File-Based Mode Preservation**:
   - Set USE_DATABASE=false
   - Expected: No database initialization attempted, no connection pool created
   - Verify: Application uses data.json, identical behavior to original

2. **Successful Connection Preservation**:
   - Set valid Aiven credentials in test environment
   - Expected: Connection succeeds, logs "Database connected successfully"
   - Verify: Query execution behavior identical to original
   - Verify: Transaction behavior identical to original
   - Verify: Error categorization for non-connection errors unchanged

3. **Query Execution Behavior**:
   - Execute various queries on successfully connected database
   - Expected: Same results as original implementation
   - Verify: Result formatting unchanged
   - Verify: Timeout behavior (30 seconds) unchanged
   - Verify: Connection pool behavior unchanged

4. **Error Handling for Non-Connection Errors**:
   - Trigger syntax errors, constraint violations, timeouts
   - Expected: Error categorization identical to original
   - Verify: Status codes unchanged (400, 409, 500, 503)
   - Verify: Error messages follow same format
   - Verify: No password or sensitive data exposed

5. **Connection Pool Configuration**:
   - Verify pool configuration for successful connections
   - Expected: 5-20 connections, 10-minute idle timeout, keep-alive enabled
   - Verify: Configuration identical to original

6. **Shutdown Behavior**:
   - Close connection pool gracefully
   - Expected: Identical to original closePool() behavior
   - Verify: Connections properly closed
   - Verify: No errors or unhandled rejections

### Unit Tests

- **validateConfiguration()**: Test configuration validation for all parameter combinations
- **testDnsResolution()**: Test DNS resolution success and failure cases
- **logConnectionDiagnostics()**: Verify diagnostic information is formatted correctly and password is masked
- **categorizeError() for ENOTFOUND**: Verify ENOTFOUND error produces HOSTNAME_RESOLUTION_ERROR category
- **getConnectionStatus()**: Verify connection status reflects actual state after initialization

### Property-Based Tests

- **Hostname Validation**: Generate various hostname formats (valid, invalid, edge cases) and verify validation rules
- **Configuration Validation**: Generate random configuration combinations and verify all fields are validated
- **Connection Status Accuracy**: Verify connectionStatus reflects actual connection state across many scenarios
- **Diagnostic Information Completeness**: Generate various connection failures and verify diagnostic information always present
- **Password Masking**: Verify password is NEVER logged or exposed in diagnostic information

### Integration Tests

1. **Full Startup with Invalid Hostname**:
   - Start application with invalid Aiven hostname
   - Verify: Server starts successfully (no process exit)
   - Verify: Diagnostic logs are present
   - Verify: HTTP endpoints are accessible
   - Verify: API returns appropriate error responses

2. **Fallback to File-Based Storage**:
   - Simulate database connection failure
   - Attempt file-based operation
   - Verify: System falls back to data.json if database unavailable
   - Verify: Operations succeed with file-based storage

3. **Recovery After Network Restoration**:
   - Start with network unreachable condition
   - Simulate network becoming available
   - Verify: System can reconnect or user is notified

4. **Graceful Error Messages to Users**:
   - Attempt database operation with no connection
   - Verify: User receives clear error message
   - Verify: Message suggests troubleshooting steps if applicable
   - Verify: No internal error details or stack traces exposed

5. **Logging Audit Trail**:
   - Collect all logs during connection failure scenario
   - Verify: Audit trail shows all diagnostic steps
   - Verify: No sensitive information in logs except masked passwords
   - Verify: Logs follow consistent formatting

