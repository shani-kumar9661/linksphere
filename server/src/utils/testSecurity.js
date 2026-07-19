const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const Url = require('../models/Url');
const emailUtil = require('./email');

// Mock email utility to prevent real SMTP connections
emailUtil.sendVerificationEmail = async () => ({ simulated: true });
emailUtil.sendPasswordResetEmail = async () => ({ simulated: true });

const PORT = 5004;
const BASE_URL = `http://localhost:${PORT}`;

let server;
let testUserToken;
let testUserId;
let testUrlId;

const runTests = async () => {
  try {
    // 1. Connect DB
    const connectDB = require('../config/db');
    await connectDB();
    console.log('Connected to Database successfully.');

    // Cleanup
    await User.deleteMany({ email: 'testsecurity@example.com' });
    console.log('Database cleaned from old test entries.');

    // 2. Start Express Server
    server = app.listen(PORT, () => {
      console.log(`Test Security Server running on port ${PORT}`);
    });

    console.log('\n=======================================');
    console.log('    STARTING SECURITY CONFORMANCE TESTS');
    console.log('=======================================\n');

    // --- TEST 1: Register Test User ---
    console.log('TEST 1: Registering test user...');
    const regRes = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'sec_tester',
        email: 'testsecurity@example.com',
        password: 'password123'
      })
    });
    const regJson = await regRes.json();
    if (regRes.status !== 201) {
      throw new Error(`Registration failed: ${JSON.stringify(regJson)}`);
    }
    testUserToken = regJson.data.accessToken;
    testUserId = regJson.data.user.id;
    console.log('✓ Success: Registered test user');

    // Force verify the user in database to enable full features
    await User.findByIdAndUpdate(testUserId, { isVerified: true });
    console.log('✓ Success: Verified test user in database');

    // --- TEST 2: Input Validation - Invalid Email ---
    console.log('\nTEST 2: Input Validation - Invalid Email...');
    const valEmailRes = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'sec_tester2',
        email: 'invalid-email-format',
        password: 'password123'
      })
    });
    const valEmailJson = await valEmailRes.json();
    if (valEmailRes.status !== 400) {
      throw new Error(`Expected 400 Bad Request, got status: ${valEmailRes.status}`);
    }
    console.log(`✓ Success: Rejected invalid email format (message: "${valEmailJson.message}")`);

    // --- TEST 3: Input Validation - Short Password ---
    console.log('\nTEST 3: Input Validation - Short Password...');
    const valPassRes = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'sec_tester3',
        email: 'sec3@example.com',
        password: 'short'
      })
    });
    const valPassJson = await valPassRes.json();
    if (valPassRes.status !== 400) {
      throw new Error(`Expected 400 Bad Request, got status: ${valPassRes.status}`);
    }
    console.log(`✓ Success: Rejected short password (message: "${valPassJson.message}")`);

    // --- TEST 4: Input Validation - Invalid MongoDB ID Parameter ---
    console.log('\nTEST 4: Input Validation - Invalid MongoDB ID Parameter...');
    const valIdRes = await fetch(`${BASE_URL}/api/v1/urls/invalid-mongo-id`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${testUserToken}`,
        'Content-Type': 'application/json'
      }
    });
    const valIdJson = await valIdRes.json();
    if (valIdRes.status !== 400) {
      throw new Error(`Expected 400 Bad Request for invalid mongo id parameter, got status: ${valIdRes.status}`);
    }
    console.log(`✓ Success: Rejected invalid MongoDB ID param format (message: "${valIdJson.message}")`);

    // --- TEST 5: XSS Sanitization (HTML Tag Stripping) ---
    console.log('\nTEST 5: XSS Sanitization (HTML Tag Stripping)...');
    const xssPayload = '<script>alert("hack")</script>This is a safe note';
    const xssTitle = 'Safe <img src="x" onerror="alert(1)"> Title';
    const createUrlRes = await fetch(`${BASE_URL}/api/v1/urls`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testUserToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        originalUrl: 'http://example.com/safe',
        note: xssPayload,
        title: xssTitle
      })
    });
    const createUrlJson = await createUrlRes.json();
    if (createUrlRes.status !== 201) {
      throw new Error(`URL creation failed with XSS payload: ${JSON.stringify(createUrlJson)}`);
    }
    
    testUrlId = createUrlJson.data.url.id;
    // Retrieve the URL from the database to see what was actually saved
    const savedUrl = await Url.findById(testUrlId);
    
    console.log(`  Original Note sent: "${xssPayload}"`);
    console.log(`  Saved Note in DB:   "${savedUrl.note}"`);
    console.log(`  Original Title sent: "${xssTitle}"`);
    console.log(`  Saved Title in DB:   "${savedUrl.title}"`);

    if (savedUrl.note.includes('<script>') || savedUrl.title.includes('onerror')) {
      throw new Error('XSS payload was saved to the database without sanitization!');
    }
    console.log('✓ Success: XSS HTML tags and alert handlers were stripped successfully');

    // --- TEST 6: MongoDB (NoSQL) Injection Protection ---
    console.log('\nTEST 6: MongoDB Query Injection Protection...');
    // We send a query operator payload: { "$gt": "" } which is a classic injection vector
    const nosqlRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: { '$gt': '' },
        password: 'password123'
      })
    });
    const nosqlJson = await nosqlRes.json();
    
    // If mongoSanitize works, it deletes the $gt key, leaving an empty/invalid email object, which triggers 400 Bad Request validator error.
    if (nosqlRes.status !== 400) {
      throw new Error(`Expected 400 Bad Request due to sanitization leaving email field invalid, got status: ${nosqlRes.status}. Body: ${JSON.stringify(nosqlJson)}`);
    }
    console.log(`✓ Success: MongoDB injection operator was stripped (returned 400: "${nosqlJson.message}")`);

    // --- TEST 7: Auth Endpoint Rate Limiter ---
    console.log('\nTEST 7: Auth Endpoint Rate Limiter...');
    console.log('  Triggering 12 rapid login requests to exceed the limit of 10...');
    let hitRateLimit = false;
    let rateLimitMessage = '';
    
    for (let i = 0; i < 12; i++) {
      const limitRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'testsecurity@example.com',
          password: 'password123'
        })
      });
      
      if (limitRes.status === 429) {
        hitRateLimit = true;
        const limitJson = await limitRes.json();
        rateLimitMessage = limitJson.message;
        console.log(`  Request #${i + 1} blocked with 429 Too Many Requests`);
        break;
      } else {
        console.log(`  Request #${i + 1} returned status ${limitRes.status}`);
      }
    }

    if (!hitRateLimit) {
      throw new Error('Rate limiter failed to block requests after exceeding the maximum limit!');
    }
    console.log(`✓ Success: Auth rate limiter successfully triggered (message: "${rateLimitMessage}")`);

    console.log('\n=======================================');
    console.log('   ALL SECURITY TESTS CONFORM & PASSED!');
    console.log('=======================================\n');

  } catch (error) {
    console.error('\n❌ SECURITY TEST FAILED:');
    console.error(error);
    process.exitCode = 1;
  } finally {
    console.log('Cleaning up database and connections...');
    if (testUserId) {
      await User.deleteMany({ _id: testUserId });
      await Url.deleteMany({ createdBy: testUserId });
    }
    if (server) {
      server.close();
      console.log('Test security server closed.');
    }
    await mongoose.connection.close();
    console.log('Database connection closed. Exiting...');
  }
};

runTests();
