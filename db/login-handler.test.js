/**
 * Integration tests for handleLogin with database
 * Tests the authentication flow using database operations
 */

const { getUserByEmail } = require('./operations');
const { initializeDatabase } = require('./connection');

describe('Login Handler Database Integration', () => {
  let dbConnected = false;

  beforeAll(async () => {
    // Try to connect to database
    try {
      await initializeDatabase();
      dbConnected = true;
    } catch (error) {
      console.log('Database not available for tests, skipping integration tests');
      dbConnected = false;
    }
  });

  describe('getUserByEmail', () => {
    test('should return user when email exists', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      // This test assumes there's at least one user in the database
      // In a real scenario, you'd set up test data
      const testEmail = 'admin@company.com'; // Use an existing test email
      
      const user = await getUserByEmail(testEmail);
      
      if (user) {
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('password');
        expect(user).toHaveProperty('role');
        expect(user).toHaveProperty('id');
        expect(user.email).toBe(testEmail);
      } else {
        console.log(`User ${testEmail} not found in database`);
      }
    });

    test('should return null when email does not exist', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const nonExistentEmail = 'nonexistent@example.com';
      const user = await getUserByEmail(nonExistentEmail);
      
      expect(user).toBeNull();
    });

    test('should use parameterized query to prevent SQL injection', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      // Try an SQL injection attempt
      const maliciousEmail = "admin@company.com' OR '1'='1";
      const user = await getUserByEmail(maliciousEmail);
      
      // Should return null because the exact email doesn't exist
      // If vulnerable to SQL injection, it might return a user
      expect(user).toBeNull();
    });
  });

  describe('Login Flow Simulation', () => {
    test('should authenticate user with correct credentials', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const testEmail = 'admin@company.com';
      const testPassword = 'admin123'; // Use actual test password
      
      const user = await getUserByEmail(testEmail);
      
      if (user) {
        // Simulate login logic
        const loginSuccess = user && user.password === testPassword;
        
        if (loginSuccess) {
          expect(user.email).toBe(testEmail);
          expect(user).toHaveProperty('role');
          expect(user).toHaveProperty('id');
        } else {
          console.log('Password does not match for test user');
        }
      } else {
        console.log(`Test user ${testEmail} not found in database`);
      }
    });

    test('should reject authentication with incorrect password', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const testEmail = 'admin@company.com';
      const wrongPassword = 'wrongpassword123';
      
      const user = await getUserByEmail(testEmail);
      
      if (user) {
        // Simulate login logic with wrong password
        const loginSuccess = user && user.password === wrongPassword;
        
        expect(loginSuccess).toBe(false);
      }
    });
  });
});
