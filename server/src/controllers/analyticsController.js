const Click = require('../models/Click');
const Url = require('../models/Url');
const { redisClient } = require('../config/redis');
const logger = require('../config/logger');

/**
 * Retrieves dashboard stats and breakdown metrics for the logged-in user.
 * GET /api/v1/analytics/dashboard
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const cacheKey = `analytics:dashboard:${userId}`;

    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        return res.status(200).json(JSON.parse(cachedData));
      }
    } catch (cacheErr) {
      logger.error(`Error reading analytics cache: ${cacheErr.message}`);
    }

    // 1. Total Clicks for this user's links
    const totalClicks = await Click.countDocuments({ createdBy: userId });

    // 2. Today's Clicks (since start of local server day)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayClicks = await Click.countDocuments({
      createdBy: userId,
      timestamp: { $gte: startOfToday }
    });

    // 3. Weekly Clicks (last 7 days)
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);
    const weeklyClicks = await Click.countDocuments({
      createdBy: userId,
      timestamp: { $gte: startOfWeek }
    });

    // 4. Monthly Clicks (last 30 days)
    const startOfMonth = new Date();
    startOfMonth.setDate(startOfMonth.getDate() - 30);
    startOfMonth.setHours(0, 0, 0, 0);
    const monthlyClicks = await Click.countDocuments({
      createdBy: userId,
      timestamp: { $gte: startOfMonth }
    });

    // 5. Most Popular URL
    const mostPopularUrlDoc = await Url.findOne({ createdBy: userId })
      .sort({ clicks: -1, createdAt: -1 });
    
    let mostPopularUrl = null;
    if (mostPopularUrlDoc && mostPopularUrlDoc.clicks > 0) {
      mostPopularUrl = {
        id: mostPopularUrlDoc._id,
        title: mostPopularUrlDoc.title || mostPopularUrlDoc.shortCode,
        shortCode: mostPopularUrlDoc.shortCode,
        originalUrl: mostPopularUrlDoc.originalUrl,
        clicks: mostPopularUrlDoc.clicks
      };
    }

    // 6. Metadata breakdowns
    const browsers = await Click.aggregate([
      { $match: { createdBy: userId } },
      { $group: { _id: '$browser', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    const devices = await Click.aggregate([
      { $match: { createdBy: userId } },
      { $group: { _id: '$device', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    const operatingSystems = await Click.aggregate([
      { $match: { createdBy: userId } },
      { $group: { _id: '$operatingSystem', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    const countries = await Click.aggregate([
      { $match: { createdBy: userId } },
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    const referrers = await Click.aggregate([
      { $match: { createdBy: userId } },
      { $group: { _id: '$referrer', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // 7. Clicks by date (last 7 days) for chart representation
    const clicksByDateRaw = await Click.aggregate([
      { 
        $match: { 
          createdBy: userId,
          timestamp: { $gte: startOfWeek }
        } 
      },
      { 
        $group: { 
          _id: '$date', 
          count: { $sum: 1 } 
        } 
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill in days that have 0 clicks so frontend doesn't get missing days
    const clicksByDate = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const match = clicksByDateRaw.find(item => item._id === dateStr);
      clicksByDate.push({
        date: dateStr,
        formattedDate: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count: match ? match.count : 0
      });
    }

    const responseData = {
      status: 'success',
      data: {
        stats: {
          totalClicks,
          todayClicks,
          weeklyClicks,
          monthlyClicks,
          mostPopularUrl
        },
        breakdowns: {
          browsers,
          devices,
          operatingSystems,
          countries,
          referrers
        },
        chartData: clicksByDate
      }
    };

    try {
      await redisClient.setEx(cacheKey, 300, JSON.stringify(responseData));
    } catch (cacheErr) {
      logger.error(`Error writing analytics cache: ${cacheErr.message}`);
    }

    res.status(200).json(responseData);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats
};
