const cron = require('node-cron');
const logger = require('../config/logger');

// Import jobs
const { runDeleteExpiredUrls } = require('./deleteExpiredUrlsJob');
const { runGenerateReports } = require('./generateReportsJob');
const { runSendReminderEmails } = require('./sendReminderEmailsJob');
const { runCleanupLogs } = require('./cleanupLogsJob');

// Dictionary of manual runners for triggering
const jobRunners = {
  'delete-expired-urls': runDeleteExpiredUrls,
  'generate-reports': runGenerateReports,
  'send-reminders': runSendReminderEmails,
  'cleanup-logs': runCleanupLogs
};

// Scheduler setup
const initJobs = () => {
  logger.info('Initializing background jobs scheduler...');

  // 1. Delete Expired URLs - Daily at midnight (00:00)
  cron.schedule('0 0 * * *', async () => {
    logger.info('Running scheduled job: Delete Expired URLs');
    await runDeleteExpiredUrls();
  });

  // 2. Generate Reports - Weekly on Sundays at midnight (00:00)
  cron.schedule('0 0 * * 0', async () => {
    logger.info('Running scheduled job: Generate Reports');
    await runGenerateReports();
  });

  // 3. Send Reminder Emails - Daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    logger.info('Running scheduled job: Send Reminder Emails');
    await runSendReminderEmails();
  });

  // 4. Clean up Logs - Weekly on Sundays at 1:00 AM
  cron.schedule('0 1 * * 0', async () => {
    logger.info('Running scheduled job: Clean up Logs');
    await runCleanupLogs();
  });

  logger.info('All background jobs scheduled successfully.');
};

module.exports = {
  initJobs,
  jobRunners
};
