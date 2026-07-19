const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { redisClient } = require('../config/redis');
const logger = require('../config/logger');

const protect = async (req, res, next) => {
  try {
    let token;
    
    // 1. Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    // 2. Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('Your token has expired! Please log in again or refresh.', 401));
      }
      return next(new AppError('Invalid token! Please log in again.', 401));
    }

    // 3. Check if user still exists (try Redis cache first)
    const cacheKey = `session:user:${decoded.id}`;
    let currentUser;
    
    try {
      const cachedUser = await redisClient.get(cacheKey);
      if (cachedUser) {
        currentUser = User.hydrate(JSON.parse(cachedUser));
      }
    } catch (cacheErr) {
      logger.error(`Session cache read error: ${cacheErr.message}`);
    }

    if (!currentUser) {
      currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next(new AppError('The user belonging to this token no longer exists.', 401));
      }
      
      try {
        // Cache session for 1 hour (3600 seconds)
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(currentUser));
      } catch (cacheErr) {
        logger.error(`Session cache write error: ${cacheErr.message}`);
      }
    }

    if (currentUser.isDisabled) {
      return next(new AppError('Your account has been disabled. Please contact support.', 403));
    }

    // 4. Grant access to protected route
    req.user = currentUser;
    next();
  } catch (error) {
    next(error);
  }
};

const requireVerified = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('You are not logged in!', 401));
  }
  
  if (!req.user.isVerified) {
    return next(new AppError('Please verify your email address to access this resource.', 403));
  }

  next();
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('You are not logged in!', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};

module.exports = {
  protect,
  requireVerified,
  restrictTo
};
