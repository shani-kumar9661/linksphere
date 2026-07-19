const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const Url = require('../models/Url');
const Click = require('../models/Click');
const Report = require('../models/Report');
const Notification = require('../models/Notification');
const { redisClient, connectRedis } = require('../config/redis');
const emailUtil = require('./email');

// Mock email send to avoid blocking or actual email SMTP failures
emailUtil.sendEmail = async (options) => {
  console.log(`[MOCK EMAIL SENT] to: ${options.to}, subject: ${options.subject}`);
  return { messageId: 'mock-id-123' };
};

const PORT = 5005;
const BASE_URL = `http://localhost:${PORT}`;

let server;
let userToken;
let adminToken;
let userId;
let adminId;
let expiredUrlId;
let expiringUrlId;
let activeUrlId;

const runTests = async () => {
  try {
    // 1. Connect DB and Redis
    const connectDB = require('../config/db');
    await connectDB();
    await connectRedis();
    console.log('Connected to Databases successfully.');

    // Cleanup existing test users/data
    await User.deleteMany({ email: { $in: ['testuser_jobs@example.com', 'admin_jobs@example.com'] } });
    console.log('Old test users removed.');

    // 2. Start Express Server
    server = app.listen(PORT, () => {
      console.log(`Test Server running on port ${PORT}`);
    });

    console.log('\n=======================================');
    console.log('   STARTING BACKGROUND JOBS INTEGRATION TESTS');
    console.log('=======================================\n');

    // --- TEST 1: Register and Verify Test User & Admin User ---
    console.log('TEST 1: Registering test user and admin...');
    
    // Register user
    const regRes = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'user_jobs',
        email: 'testuser_jobs@example.com',
        password: 'password123'
      })
    });
    const regJson = await regRes.json();
    if (regRes.status !== 201) throw new Error(`User registration failed: ${JSON.stringify(regJson)}`);
    userToken = regJson.data.accessToken;
    userId = regJson.data.user.id;
    await User.findByIdAndUpdate(userId, { isVerified: true });
    console.log(`✓ Registered User: ${userId}`);

    // Register admin
    const adminRegRes = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin_jobs',
        email: 'admin_jobs@example.com',
        password: 'password123'
      })
    });
    const adminRegJson = await adminRegRes.json();
    if (adminRegRes.status !== 201) throw new Error(`Admin registration failed: ${JSON.stringify(adminRegJson)}`);
    adminToken = adminRegJson.data.accessToken;
    adminId = adminRegJson.data.user.id;
    await User.findByIdAndUpdate(adminId, { isVerified: true, role: 'admin' });
    console.log(`✓ Registered Admin: ${adminId}`);

    // --- TEST 2: Create Test URLs ---
    console.log('\nTEST 2: Creating expired, expiring, and active URLs...');
    
    // Create Expired URL
    const expiredUrl = await Url.create({
      originalUrl: 'https://expired-url.com',
      shortCode: 'expired1',
      createdBy: userId,
      expiresAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      isActive: true
    });
    expiredUrlId = expiredUrl._id;
    console.log(`✓ Created Expired URL (expired1): ${expiredUrlId}`);

    // Create associated clicks for Expired URL
    await Click.create({ url: expiredUrlId, createdBy: userId, date: '2026-07-19', time: '10:00:00', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) });
    await Click.create({ url: expiredUrlId, createdBy: userId, date: '2026-07-19', time: '10:05:00', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) });

    // Create Expiring URL (expires in 12 hours)
    const expiringUrl = await Url.create({
      originalUrl: 'https://expiring-soon.com',
      shortCode: 'expiring2',
      createdBy: userId,
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
      isActive: true
    });
    expiringUrlId = expiringUrl._id;
    console.log(`✓ Created Expiring URL (expiring2): ${expiringUrlId}`);

    // Create clicks for Expiring URL
    await Click.create({ url: expiringUrlId, createdBy: userId, date: '2026-07-19', time: '09:00:00', timestamp: new Date() });
    
    // Create Active URL (expires in 5 days)
    const activeUrl = await Url.create({
      originalUrl: 'https://active-forever.com',
      shortCode: 'active3',
      createdBy: userId,
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      isActive: true
    });
    activeUrlId = activeUrl._id;
    console.log(`✓ Created Active URL (active3): ${activeUrlId}`);

    // Add clicks for Active URL
    await Click.create({ url: activeUrlId, createdBy: userId, date: '2026-07-19', time: '08:00:00', timestamp: new Date() });

    // --- TEST 3: Trigger 'delete-expired-urls' Job ---
    console.log('\nTEST 3: Triggering "delete-expired-urls" job via Admin API...');
    const triggerDelRes = await fetch(`${BASE_URL}/api/v1/admin/jobs/delete-expired-urls/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    const triggerDelJson = await triggerDelRes.json();
    if (triggerDelRes.status !== 200) throw new Error(`Delete Expired Job failed: ${JSON.stringify(triggerDelJson)}`);
    console.log(`✓ Job status code 200 OK. Deleted Count: ${triggerDelJson.result.deletedCount}`);

    // Verify expired URL and its clicks are deleted
    const checkExpiredUrl = await Url.findById(expiredUrlId);
    const checkExpiredClicks = await Click.find({ url: expiredUrlId });
    if (checkExpiredUrl !== null || checkExpiredClicks.length > 0) {
      throw new Error(`Expired URL or its clicks were not deleted from DB! URL: ${checkExpiredUrl}, Clicks count: ${checkExpiredClicks.length}`);
    }
    console.log('✓ Success: Expired URL and clicks deleted from DB.');

    // Verify user notification was created
    const notification = await Notification.findOne({ user: userId, type: 'link_expired' });
    if (!notification) {
      throw new Error('Notification for expired URL was not created!');
    }
    console.log(`✓ Success: User notification created: "${notification.title}" - "${notification.message}"`);

    // --- TEST 4: Trigger 'send-reminders' Job ---
    console.log('\nTEST 4: Triggering "send-reminders" job via Admin API...');
    const triggerRemindRes = await fetch(`${BASE_URL}/api/v1/admin/jobs/send-reminders/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    const triggerRemindJson = await triggerRemindRes.json();
    if (triggerRemindRes.status !== 200) throw new Error(`Send Reminders Job failed: ${JSON.stringify(triggerRemindJson)}`);
    console.log(`✓ Job status code 200 OK. Expiration Reminders: ${triggerRemindJson.result.expirationRemindersCount}`);

    // Verify expiringUrl has expirationReminderSent = true
    const checkExpiringUrl = await Url.findById(expiringUrlId);
    if (!checkExpiringUrl.expirationReminderSent) {
      throw new Error('Expiring URL reminder status was not set to true!');
    }
    const checkActiveUrl = await Url.findById(activeUrlId);
    if (checkActiveUrl.expirationReminderSent) {
      throw new Error('Active URL expiration reminder status was set to true incorrectly!');
    }
    console.log('✓ Success: Expiring URL reminder status updated. Active URL unaffected.');

    // --- TEST 5: Trigger 'generate-reports' Job ---
    console.log('\nTEST 5: Triggering "generate-reports" job via Admin API...');
    const triggerRepRes = await fetch(`${BASE_URL}/api/v1/admin/jobs/generate-reports/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    const triggerRepJson = await triggerRepRes.json();
    if (triggerRepRes.status !== 200) throw new Error(`Generate Reports Job failed: ${JSON.stringify(triggerRepJson)}`);
    console.log(`✓ Job status code 200 OK. Reports generated: ${triggerRepJson.result.reportsCount}`);

    // Verify report created for user in DB
    const report = await Report.findOne({ user: userId });
    if (!report) {
      throw new Error('Analytics Report was not created for test user!');
    }
    console.log(`✓ Success: Analytics report created in DB. Report ID: ${report._id}`);
    console.log(`  Clicks This Week: ${report.clicksThisWeek}`);
    console.log(`  Total Clicks: ${report.totalClicks}`);
    if (report.mostPopularUrl) {
      console.log(`  Most Popular URL shortCode: ${report.mostPopularUrl.shortCode}`);
    }

    // --- TEST 6: Get User Reports via User API ---
    console.log('\nTEST 6: Retrieving reports via User API...');
    const getRepRes = await fetch(`${BASE_URL}/api/v1/reports`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      }
    });
    const getRepJson = await getRepRes.json();
    if (getRepRes.status !== 200) throw new Error(`Fetch user reports failed: ${JSON.stringify(getRepJson)}`);
    if (getRepJson.data.reports.length === 0) {
      throw new Error('Reports list returned empty array!');
    }
    console.log(`✓ Success: Retrieved ${getRepJson.data.reports.length} report(s).`);
    const userReportId = getRepJson.data.reports[0]._id;

    // Fetch individual report details
    const getRepDetailRes = await fetch(`${BASE_URL}/api/v1/reports/${userReportId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      }
    });
    const getRepDetailJson = await getRepDetailRes.json();
    if (getRepDetailRes.status !== 200) throw new Error(`Fetch report detail failed: ${JSON.stringify(getRepDetailJson)}`);
    console.log(`✓ Success: Retrieved report details. Page status: ${getRepDetailJson.status}`);

    // --- TEST 7: Trigger 'cleanup-logs' Job ---
    console.log('\nTEST 7: Triggering "cleanup-logs" job via Admin API...');
    const triggerCleanRes = await fetch(`${BASE_URL}/api/v1/admin/jobs/cleanup-logs/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    const triggerCleanJson = await triggerCleanRes.json();
    if (triggerCleanRes.status !== 200) throw new Error(`Cleanup Logs Job failed: ${JSON.stringify(triggerCleanJson)}`);
    console.log(`✓ Job status code 200 OK. Rotated logs count: ${triggerCleanJson.result.rotatedCount}`);

    console.log('\n=======================================');
    console.log('   ALL TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('=======================================\n');

    // Delete generated test entries
    await Click.deleteMany({ createdBy: userId });
    await Url.deleteMany({ createdBy: userId });
    await Report.deleteMany({ user: userId });
    await Notification.deleteMany({ user: userId });
    await User.deleteMany({ email: { $in: ['testuser_jobs@example.com', 'admin_jobs@example.com'] } });
    console.log('Test database entries cleaned up.');

  } catch (err) {
    console.error('\n❌ TEST RUN FAILED with error:');
    console.error(err);
    process.exitCode = 1;
  } finally {
    // Shutdown server and close connections
    if (server) {
      server.close();
      console.log('Test Server stopped.');
    }
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
      console.log('Redis client closed.');
    }
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
};

runTests();
