const User = require('../models/User');
const Url = require('../models/Url');
const Click = require('../models/Click');
const Report = require('../models/Report');
const logger = require('../config/logger');

const runGenerateReports = async () => {
  logger.info('Starting generateReportsJob...');
  try {
    const users = await User.find({ isDisabled: false });
    
    if (users.length === 0) {
      logger.info('No active users found to generate reports for.');
      return { success: true, reportsCount: 0 };
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);

    let reportsCount = 0;

    for (const user of users) {
      const userId = user._id;

      // 1. Total clicks for this user
      const totalClicks = await Click.countDocuments({ createdBy: userId });

      // 2. Clicks in the last 7 days
      const clicksThisWeek = await Click.countDocuments({
        createdBy: userId,
        timestamp: { $gte: startDate, $lte: endDate }
      });

      // 3. Most Popular URL
      const mostPopularUrlDoc = await Url.findOne({ createdBy: userId }).sort({ clicks: -1, createdAt: -1 });
      let mostPopularUrl = null;
      if (mostPopularUrlDoc) {
        mostPopularUrl = {
          id: mostPopularUrlDoc._id,
          title: mostPopularUrlDoc.title || mostPopularUrlDoc.shortCode,
          shortCode: mostPopularUrlDoc.shortCode,
          originalUrl: mostPopularUrlDoc.originalUrl,
          clicks: mostPopularUrlDoc.clicks
        };
      }

      // Helper function to run breakdowns aggregation for last 7 days
      const getBreakdown = async (field) => {
        const results = await Click.aggregate([
          { 
            $match: { 
              createdBy: userId, 
              timestamp: { $gte: startDate, $lte: endDate } 
            } 
          },
          { 
            $group: { 
              _id: `$${field}`, 
              count: { $sum: 1 } 
            } 
          },
          { $sort: { count: -1 } },
          { $limit: 5 }
        ]);
        
        // Convert to key-value object
        const breakdownObj = {};
        results.forEach(item => {
          const key = item._id || 'Unknown';
          breakdownObj[key] = item.count;
        });
        return breakdownObj;
      };

      // 4. Gather breakdowns
      const browsers = await getBreakdown('browser');
      const devices = await getBreakdown('device');
      const operatingSystems = await getBreakdown('operatingSystem');
      const countries = await getBreakdown('country');
      const referrers = await getBreakdown('referrer');

      // 5. Create Report in DB
      const report = await Report.create({
        user: userId,
        startDate,
        endDate,
        totalClicks,
        clicksThisWeek,
        mostPopularUrl,
        breakdowns: {
          browsers,
          devices,
          operatingSystems,
          countries,
          referrers
        }
      });

      reportsCount++;
      logger.info(`Generated report ID ${report._id} for user ${user.username} (Clicks this week: ${clicksThisWeek})`);
    }

    logger.info(`generateReportsJob completed: ${reportsCount} report(s) generated.`);
    return { success: true, reportsCount };
  } catch (error) {
    logger.error(`Error in generateReportsJob: ${error.message}`, { error });
    return { success: false, error: error.message };
  }
};

module.exports = { runGenerateReports };
