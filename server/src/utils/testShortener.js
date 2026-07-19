const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const Url = require('../models/Url');
const emailUtil = require('./email');

// Mock email utility to avoid real SMTP connections
emailUtil.sendVerificationEmail = async () => ({ simulated: true });
emailUtil.sendPasswordResetEmail = async () => ({ simulated: true });

const PORT = 5002;
const BASE_URL = `http://localhost:${PORT}`;

let server;
let accessToken;
let testUserId;
let shortCode1;
let urlId1;
let customAlias = 'my-custom-test-link';

const runTests = async () => {
  try {
    // 1. Connect DB
    const connectDB = require('../config/db');
    await connectDB();
    console.log('Connected to Database successfully.');

    // Cleanup
    await User.deleteMany({ email: 'testshortener@example.com' });
    await Url.deleteMany({ customAlias: customAlias });
    console.log('Database cleaned from old test entries.');

    // 2. Start Express Server
    server = app.listen(PORT, () => {
      console.log(`Test Server running on port ${PORT}`);
    });

    console.log('\n=======================================');
    console.log('   STARTING SHORTENER INTEGRATION TESTS');
    console.log('=======================================\n');

    // --- TEST 1: Register and Verify Test User ---
    console.log('TEST 1: Register and verify test user...');
    const regRes = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser_short',
        email: 'testshortener@example.com',
        password: 'password123'
      })
    });
    
    const regJson = await regRes.json();
    if (regRes.status !== 201) {
      throw new Error(`Registration failed: ${JSON.stringify(regJson)}`);
    }
    
    accessToken = regJson.data.accessToken;
    testUserId = regJson.data.user.id;
    console.log(`✓ Success: Registered user. ID: ${testUserId}`);

    // Verify user in DB so they are verified
    await User.findByIdAndUpdate(testUserId, { isVerified: true });
    console.log('✓ Success: Force-verified test user in database');

    // --- TEST 2: Create Short URL (Normal Generator) ---
    console.log('\nTEST 2: Create Short URL...');
    const createRes1 = await fetch(`${BASE_URL}/api/v1/urls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        originalUrl: 'github.com/google',
        title: 'Google GitHub'
      })
    });

    const createJson1 = await createRes1.json();
    if (createRes1.status !== 201) {
      throw new Error(`URL creation failed: ${JSON.stringify(createJson1)}`);
    }

    urlId1 = createJson1.data.url.id;
    shortCode1 = createJson1.data.url.shortCode;
    console.log(`✓ Success (201 Created)`);
    console.log(`  Short Code: ${shortCode1}`);
    console.log(`  Normalized URL: ${createJson1.data.url.originalUrl}`);
    console.log(`  Title: ${createJson1.data.url.title}`);

    // --- TEST 3: Create Short URL with Custom Alias ---
    console.log('\nTEST 3: Create Short URL with Custom Alias...');
    const createRes2 = await fetch(`${BASE_URL}/api/v1/urls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        originalUrl: 'https://news.ycombinator.com',
        customAlias: customAlias
      })
    });

    const createJson2 = await createRes2.json();
    if (createRes2.status !== 201) {
      throw new Error(`URL custom alias creation failed: ${JSON.stringify(createJson2)}`);
    }
    console.log(`✓ Success (201 Created)`);
    console.log(`  Custom Alias: ${createJson2.data.url.customAlias}`);

    // --- TEST 4: Duplicate Custom Alias Check ---
    console.log('\nTEST 4: Duplicate Custom Alias Check...');
    const dupRes = await fetch(`${BASE_URL}/api/v1/urls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        originalUrl: 'http://example.com',
        customAlias: customAlias
      })
    });

    const dupJson = await dupRes.json();
    if (dupRes.status !== 400) {
      throw new Error(`Duplicate alias should have failed, got status: ${dupRes.status}`);
    }
    console.log(`✓ Success (400 Bad Request, message: "${dupJson.message}")`);

    // --- TEST 4b: Case-Insensitive Duplicate Custom Alias Check ---
    console.log('\nTEST 4b: Case-Insensitive Duplicate Custom Alias Check...');
    const dupCaseRes = await fetch(`${BASE_URL}/api/v1/urls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        originalUrl: 'http://example.com',
        customAlias: customAlias.toUpperCase()
      })
    });

    const dupCaseJson = await dupCaseRes.json();
    if (dupCaseRes.status !== 400) {
      throw new Error(`Case-insensitive duplicate alias should have failed, got status: ${dupCaseRes.status}`);
    }
    console.log(`✓ Success (400 Bad Request, message: "${dupCaseJson.message}")`);

    // --- TEST 4c: Alias Format Validation Check ---
    console.log('\nTEST 4c: Alias Format Validation Check...');
    // Shorter than 3 chars
    const shortValRes = await fetch(`${BASE_URL}/api/v1/urls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        originalUrl: 'http://example.com',
        customAlias: 'ab'
      })
    });
    const shortValJson = await shortValRes.json();
    if (shortValRes.status !== 400) {
      throw new Error(`Short alias should have failed, got status: ${shortValRes.status}`);
    }
    console.log(`✓ Success: Rejected short alias (message: "${shortValJson.message}")`);

    // Invalid characters
    const invalidCharRes = await fetch(`${BASE_URL}/api/v1/urls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        originalUrl: 'http://example.com',
        customAlias: 'invalid alias!'
      })
    });
    const invalidCharJson = await invalidCharRes.json();
    if (invalidCharRes.status !== 400) {
      throw new Error(`Invalid character alias should have failed, got status: ${invalidCharRes.status}`);
    }
    console.log(`✓ Success: Rejected invalid chars alias (message: "${invalidCharJson.message}")`);

    // --- TEST 4d: Reserved Words Check ---
    console.log('\nTEST 4d: Reserved Words Check...');
    const reservedRes = await fetch(`${BASE_URL}/api/v1/urls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        originalUrl: 'http://example.com',
        customAlias: 'login'
      })
    });
    const reservedJson = await reservedRes.json();
    if (reservedRes.status !== 400) {
      throw new Error(`Reserved word alias should have failed, got status: ${reservedRes.status}`);
    }
    console.log(`✓ Success: Rejected reserved word alias (message: "${reservedJson.message}")`);

    // --- TEST 5: Get All User URLs ---
    console.log('\nTEST 5: Get All User URLs...');
    const getRes = await fetch(`${BASE_URL}/api/v1/urls`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const getJson = await getRes.json();
    if (getRes.status !== 200) {
      throw new Error(`Fetch all URLs failed: ${JSON.stringify(getJson)}`);
    }
    console.log(`✓ Success: Found ${getJson.results} URLs (expected 2)`);
    if (getJson.results !== 2) {
      throw new Error(`Expected 2 URLs, found ${getJson.results}`);
    }

    // --- TEST 6: Test Short Link Redirection ---
    console.log(`\nTEST 6: Test Short Link Redirection (/:shortCode)...`);
    // Note: We use redirect: 'manual' to intercept the redirect and inspect headers instead of following it
    const redirRes = await fetch(`${BASE_URL}/${shortCode1}`, {
      method: 'GET',
      redirect: 'manual'
    });

    console.log(`  Response Status: ${redirRes.status}`);
    const redirectLocation = redirRes.headers.get('location');
    console.log(`  Redirect Location Header: ${redirectLocation}`);

    if (redirRes.status !== 302 && redirRes.status !== 0) { // status 0 is returned by fetch when manual redirect intercepts it sometimes in node-fetch or browser, let's verify
      // But standard node fetch on local server usually returns 302
      if (redirRes.status !== 302) {
        throw new Error(`Redirect failed, expected 302 status, got: ${redirRes.status}`);
      }
    }
    if (redirectLocation !== 'http://github.com/google') {
      throw new Error(`Expected redirect to 'http://github.com/google', got: '${redirectLocation}'`);
    }
    console.log(`✓ Success (302 Redirect to http://github.com/google)`);

    // --- TEST 6b: Test Custom Alias Redirection (Case-Insensitive) ---
    console.log(`\nTEST 6b: Test Custom Alias Redirection (Case-Insensitive)...`);
    const customRedirRes = await fetch(`${BASE_URL}/${customAlias.toUpperCase()}`, {
      method: 'GET',
      redirect: 'manual'
    });

    console.log(`  Response Status: ${customRedirRes.status}`);
    const customRedirectLocation = customRedirRes.headers.get('location');
    console.log(`  Redirect Location Header: ${customRedirectLocation}`);

    if (customRedirRes.status !== 302 && customRedirRes.status !== 0) {
      if (customRedirRes.status !== 302) {
        throw new Error(`Custom alias redirect failed, expected 302 status, got: ${customRedirRes.status}`);
      }
    }
    if (customRedirectLocation !== 'https://news.ycombinator.com') {
      throw new Error(`Expected redirect to 'https://news.ycombinator.com', got: '${customRedirectLocation}'`);
    }
    console.log(`✓ Success (302 Redirect to https://news.ycombinator.com)`);

    // --- TEST 7: Verify Click Count Incremented ---
    console.log('\nTEST 7: Verify click counter...');
    const verifyRes = await fetch(`${BASE_URL}/api/v1/urls/${urlId1}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const verifyJson = await verifyRes.json();
    console.log(`  Clicks for ${shortCode1}: ${verifyJson.data.url.clicks}`);
    if (verifyJson.data.url.clicks !== 1) {
      throw new Error(`Expected clicks count to be 1, got ${verifyJson.data.url.clicks}`);
    }
    console.log('✓ Success (clicks count incremented to 1)');

    // --- TEST 8: Delete URL ---
    console.log('\nTEST 8: Delete URL...');
    const deleteRes = await fetch(`${BASE_URL}/api/v1/urls/${urlId1}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (deleteRes.status !== 204) {
      const deleteJson = await deleteRes.json();
      throw new Error(`Deletion failed: ${JSON.stringify(deleteJson)}`);
    }
    console.log('✓ Success (204 No Content)');

    // Verify deletion
    const getFinalRes = await fetch(`${BASE_URL}/api/v1/urls`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const getFinalJson = await getFinalRes.json();
    console.log(`  Remaining URLs: ${getFinalJson.results} (expected 1)`);
    if (getFinalJson.results !== 1) {
      throw new Error(`Expected 1 URL, found ${getFinalJson.results}`);
    }
    console.log('✓ Success (URL confirmed deleted)');

    console.log('\n=======================================');
    console.log('   ALL SHORTENER TESTS PASSED!');
    console.log('=======================================\n');

    cleanup(0);
  } catch (err) {
    console.error('\n❌ SHORTENER TEST FAILED:');
    console.error(err);
    cleanup(1);
  }
};

const cleanup = async (exitCode) => {
  console.log('Cleaning up database and connections...');
  try {
    await User.deleteMany({ email: 'testshortener@example.com' });
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
