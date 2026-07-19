const Url = require('../models/Url');
const Click = require('../models/Click');
const { createNotification } = require('../utils/notificationHelper');
const { redisClient } = require('../config/redis');
const { sendEmail } = require('../utils/email');
const logger = require('../config/logger');

const runDeleteExpiredUrls = async () => {
  logger.info('Starting deleteExpiredUrlsJob...');
  try {
    const now = new Date();
    // Find all active or inactive URLs that have expired
    const expiredUrls = await Url.find({ expiresAt: { $lt: now } });

    if (expiredUrls.length === 0) {
      logger.info('No expired URLs found to delete.');
      return { success: true, deletedCount: 0 };
    }

    let deletedCount = 0;
    for (const url of expiredUrls) {
      // 1. Delete associated Click documents
      const clickDeleteResult = await Click.deleteMany({ url: url._id });
      logger.info(`Deleted ${clickDeleteResult.deletedCount} clicks for expired URL ${url.shortCode}`);

      // 2. Delete the URL document
      await Url.deleteOne({ _id: url._id });
      deletedCount++;

      // 3. Invalidate Redis Caches
      try {
        await redisClient.del(`url:code:${url.shortCode}`);
        if (url.customAlias) {
          await redisClient.del(`url:alias:${url.customAlias.toLowerCase()}`);
        }
        await redisClient.del(`analytics:dashboard:${url.createdBy}`);
      } catch (cacheErr) {
        logger.error(`Error invalidating cache for deleted expired URL ${url.shortCode}: ${cacheErr.message}`);
      }

      // 4. Create local Notification
      await createNotification({
        userId: url.createdBy,
        title: 'URL Expired and Cleaned Up',
        message: `Your shortened link with code ${url.shortCode} (pointing to ${url.originalUrl}) has expired and was automatically deleted.`,
        type: 'link_expired'
      });

      // 5. Send Email Notification
      // Retrieve owner email (populate is safer, or query user, let's fetch owner user to get email)
      try {
        const User = require('../models/User');
        const owner = await User.findById(url.createdBy);
        if (owner) {
          const emailSubject = 'LinkSphere - Your Short URL Has Expired';
          const emailText = `Hi ${owner.username},\n\nYour shortened URL with code ${url.shortCode} pointing to ${url.originalUrl} has reached its expiration date (${url.expiresAt}) and has been automatically deleted to clean up storage.\n\nBest regards,\nLinkSphere Team`;
          const emailHtml = `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2>Your LinkSphere URL Has Expired</h2>
              <p>Hi ${owner.username},</p>
              <p>This is to inform you that your shortened URL has reached its expiration date and has been automatically deleted:</p>
              <table style="border-collapse: collapse; width: 100%; margin: 15px 0;">
                <tr style="background-color: #f3f4f6;">
                  <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">Short Code</th>
                  <td style="border: 1px solid #e5e7eb; padding: 8px;">${url.shortCode}</td>
                </tr>
                <tr>
                  <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">Original URL</th>
                  <td style="border: 1px solid #e5e7eb; padding: 8px;"><a href="${url.originalUrl}">${url.originalUrl}</a></td>
                </tr>
                <tr style="background-color: #f3f4f6;">
                  <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">Expired At</th>
                  <td style="border: 1px solid #e5e7eb; padding: 8px;">${url.expiresAt}</td>
                </tr>
              </table>
              <p>If you need to use this link again, you can create a new shortened link in your dashboard.</p>
              <p>Best regards,<br>LinkSphere Team</p>
            </div>
          `;

          await sendEmail({
            to: owner.email,
            subject: emailSubject,
            text: emailText,
            html: emailHtml
          });
        }
      } catch (emailErr) {
        logger.error(`Error sending expiration email for shortCode ${url.shortCode}: ${emailErr.message}`);
      }
    }

    logger.info(`deleteExpiredUrlsJob completed: ${deletedCount} expired URL(s) deleted.`);
    return { success: true, deletedCount };
  } catch (error) {
    logger.error(`Error in deleteExpiredUrlsJob: ${error.message}`, { error });
    return { success: false, error: error.message };
  }
};

module.exports = { runDeleteExpiredUrls };
