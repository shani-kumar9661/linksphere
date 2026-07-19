const path = require('path');
const User = require('../models/User');
const Url = require('../models/Url');
const Click = require('../models/Click');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const { redisClient } = require('../config/redis');
const logger = require('../config/logger');
const { readLastLogLines } = require('../utils/logReader');

// Get platform-wide statistics
exports.getPlatformStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalUrls = await Url.countDocuments();
    const totalClicks = await Click.countDocuments();
    const activeUsers = await User.countDocuments({ isDisabled: { $ne: true } });

    res.status(200).json({
      status: 'success',
      data: {
        stats: {
          totalUsers,
          totalUrls,
          totalClicks,
          activeUsers
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get all users
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      data: {
        users
      }
    });
  } catch (error) {
    next(error);
  }
};

// Toggle disable status of a user
exports.toggleUserDisable = async (req, res, next) => {
  try {
    const userId = req.params.id;

    // Safety: Prevent self-disabling
    if (req.user._id.toString() === userId) {
      return next(new AppError('You cannot disable your own administrator account.', 400));
    }

    const user = await User.findById(userId);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    user.isDisabled = !user.isDisabled;
    await user.save({ validateBeforeSave: false });

    // Invalidate refresh token if disabled to force immediate logout
    if (user.isDisabled) {
      user.refreshToken = undefined;
      await user.save({ validateBeforeSave: false });
    }

    // Invalidate session cache
    try {
      await redisClient.del(`session:user:${userId}`);
    } catch (cacheErr) {
      logger.error(`Error invalidating session cache in toggleUserDisable: ${cacheErr.message}`);
    }

    res.status(200).json({
      status: 'success',
      message: `User account has been ${user.isDisabled ? 'disabled' : 'enabled'} successfully.`,
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
};

// Delete user and cascade delete their URLs/clicks/notifications
exports.deleteUser = async (req, res, next) => {
  try {
    const userId = req.params.id;

    // Safety: Prevent self-deletion
    if (req.user._id.toString() === userId) {
      return next(new AppError('You cannot delete your own administrator account.', 400));
    }

    const user = await User.findById(userId);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Fetch user's URLs before deletion to invalidate caches in Redis
    try {
      const userUrls = await Url.find({ createdBy: userId });
      for (const url of userUrls) {
        await redisClient.del(`url:code:${url.shortCode}`);
        if (url.customAlias) {
          await redisClient.del(`url:alias:${url.customAlias.toLowerCase()}`);
        }
      }
      await redisClient.del(`session:user:${userId}`);
      await redisClient.del(`analytics:dashboard:${userId}`);
    } catch (cacheErr) {
      logger.error(`Error invalidating user cache in deleteUser: ${cacheErr.message}`);
    }

    // 1. Delete all clicks associated with the user's URLs or createdBy
    await Click.deleteMany({ createdBy: userId });

    // 2. Delete all URLs created by the user
    await Url.deleteMany({ createdBy: userId });

    // 3. Delete all notifications for the user
    await Notification.deleteMany({ userId });

    // 4. Delete the user
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      status: 'success',
      message: 'User and all associated URLs, clicks, and notifications have been deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// Get all URLs
exports.getAllUrls = async (req, res, next) => {
  try {
    const urls = await Url.find()
      .populate('createdBy', 'username email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      data: {
        urls
      }
    });
  } catch (error) {
    next(error);
  }
};

// Delete a URL and its clicks
exports.deleteUrl = async (req, res, next) => {
  try {
    const urlId = req.params.id;

    const url = await Url.findById(urlId);
    if (!url) {
      return next(new AppError('URL not found', 404));
    }

    // Invalidate caches in Redis
    try {
      await redisClient.del(`url:code:${url.shortCode}`);
      if (url.customAlias) {
        await redisClient.del(`url:alias:${url.customAlias.toLowerCase()}`);
      }
      await redisClient.del(`analytics:dashboard:${url.createdBy}`);
    } catch (cacheErr) {
      logger.error(`Error invalidating cache in deleteUrl by admin: ${cacheErr.message}`);
    }

    // Delete associated clicks
    await Click.deleteMany({ url: urlId });

    // Delete the URL
    await Url.findByIdAndDelete(urlId);

    res.status(200).json({
      status: 'success',
      message: 'Shortened URL and its click logs have been deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// Manually trigger a background job
exports.triggerJob = async (req, res, next) => {
  try {
    const { jobName } = req.params;
    const { jobRunners } = require('../jobs');

    const runner = jobRunners[jobName];

    if (!runner) {
      return next(new AppError(`Invalid job name: "${jobName}". Valid jobs are: ${Object.keys(jobRunners).join(', ')}`, 400));
    }

    logger.info(`Admin initiated manual trigger of background job: ${jobName}`);
    
    // Execute job synchronously for the API response
    const result = await runner();

    if (result && result.success === false) {
      return next(new AppError(`Job execution failed: ${result.error}`, 500));
    }

    res.status(200).json({
      status: 'success',
      message: `Background job "${jobName}" executed successfully.`,
      result
    });
  } catch (error) {
    next(error);
  }
};

// Get recent request logs (combined.log)
exports.getRequestLogs = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const logPath = path.join(__dirname, '../../logs/combined.log');
    const logs = await readLastLogLines(logPath, limit);

    res.status(200).json({
      status: 'success',
      data: {
        logs
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get recent error logs (error.log)
exports.getErrorLogs = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const logPath = path.join(__dirname, '../../logs/error.log');
    const logs = await readLastLogLines(logPath, limit);

    res.status(200).json({
      status: 'success',
      data: {
        logs
      }
    });
  } catch (error) {
    next(error);
  }
};
