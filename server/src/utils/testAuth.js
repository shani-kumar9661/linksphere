const dotenv = require('dotenv');
// Load environment variables
dotenv.config();

const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');

// Mock email utility before anything else load it
const emailUtil = require('./email');

let capturedVerificationToken = null;
let capturedResetToken = null;

// Override sending functions to capture tokens for verification
emailUtil.sendVerificationEmail = async (user, token) => {
  capturedVerificationToken = token;
  console.log(`  [MOCK EMAIL] Verification Email captured. Token: ${token}`);
  return { simulated: true };
};

emailUtil.sendPasswordResetEmail = async (user, token) => {
  capturedResetToken = token;
  console.log(`  [MOCK EMAIL] Password Reset Email captured. Token: ${token}`);
  return { simulated: true };
};

const PORT = 5001;
const BASE_URL = `http://localhost:${PORT}/api/v1/auth`;

let server;

const runTests = async () => {
  try {
    // 1. Connect to MongoDB
    const connectDB = require('../config/db');
    await connectDB();
    console.log('Connected to Database successfully.');

    // Clean up any test users
    await User.deleteMany({ email: 'testauth@example.com' });
    console.log('Database cleaned from old test entries.');

    // 2. Start Express app server
    server = app.listen(PORT, () => {
      console.log(`Test Server running on port ${PORT}`);
    });

    console.log('\n=======================================');
    console.log('   STARTING INTEGRATION TESTS');
    console.log('=======================================\n');

    // --- TEST 1: Register User ---
    console.log('TEST 1: Register User...');
    const regRes = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser_auth',
        email: 'testauth@example.com',
        password: 'password123'
      })
    });
    
    const regJson = await regRes.json();
    if (regRes.status !== 201) {
      throw new Error(`Registration failed: ${JSON.stringify(regJson)}`);
    }
    console.log('✓ Success (201 Created)');
    let accessToken = regJson.data.accessToken;
    const userId = regJson.data.user.id;
    console.log(`  Access Token: ${accessToken.substring(0, 25)}...`);
    console.log(`  User isVerified: ${regJson.data.user.isVerified}`);

    // Retrieve Refresh Token from cookie header
    const setCookie = regRes.headers.get('set-cookie');
    if (!setCookie || !setCookie.includes('refreshToken=')) {
      throw new Error('Refresh token cookie was not set in register response');
    }
    let refreshTokenCookie = setCookie.split(';')[0];
    console.log(`  Refresh Cookie: ${refreshTokenCookie}`);

    // --- TEST 2: Duplicate Registration Check ---
    console.log('\nTEST 2: Duplicate Registration...');
    const dupRes = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser_auth',
        email: 'testauth@example.com',
        password: 'password123'
      })
    });
    const dupJson = await dupRes.json();
    if (dupRes.status !== 400) {
      throw new Error(`Duplicate registration should fail with 400, got status: ${dupRes.status}`);
    }
    console.log(`✓ Success (400 Bad Request, message: "${dupJson.message}")`);

    // --- TEST 3: Access Protected route (/me) ---
    console.log('\nTEST 3: Access Protected route (/me)...');
    const meRes = await fetch(`${BASE_URL}/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const meJson = await meRes.json();
    if (meRes.status !== 200) {
      throw new Error(`Protected route access failed: ${JSON.stringify(meJson)}`);
    }
    console.log(`✓ Success (200 OK, User: ${meJson.data.user.username}, Verified: ${meJson.data.user.isVerified})`);

    // --- TEST 4: Access Protected route without token ---
    console.log('\nTEST 4: Access Protected route without token...');
    const unauthRes = await fetch(`${BASE_URL}/me`, { method: 'GET' });
    const unauthJson = await unauthRes.json();
    if (unauthRes.status !== 401) {
      throw new Error(`Access should be unauthorized, status: ${unauthRes.status}`);
    }
    console.log(`✓ Success (401 Unauthorized, message: "${unauthJson.message}")`);

    // --- TEST 5: Verify Email Address ---
    console.log('\nTEST 5: Verify Email Address...');
    if (!capturedVerificationToken) {
      throw new Error('No verification token captured!');
    }
    
    const verifyRes = await fetch(`${BASE_URL}/verify-email/${capturedVerificationToken}`, {
      method: 'GET'
    });
    const verifyJson = await verifyRes.json();
    if (verifyRes.status !== 200) {
      throw new Error(`Email verification failed: ${JSON.stringify(verifyJson)}`);
    }
    console.log(`✓ Success (200 OK, message: "${verifyJson.message}")`);

    // Re-fetch profile to check if isVerified has flipped
    const meVerifyRes = await fetch(`${BASE_URL}/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const meVerifyJson = await meVerifyRes.json();
    if (!meVerifyJson.data.user.isVerified) {
      throw new Error('User isVerified should be true now!');
    }
    console.log('✓ Success (isVerified is now true)');

    // --- TEST 6: Refresh Access Token (Token Rotation) ---
    console.log('\nTEST 6: Refresh Access Token...');
    const refreshRes = await fetch(`${BASE_URL}/refresh-token`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': refreshTokenCookie
      }
    });
    const refreshJson = await refreshRes.json();
    if (refreshRes.status !== 200) {
      throw new Error(`Token refresh failed: ${JSON.stringify(refreshJson)}`);
    }
    console.log('✓ Success (200 OK)');
    const newAccessToken = refreshJson.data.accessToken;
    console.log(`  New Access Token: ${newAccessToken.substring(0, 25)}...`);

    const newSetCookie = refreshRes.headers.get('set-cookie');
    if (!newSetCookie || !newSetCookie.includes('refreshToken=')) {
      throw new Error('New refresh token cookie not set in rotation');
    }
    let newRefreshTokenCookie = newSetCookie.split(';')[0];
    console.log(`  New Refresh Cookie: ${newRefreshTokenCookie}`);

    // --- TEST 7: Forgot Password Request ---
    console.log('\nTEST 7: Forgot Password Request...');
    const forgotRes = await fetch(`${BASE_URL}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'testauth@example.com' })
    });
    const forgotJson = await forgotRes.json();
    if (forgotRes.status !== 200) {
      throw new Error(`Forgot password request failed: ${JSON.stringify(forgotJson)}`);
    }
    console.log(`✓ Success (200 OK, message: "${forgotJson.message}")`);

    // --- TEST 8: Reset Password ---
    console.log('\nTEST 8: Reset Password...');
    if (!capturedResetToken) {
      throw new Error('No reset token captured!');
    }

    const resetRes = await fetch(`${BASE_URL}/reset-password/${capturedResetToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'newsecurepassword987' })
    });
    const resetJson = await resetRes.json();
    if (resetRes.status !== 200) {
      throw new Error(`Reset password failed: ${JSON.stringify(resetJson)}`);
    }
    console.log('✓ Success (200 OK)');
    const resetAccessToken = resetJson.data.accessToken;

    const resetSetCookie = resetRes.headers.get('set-cookie');
    let resetRefreshTokenCookie = resetSetCookie.split(';')[0];

    // --- TEST 9: Login with New Password ---
    console.log('\nTEST 9: Login with New Password...');
    const loginRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testauth@example.com',
        password: 'newsecurepassword987'
      })
    });
    const loginJson = await loginRes.json();
    if (loginRes.status !== 200) {
      throw new Error(`Login with new password failed: ${JSON.stringify(loginJson)}`);
    }
    console.log('✓ Success (200 OK)');
    let finalAccessToken = loginJson.data.accessToken;

    // --- TEST 10: Logout ---
    console.log('\nTEST 10: Logout...');
    const logoutRes = await fetch(`${BASE_URL}/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${finalAccessToken}` }
    });
    const logoutJson = await logoutRes.json();
    if (logoutRes.status !== 200) {
      throw new Error(`Logout failed: ${JSON.stringify(logoutJson)}`);
    }
    console.log(`✓ Success (200 OK, message: "${logoutJson.message}")`);

    // Verify logout cleared cookie
    const logoutSetCookie = logoutRes.headers.get('set-cookie');
    if (!logoutSetCookie || !logoutSetCookie.includes('max-age=0') && !logoutSetCookie.includes('Expires=')) {
      console.warn('  Warning: Set-Cookie headers did not explicitly show immediate expiration, checking fields...');
    }
    console.log(`  Logout Set-Cookie: ${logoutSetCookie}`);

    console.log('\n=======================================');
    console.log('   ALL INTEGRATION TESTS PASSED!');
    console.log('=======================================\n');

    cleanup(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:');
    console.error(err);
    cleanup(1);
  }
};

const cleanup = async (exitCode) => {
  console.log('Cleaning up database and connections...');
  try {
    await User.deleteMany({ email: 'testauth@example.com' });
    console.log('Test user deleted.');
  } catch (err) {
    console.error('Error during test database cleanup:', err);
  }
  
  if (server) {
    server.close(() => {
      console.log('Test server closed.');
      mongoose.connection.close().then(() => {
        console.log('Database connection closed. Exiting...');
        process.exit(exitCode);
      });
    });
  } else {
    mongoose.connection.close().then(() => {
      process.exit(exitCode);
    });
  }
};

runTests();
