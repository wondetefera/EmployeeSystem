# Implementation Plan: Daily Analytics Email Notifications

## Overview

This implementation plan breaks down the Daily Analytics Email Notifications feature into discrete implementation tasks. The feature adds analytics tracking middleware, interaction API endpoints, data persistence in the existing data.json structure, and automated daily email reports to administrators. The implementation follows a bottom-up approach: data layer first, then analytics tracking, then email generation and scheduling, and finally client-side integration.

## Tasks

- [ ] 1. Set up dependencies and analytics data structure
  - Install required npm packages: `nodemailer@^6.9.0` and `node-cron@^3.0.0`
  - Initialize analytics data structure in data.json with `pageVisits` and `interactions` arrays
  - Add email configuration section to config.json with SMTP settings and sendTime
  - _Requirements: 7.1, 7.4, 8.1, 8.2_

- [ ] 2. Implement Analytics Repository
  - [ ] 2.1 Create Analytics_Repository module with core storage functions
    - Implement `recordPageVisit(userId, pageName)` to store visit records with timestamp and date fields
    - Implement `recordInteraction(userId, pageName, interactionType, elementId)` to store interaction records
    - Ensure ISO 8601 timestamp format and YYYY-MM-DD date format
    - Integrate with existing `saveData()` and `loadData()` functions
    - _Requirements: 1.1, 1.2, 1.5, 2.5, 2.6, 7.2, 7.3, 7.5, 7.6_

  - [ ]* 2.2 Write property test for page visit recording completeness (Property 1)
    - **Property 1: Page Visit Recording Completeness**
    - **Validates: Requirements 1.1, 1.2**
    - Generate random authenticated users and tracked pages
    - Verify all required fields present: user_id, page_name, timestamp, date

  - [ ]* 2.3 Write property test for timestamp format consistency (Property 5)
    - **Property 5: Timestamp Format Consistency**
    - **Validates: Requirements 7.5, 7.6**
    - Generate random visit and interaction records
    - Verify timestamp matches ISO 8601 format and date matches YYYY-MM-DD format

  - [ ] 2.4 Implement aggregation methods for daily statistics
    - Implement `getVisitsByDateRange(startDate, endDate)` to retrieve page visits
    - Implement `getInteractionsByDateRange(startDate, endDate)` to retrieve interactions
    - Implement `aggregateDailyVisits(date)` to count unique (user, page, day) tuples
    - Implement `aggregateInteractionsByType(date)` to group interactions by type
    - _Requirements: 1.3, 3.1, 3.2, 3.3, 5.2, 5.4_

  - [ ]* 2.5 Write property test for daily visit deduplication (Property 2)
    - **Property 2: Daily Visit Deduplication**
    - **Validates: Requirements 1.3, 3.1, 3.2, 3.3**
    - Generate arrays of visits with same user/page/day combinations
    - Verify aggregation counts exactly one Daily_Visit per unique tuple

  - [ ]* 2.6 Write property test for visit record schema compliance (Property 6)
    - **Property 6: Visit Record Schema Compliance**
    - **Validates: Requirements 7.2**
    - Generate random page visit records
    - Verify exactly required fields present: user_id, page_name, timestamp, date

  - [ ]* 2.7 Write property test for interaction record schema compliance (Property 7)
    - **Property 7: Interaction Record Schema Compliance**
    - **Validates: Requirements 7.3**
    - Generate random interaction records
    - Verify exactly required fields present: user_id, page_name, interaction_type, element_id, timestamp, date

- [ ] 3. Implement Analytics Middleware for page visit tracking
  - [ ] 3.1 Add Analytics_Middleware to server request handler
    - Create `isTrackedPage(pathname)` helper to check if path is one of 12 tracked pages
    - Add middleware before routing logic in `http.createServer()` handler
    - Extract user_id from session using existing `getSession(req)` function
    - Call `recordPageVisit()` for GET requests to tracked pages
    - Implement non-blocking error handling (log errors, don't block response)
    - _Requirements: 1.1, 1.2, 1.4, 1.6_

  - [ ]* 3.2 Write property test for role-agnostic tracking (Property 3)
    - **Property 3: Role-Agnostic Tracking**
    - **Validates: Requirements 1.6**
    - Generate users with various roles (admin, manager, employee)
    - Verify page visits recorded equally for all roles

  - [ ]* 3.3 Write unit tests for Analytics_Middleware
    - Test page visit recorded for GET requests to tracked pages
    - Test visits not recorded for API endpoints
    - Test visits not recorded for static assets
    - Test graceful handling of missing session

- [ ] 4. Checkpoint - Test analytics tracking
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement Interaction API endpoint
  - [ ] 5.1 Create POST /api/analytics/interaction endpoint
    - Add route handler in `handleAPI()` function
    - Extract session to get user_id, return 401 if no session
    - Validate interaction_type is one of: button_click, form_submission, dropdown_selection, tab_change
    - Call Analytics_Repository.recordInteraction() with request body data
    - Return success response with appropriate error handling
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 5.2 Write property test for interaction recording with type classification (Property 4)
    - **Property 4: Interaction Recording with Type Classification**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
    - Generate random interactions of all 4 types
    - Verify all required fields recorded correctly for each type

  - [ ]* 5.3 Write unit tests for interaction API endpoint
    - Test POST /api/analytics/interaction records interaction
    - Test 401 returned for missing session
    - Test 400 returned for invalid interaction_type
    - Test success response format

- [ ] 6. Implement Email Generator
  - [ ] 6.1 Create Email_Generator module with HTML template
    - Implement `generateEmailHTML(date, visitsByPage, interactionsByType)` function
    - Create HTML email template with tables for visits and interactions
    - Include all 12 tracked pages in visit table with zero counts for unused pages
    - Include all 4 interaction types in interaction table
    - Calculate and display totals for visits and interactions
    - Handle empty data case with "No activity was recorded" message
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 6.2 Write property test for email content date range inclusion (Property 8)
    - **Property 8: Email Content Date Range Inclusion**
    - **Validates: Requirements 5.1**
    - Generate random dates for email generation
    - Verify date appears in email content

  - [ ]* 6.3 Write property test for email visit table completeness (Property 9)
    - **Property 9: Email Visit Table Completeness**
    - **Validates: Requirements 5.2, 5.7**
    - Generate partial visit data (some pages missing)
    - Verify all 12 tracked pages included in email HTML with zero counts

  - [ ]* 6.4 Write property test for email total visit count accuracy (Property 10)
    - **Property 10: Email Total Visit Count Accuracy**
    - **Validates: Requirements 5.3**
    - Generate random visit counts per page
    - Verify total equals sum of individual page counts

  - [ ]* 6.5 Write property test for email interaction breakdown completeness (Property 11)
    - **Property 11: Email Interaction Breakdown Completeness**
    - **Validates: Requirements 5.4**
    - Generate interaction data with some types missing
    - Verify all 4 interaction types included in email

  - [ ]* 6.6 Write property test for email total interaction count accuracy (Property 12)
    - **Property 12: Email Total Interaction Count Accuracy**
    - **Validates: Requirements 5.5**
    - Generate random interaction counts by type
    - Verify total equals sum of type counts

  - [ ]* 6.7 Write property test for email HTML format validity (Property 13)
    - **Property 13: Email HTML Format Validity**
    - **Validates: Requirements 5.6**
    - Generate various email content scenarios
    - Verify HTML can be parsed without errors

  - [ ]* 6.8 Write unit tests for email generation
    - Test HTML generation with sample visit and interaction data
    - Test empty data scenario includes "no activity" message
    - Test all tracked pages included with zero counts
    - Test subject line format includes date

- [ ] 7. Checkpoint - Test email generation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement Email Sender
  - [ ] 8.1 Create Email_Sender module with SMTP integration
    - Install and configure nodemailer with SMTP settings from config.json
    - Implement `sendDailyEmail(htmlContent, date)` function
    - Query users object to filter admin role users and extract email addresses
    - Send email to each admin user with subject including date
    - Implement error handling: log success/failure with timestamp and recipient
    - Handle missing SMTP configuration gracefully (log error, skip sending)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.3, 8.5_

  - [ ]* 8.2 Write property test for admin-only email recipients (Property 14)
    - **Property 14: Admin-Only Email Recipients**
    - **Validates: Requirements 6.1**
    - Generate users object with mixed roles
    - Verify only admin role users receive emails

  - [ ]* 8.3 Write property test for email subject date inclusion (Property 15)
    - **Property 15: Email Subject Date Inclusion**
    - **Validates: Requirements 6.5**
    - Generate random dates for email sending
    - Verify subject line includes the report date

  - [ ]* 8.4 Write property test for SMTP configuration validation (Property 16)
    - **Property 16: SMTP Configuration Validation**
    - **Validates: Requirements 8.5**
    - Generate various SMTP config objects (valid and invalid)
    - Verify validation correctly identifies required fields

  - [ ]* 8.5 Write unit tests for email sender
    - Test admin user filtering from users object
    - Test SMTP configuration validation
    - Test error logging for failed sends (mock transporter)
    - Test success logging for successful sends

- [ ] 9. Implement Email Scheduler
  - [ ] 9.1 Create Email_Scheduler with node-cron
    - Install and configure node-cron scheduler
    - Read `email.sendTime` from config.json, default to "09:00" if missing
    - Convert HH:MM format to cron expression (e.g., "09:00" → "0 9 * * *")
    - Implement `generateAndSendDailyEmail()` function that:
      - Calculates yesterday's date
      - Calls Analytics_Repository aggregation methods
      - Calls Email_Generator to create HTML
      - Calls Email_Sender to deliver emails
    - Schedule cron job to run at configured time
    - Implement error handling (log errors, continue scheduling)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 8.2, 8.4_

  - [ ]* 9.2 Write integration tests for email scheduler
    - Test scheduler triggers at configured time (mock system time)
    - Test default time used when configuration invalid
    - Test no backlog emails sent after server restart
    - Test email generation with empty data

- [ ] 10. Checkpoint - Test end-to-end email workflow
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Add client-side interaction tracking
  - [ ] 11.1 Create client-side analytics JavaScript module
    - Create `assets/js/analytics.js` file
    - Implement function to send POST request to `/api/analytics/interaction`
    - Add event listeners for button clicks (event delegation)
    - Add event listeners for form submissions
    - Add event listeners for dropdown selections
    - Add event listeners for tab changes
    - Use fire-and-forget pattern (don't wait for response)
    - Include error handling (log failures, don't interrupt user workflow)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 11.2 Integrate analytics.js into all tracked pages
    - Add script tag to load analytics.js in all 12 tracked pages
    - Ensure script loads after DOM is ready
    - Test interaction tracking on various pages
    - _Requirements: 1.4_

  - [ ]* 11.3 Write integration tests for client-side tracking
    - Test button click tracking sends correct data
    - Test form submission tracking sends correct data
    - Test dropdown selection tracking sends correct data
    - Test tab change tracking sends correct data

- [ ] 12. Final checkpoint - Full system integration test
  - Test complete workflow: page visit → storage → daily email generation → email delivery
  - Verify analytics data persists correctly in data.json
  - Verify email scheduler triggers at configured time
  - Verify emails delivered to admin users only
  - Verify email content includes all required data
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for faster MVP delivery
- The implementation follows a bottom-up approach: data layer → tracking → email generation → scheduling → client integration
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and provide opportunities to address issues before proceeding
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1"]
    },
    {
      "id": 1,
      "tasks": ["2.1", "2.4"]
    },
    {
      "id": 2,
      "tasks": ["2.2", "2.3", "2.5", "2.6", "2.7", "3.1"]
    },
    {
      "id": 3,
      "tasks": ["3.2", "3.3", "5.1"]
    },
    {
      "id": 4,
      "tasks": ["5.2", "5.3", "6.1"]
    },
    {
      "id": 5,
      "tasks": ["6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8", "8.1"]
    },
    {
      "id": 6,
      "tasks": ["8.2", "8.3", "8.4", "8.5", "9.1"]
    },
    {
      "id": 7,
      "tasks": ["9.2", "11.1"]
    },
    {
      "id": 8,
      "tasks": ["11.2", "11.3"]
    }
  ]
}
```
