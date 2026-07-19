const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const Url = require('../models/Url');
const emailUtil = require('./email');

// Mock email utility to avoid SMTP connections
emailUtil.sendVerificationEmail = async () => ({ simulated: true });
emailUtil.sendPasswordResetEmail = async () => ({ simulated: true });

const PORT = 5003;
const BASE_URL = `http://localhost:${PORT}`;

let server;
let accessToken;
let testUserId;
let shortCode;
let urlId;

const runTests = async () => {
  try {
    // 1. Connect DB
    const connectDB = require('../config/db');
    await connectDB();
    console.log('Connected to Database successfully.');

    // Cleanup existing test user/urls
    await User.deleteMany({ email: 'testpwd@example.com' });
    await Url.deleteMany({ shortCode: 'pwd-protected-test' });
    console.log('Database cleaned from old test entries.');

    // 2. Start Express Server
    server = app.listen(PORT, () => {
      console.log(`Test Server running on port ${PORT}`);
    });

    console.log('\n=======================================');
    console.log('  STARTING PASSWORD PROTECTION TESTS');
    console.log('=======================================\n');

    // --- TEST 1: Register and Verify Test User ---
    console.log('TEST 1: Registering test user...');
    const regRes = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'pwd_tester',
        email: 'testpwd@example.com',
        password: 'password123'
      })
    });
    
    const regJson = await regRes.json();
    if (regRes.status !== 201) {
      throw new Error(`Registration failed: ${JSON.stringify(regJson)}`);
    }
    
    accessToken = regJson.data.accessToken;
    testUserId = regJson.data.user.id;
    console.log(`✓ Registered user. ID: ${testUserId}`);

    // Force-verify user
    await User.findByIdAndUpdate(testUserId, { isVerified: true });
    console.log('✓ Force-verified test user in database');

    // --- TEST 2: Create Password Protected URL ---
    console.log('\nTEST 2: Creating password-protected URL...');
    const createRes = await fetch(`${BASE_URL}/api/v1/urls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        originalUrl: 'https://news.ycombinator.com',
        title: 'Hacker News Pwd',
        customAlias: 'pwd-protected-test',
        password: 'super-secret-password-123'
      })
    });

    const createJson = await createRes.json();
    if (createRes.status !== 201) {
      throw new Error(`URL creation failed: ${JSON.stringify(createJson)}`);
    }

    urlId = createJson.data.url.id;
    shortCode = createJson.data.url.shortCode;
    console.log(`✓ URL Created. ID: ${urlId}, Short Code: ${shortCode}`);
    console.log(`✓ Is Password Protected: ${createJson.data.url.isPasswordProtected}`);

    if (createJson.data.url.isPasswordProtected !== true) {
      throw new Error('Expected isPasswordProtected to be true, got false');
    }

    // --- TEST 3: Redirect Action (Should direct to frontend prompt) ---
    console.log('\nTEST 3: Testing redirection behavior (GET /:shortCode)...');
    const redirRes = await fetch(`${BASE_URL}/${shortCode}`, {
      method: 'GET',
      redirect: 'manual'
    });

    const redirectLocation = redirRes.headers.get('location');
    console.log(`  Response Status: ${redirRes.status}`);
    console.log(`  Redirect Location Header: ${redirectLocation}`);

    const expectedFrontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/p/${shortCode}`;
    if (redirectLocation !== expectedFrontendUrl) {
      throw new Error(`Expected redirect to frontend prompt: '${expectedFrontendUrl}', got: '${redirectLocation}'`);
    }
    console.log('✓ Redirects correctly to the frontend password prompt route');

    // --- TEST 4: Verify Password with Wrong Credential ---
    console.log('\nTEST 4: Verifying with incorrect password...');
    const badVerifyRes = await fetch(`${BASE_URL}/api/v1/urls/verify-password/${shortCode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong-password' })
    });

    const badVerifyJson = await badVerifyRes.json();
    console.log(`  Response Status: ${badVerifyRes.status}`);
    console.log(`  Error Message: ${badVerifyJson.message}`);

    if (badVerifyRes.status !== 401) {
      throw new Error(`Expected status 401, got ${badVerifyRes.status}`);
    }
    console.log('✓ Rejected incorrect password successfully');

    // --- TEST 5: Verify Password with Correct Credential ---
    console.log('\nTEST 5: Verifying with correct password...');
    const goodVerifyRes = await fetch(`${BASE_URL}/api/v1/urls/verify-password/${shortCode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'super-secret-password-123' })
    });

    const goodVerifyJson = await goodVerifyRes.json();
    console.log(`  Response Status: ${goodVerifyRes.status}`);
    console.log(`  Returned Destination: ${goodVerifyJson.data.originalUrl}`);

    if (goodVerifyRes.status !== 200) {
      throw new Error(`Expected status 200, got ${goodVerifyRes.status}`);
    }
    if (goodVerifyJson.data.originalUrl !== 'https://news.ycombinator.com') {
      throw new Error(`Expected originalUrl to be 'https://news.ycombinator.com', got '${goodVerifyJson.data.originalUrl}'`);
    }
    console.log('✓ Accepted correct password and returned target destination');

    // Wait a brief moment for async analytics resolving to log
    await new Promise(r => setTimeout(r, 100));

    // --- TEST 6: Verify Click Stats Incremented ---
    console.log('\nTEST 6: Verifying clicks incremented...');
    const statsRes = await fetch(`${BASE_URL}/api/v1/urls/${urlId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const statsJson = await statsRes.json();
    console.log(`  Clicks: ${statsJson.data.url.clicks}`);
    if (statsJson.data.url.clicks !== 1) {
      throw new Error(`Expected clicks count to be 1, got ${statsJson.data.url.clicks}`);
    }
    console.log('✓ Clicks incremented correctly');

    // --- TEST 7: Update URL (Change Password) ---
    console.log('\nTEST 7: Updating URL with a new password...');
    const updateRes1 = await fetch(`${BASE_URL}/api/v1/urls/${urlId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        password: 'new-secure-password-456'
      })
    });

    const updateJson1 = await updateRes1.json();
    if (updateRes1.status !== 200) {
      throw new Error(`PATCH update failed: ${JSON.stringify(updateJson1)}`);
    }
    console.log(`✓ Password updated. isPasswordProtected: ${updateJson1.data.url.isPasswordProtected}`);

    // Verify old password fails
    const verifyOldRes = await fetch(`${BASE_URL}/api/v1/urls/verify-password/${shortCode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'super-secret-password-123' })
    });
    if (verifyOldRes.status !== 401) {
      throw new Error('Old password should be invalidated');
    }
    console.log('✓ Old password rejected');

    // Verify new password works
    const verifyNewRes = await fetch(`${BASE_URL}/api/v1/urls/verify-password/${shortCode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'new-secure-password-456' })
    });
    if (verifyNewRes.status !== 200) {
      throw new Error('New password should be accepted');
    }
    console.log('✓ New password accepted');

    // --- TEST 8: Update URL (Disable Password Protection) ---
    console.log('\nTEST 8: Disabling password protection...');
    const updateRes2 = await fetch(`${BASE_URL}/api/v1/urls/${urlId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        password: '' // empty string to disable
      })
    });

    const updateJson2 = await updateRes2.json();
    if (updateRes2.status !== 200) {
      throw new Error(`PATCH update failed: ${JSON.stringify(updateJson2)}`);
    }
    console.log(`✓ Password disabled. isPasswordProtected: ${updateJson2.data.url.isPasswordProtected}`);
    if (updateJson2.data.url.isPasswordProtected !== false) {
      throw new Error('Expected isPasswordProtected to be false after clearing password');
    }

    // --- TEST 9: Direct Redirection after disable ---
    console.log('\nTEST 9: Testing redirection behavior when unprotected...');
    const plainRedirRes = await fetch(`${BASE_URL}/${shortCode}`, {
      method: 'GET',
      redirect: 'manual'
    });

    const plainRedirectLocation = plainRedirRes.headers.get('location');
    console.log(`  Response Status: ${plainRedirRes.status}`);
    console.log(`  Redirect Location Header: ${plainRedirectLocation}`);

    if (plainRedirectLocation !== 'https://news.ycombinator.com') {
      throw new Error(`Expected direct redirect to Hacker News: 'https://news.ycombinator.com', got: '${plainRedirectLocation}'`);
    }
    console.log('✓ Redirects directly to target destination without prompt');

    console.log('\n=======================================');
    console.log('  ALL PASSWORD PROTECTION TESTS PASSED!');
    console.log('=======================================\n');

    cleanup(0);
  } catch (err) {
    console.error('\n❌ PASSWORD PROTECTION TEST FAILED:');
    console.error(err);
    cleanup(1);
  }
};

const cleanup = async (exitCode) => {
  console.log('Cleaning up database and connections...');
  try {
    await User.deleteMany({ email: 'testpwd@example.com' });
    await Url.deleteMany({ createdBy: testUserId });
    console.log('Test entries deleted.');
  } catch (err) {
    console.error('Error during database cleanup:', err);
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
