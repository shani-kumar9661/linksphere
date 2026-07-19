const Url = require('../models/Url');
const User = require('../models/User');
const Report = require('../models/Report');
const { sendEmail } = require('../utils/email');
const { redisClient } = require('../config/redis');
const logger = require('../config/logger');

const runSendReminderEmails = async () => {
  logger.info('Starting sendReminderEmailsJob...');
  try {
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // --- TASK 1: URL EXPIRATION REMINDERS (Expiring in the next 24 hours) ---
    const expiringUrls = await Url.find({
      expiresAt: { $gt: now, $lt: oneDayFromNow },
      expirationReminderSent: { $ne: true },
      isActive: true
    });

    let expirationRemindersCount = 0;
    logger.info(`Found ${expiringUrls.length} URLs expiring within 24 hours.`);

    for (const url of expiringUrls) {
      try {
        const owner = await User.findById(url.createdBy);
        if (owner) {
          const emailSubject = 'LinkSphere - URL Expiration Reminder';
          const emailText = `Hi ${owner.username},\n\nThis is a friendly reminder that your shortened URL with code "${url.shortCode}" pointing to "${url.originalUrl}" will expire in less than 24 hours on ${url.expiresAt}.\n\nIf you want to keep it active, please update its expiration date in your dashboard.\n\nBest regards,\nLinkSphere Team`;
          const emailHtml = `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2>Your LinkSphere URL is Expiring Soon</h2>
              <p>Hi ${owner.username},</p>
              <p>This is a quick reminder that your shortened URL is scheduled to expire in less than 24 hours:</p>
              <table style="border-collapse: collapse; width: 100%; margin: 15px 0;">
                <tr style="background-color: #f3f4f6;">
                  <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">Short Code</th>
                  <td style="border: 1px solid #e5e7eb; padding: 8px;"><strong>${url.shortCode}</strong></td>
                </tr>
                <tr>
                  <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">Original URL</th>
                  <td style="border: 1px solid #e5e7eb; padding: 8px;"><a href="${url.originalUrl}">${url.originalUrl}</a></td>
                </tr>
                <tr style="background-color: #f3f4f6;">
                  <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">Expiration Time</th>
                  <td style="border: 1px solid #e5e7eb; padding: 8px; color: #e11d48; font-weight: bold;">${url.expiresAt}</td>
                </tr>
              </table>
              <p>If you would like to extend the lifespan of this link, please log into your account and edit the URL details.</p>
              <p>Best regards,<br>LinkSphere Team</p>
            </div>
          `;

          await sendEmail({
            to: owner.email,
            subject: emailSubject,
            text: emailText,
            html: emailHtml
          });

          url.expirationReminderSent = true;
          await url.save();
          expirationRemindersCount++;
          logger.info(`Expiration reminder sent to ${owner.email} for URL code ${url.shortCode}`);
        }
      } catch (err) {
        logger.error(`Failed to send expiration reminder for URL code ${url.shortCode}: ${err.message}`);
      }
    }

    // --- TASK 2: WEEKLY REPORT NOTIFICATIONS (Reports created in the last 24 hours) ---
    const past24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentReports = await Report.find({
      createdAt: { $gte: past24Hours }
    }).populate('user');

    let reportEmailsCount = 0;
    logger.info(`Found ${recentReports.length} reports generated in the last 24 hours.`);

    for (const report of recentReports) {
      if (!report.user) continue;
      
      const redisKey = `report_email_sent:${report._id}`;
      try {
        // Check if report email was already sent
        const alreadySent = await redisClient.get(redisKey);
        if (alreadySent) {
          logger.info(`Report email already sent for report ID ${report._id}, skipping.`);
          continue;
        }

        const user = report.user;
        const emailSubject = 'LinkSphere - Your Weekly Analytics Report is Ready';
        
        let breakdownsHtml = '';
        if (report.breakdowns) {
          const makeList = (title, data) => {
            if (!data || Object.keys(data).length === 0) return `<p><em>No data</em></p>`;
            let items = '';
            Object.entries(data).forEach(([key, count]) => {
              items += `<li>${key}: ${count} clicks</li>`;
            });
            return `<h4>${title}</h4><ul>${items}</ul>`;
          };

          breakdownsHtml = `
            <h3>Weekly Breakdown Stats</h3>
            ${makeList('Top Browsers', report.breakdowns.browsers)}
            ${makeList('Top Devices', report.breakdowns.devices)}
            ${makeList('Top Countries', report.breakdowns.countries)}
          `;
        }

        const emailText = `Hi ${user.username},\n\nYour weekly analytics report is ready for the period ${report.startDate.toLocaleDateString()} to ${report.endDate.toLocaleDateString()}.\n\nClicks this week: ${report.clicksThisWeek}\nTotal clicks: ${report.totalClicks}\nMost popular URL: ${report.mostPopularUrl ? report.mostPopularUrl.shortCode : 'None'}\n\nBest regards,\nLinkSphere Team`;
        
        const emailHtml = `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2>Weekly Analytics Report</h2>
            <p>Hi ${user.username},</p>
            <p>Your weekly analytics summary is here! Here's how your links performed between <strong>${report.startDate.toLocaleDateString()}</strong> and <strong>${report.endDate.toLocaleDateString()}</strong>:</p>
            
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #e5e7eb;">
              <h3 style="margin-top: 0; color: #4f46e5;">Key Metrics</h3>
              <p>📈 <strong>Clicks This Week:</strong> ${report.clicksThisWeek}</p>
              <p>📊 <strong>Total Account Clicks:</strong> ${report.totalClicks}</p>
              ${report.mostPopularUrl ? `
                <p>🏆 <strong>Most Popular URL:</strong> ${report.mostPopularUrl.title} (<code>/${report.mostPopularUrl.shortCode}</code>) with ${report.mostPopularUrl.clicks} total clicks.</p>
              ` : ''}
            </div>

            ${breakdownsHtml}

            <p>Visit your dashboard to see complete insights and details.</p>
            <p>Best regards,<br>LinkSphere Team</p>
          </div>
        `;

        await sendEmail({
          to: user.email,
          subject: emailSubject,
          text: emailText,
          html: emailHtml
        });

        // Set Redis key with 3 days expiration to prevent duplicate sends
        await redisClient.setEx(redisKey, 259200, 'true');
        reportEmailsCount++;
        logger.info(`Weekly report email sent to ${user.email} for report ID ${report._id}`);
      } catch (err) {
        logger.error(`Failed to send weekly report email for report ID ${report._id}: ${err.message}`);
      }
    }

    logger.info(`sendReminderEmailsJob completed: ${expirationRemindersCount} expiration reminder(s) sent, ${reportEmailsCount} report email(s) sent.`);
    return { success: true, expirationRemindersCount, reportEmailsCount };
  } catch (error) {
    logger.error(`Error in sendReminderEmailsJob: ${error.message}`, { error });
    return { success: false, error: error.message };
  }
};

module.exports = { runSendReminderEmails };
