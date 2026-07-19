const Url = require('../models/Url');
const AppError = require('../utils/AppError');
const generateShortCode = require('../utils/shortCodeGenerator');
const logger = require('../config/logger');
const { validateAlias } = require('../utils/aliasValidator');
const { createNotification } = require('../utils/notificationHelper');
const { redisClient } = require('../config/redis');

// Create a short URL
const createUrl = async (req, res, next) => {
  try {
    const { originalUrl, title, customAlias, expiresAt, category, tags, note, isFavorite, isArchived, isPinned, password } = req.body;


    if (!originalUrl) {
      return next(new AppError('Original URL is required', 400));
    }

    let shortCode;

    // Handle Custom Alias if provided
    if (customAlias) {
      const validation = validateAlias(customAlias);
      if (!validation.isValid) {
        return next(new AppError(validation.error, 400));
      }
      
      const aliasNormalized = validation.normalized;

      // Check if customAlias is already taken (either case-sensitively or case-insensitively)
      const existingAlias = await Url.findOne({
        $or: [
          { customAlias: aliasNormalized },
          { shortCode: { $regex: new RegExp(`^${aliasNormalized}$`, 'i') } }
        ]
      });

      if (existingAlias) {
        return next(new AppError('This custom alias is already taken', 400));
      }

      shortCode = aliasNormalized;
    } else {
      // Generate unique short code with collision check (retry up to 5 times)
      let codeExists = true;
      let attempts = 0;
      
      while (codeExists && attempts < 5) {
        const potentialCode = generateShortCode(6);
        const existing = await Url.findOne({
          $or: [
            { shortCode: potentialCode },
            { customAlias: potentialCode.toLowerCase() }
          ]
        });
        
        if (!existing) {
          shortCode = potentialCode;
          codeExists = false;
        }
        attempts++;
      }

      if (codeExists) {
        return next(new AppError('Server was unable to generate a unique short code, please try again.', 500));
      }
    }

    // Handle expiration date validation if provided
    let expiryDate;
    if (expiresAt) {
      expiryDate = new Date(expiresAt);
      if (isNaN(expiryDate.getTime())) {
        return next(new AppError('Invalid expiration date format', 400));
      }
      if (expiryDate <= new Date()) {
        return next(new AppError('Expiration date must be in the future', 400));
      }
    }

    // Build URL object
    const urlData = {
      originalUrl,
      shortCode,
      createdBy: req.user._id,
      isActive: true
    };

    if (title) urlData.title = title;
    if (customAlias) {
      urlData.customAlias = shortCode; // shortCode contains aliasNormalized
    }
    if (expiryDate) urlData.expiresAt = expiryDate;
    if (category !== undefined) urlData.category = category;
    if (tags !== undefined) urlData.tags = tags;
    if (note !== undefined) urlData.note = note;
    if (isFavorite !== undefined) urlData.isFavorite = isFavorite;
    if (isArchived !== undefined) urlData.isArchived = isArchived;
    if (isPinned !== undefined) urlData.isPinned = isPinned;
    if (password) urlData.password = password;

    const url = new Url(urlData);
    await url.save();

    // Invalidate analytics dashboard cache
    try {
      await redisClient.del(`analytics:dashboard:${req.user._id}`);
    } catch (cacheErr) {
      logger.error(`Error invalidating analytics cache in createUrl: ${cacheErr.message}`);
    }

    // Trigger Notification
    await createNotification({
      userId: req.user._id,
      title: 'Link Created',
      message: `Your short link for ${url.originalUrl} was created successfully with code ${url.shortCode}.`,
      type: 'link_created'
    });

    res.status(201).json({
      status: 'success',
      data: {
        url: {
          id: url._id,
          originalUrl: url.originalUrl,
          shortCode: url.shortCode,
          title: url.title,
          customAlias: url.customAlias || null,
          clicks: url.clicks,
          isActive: url.isActive,
          expiresAt: url.expiresAt || null,
          createdAt: url.createdAt,
          category: url.category || null,
          tags: url.tags || [],
          note: url.note || '',
          isFavorite: url.isFavorite || false,
          isArchived: url.isArchived || false,
          isPinned: url.isPinned || false,
          isPasswordProtected: url.isPasswordProtected || false
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Retrieve all URLs for the logged-in user
const getAllUrls = async (req, res, next) => {
  try {
    // Automatically deactivate expired URLs for this user and invalidate caches
    const expiredUrls = await Url.find({ createdBy: req.user._id, expiresAt: { $lt: new Date() }, isActive: true });
    if (expiredUrls.length > 0) {
      for (const url of expiredUrls) {
        url.isActive = false;
        await url.save();
        try {
          await redisClient.del(`url:code:${url.shortCode}`);
          if (url.customAlias) {
            await redisClient.del(`url:alias:${url.customAlias.toLowerCase()}`);
          }
        } catch (cacheErr) {
          logger.error(`Error invalidating expired cache: ${cacheErr.message}`);
        }
      }
      try {
        await redisClient.del(`analytics:dashboard:${req.user._id}`);
      } catch (cacheErr) {}
    }

    const urls = await Url.find({ createdBy: req.user._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: urls.length,
      data: {
        urls
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get single URL details
const getUrl = async (req, res, next) => {
  try {
    const url = await Url.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!url) {
      return next(new AppError('URL not found or unauthorized', 404));
    }

    // Check if expired and deactivate if so
    if (url.expiresAt && new Date(url.expiresAt) < new Date() && url.isActive) {
      url.isActive = false;
      await url.save();
      try {
        await redisClient.del(`url:code:${url.shortCode}`);
        if (url.customAlias) {
          await redisClient.del(`url:alias:${url.customAlias.toLowerCase()}`);
        }
        await redisClient.del(`analytics:dashboard:${req.user._id}`);
      } catch (cacheErr) {
        logger.error(`Error invalidating expired cache in getUrl: ${cacheErr.message}`);
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        url
      }
    });
  } catch (error) {
    next(error);
  }
};

// Delete a URL
const deleteUrl = async (req, res, next) => {
  try {
    const url = await Url.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!url) {
      return next(new AppError('URL not found or unauthorized', 404));
    }

    // Invalidate caches
    try {
      await redisClient.del(`url:code:${url.shortCode}`);
      if (url.customAlias) {
        await redisClient.del(`url:alias:${url.customAlias.toLowerCase()}`);
      }
      await redisClient.del(`analytics:dashboard:${req.user._id}`);
    } catch (cacheErr) {
      logger.error(`Error invalidating cache in deleteUrl: ${cacheErr.message}`);
    }

    // Trigger Notification
    await createNotification({
      userId: req.user._id,
      title: 'Link Deleted',
      message: `The short link for ${url.originalUrl} (${url.shortCode}) was deleted successfully.`,
      type: 'link_deleted'
    });

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

// Handle redirects: GET /:shortCode
const redirectUrl = async (req, res, next) => {
  try {
    const { shortCode } = req.params;

    // Check if it matches valid short code / alias pattern (alphanumeric and dashes, 3-30 chars)
    const shortCodeRegex = /^[a-zA-Z0-9-_]{3,30}$/;
    if (!shortCodeRegex.test(shortCode)) {
      return next(); // Fall through to next handler (e.g. static files or 404)
    }

    let url;

    // Try reading cache
    try {
      let cachedUrlStr = await redisClient.get(`url:code:${shortCode}`);
      if (!cachedUrlStr) {
        cachedUrlStr = await redisClient.get(`url:alias:${shortCode.toLowerCase()}`);
      }
      if (cachedUrlStr) {
        url = JSON.parse(cachedUrlStr);
      }
    } catch (cacheErr) {
      logger.error(`Error reading redirect cache: ${cacheErr.message}`);
    }

    // If cache miss, query MongoDB
    if (!url) {
      url = await Url.findOne({
        $or: [
          { shortCode },
          { customAlias: shortCode.toLowerCase() }
        ]
      });

      if (!url) {
        return next(new AppError('Short URL not found', 404));
      }

      // Populate cache
      try {
        await redisClient.setEx(`url:code:${url.shortCode}`, 86400, JSON.stringify(url));
        if (url.customAlias) {
          await redisClient.setEx(`url:alias:${url.customAlias.toLowerCase()}`, 86400, JSON.stringify(url));
        }
      } catch (cacheErr) {
        logger.error(`Error writing redirect cache: ${cacheErr.message}`);
      }
    }

    // Check if active
    if (!url.isActive) {
      return next(new AppError('This URL is inactive', 400));
    }

    // Check if expired
    if (url.expiresAt && new Date(url.expiresAt) < new Date()) {
      await Url.findByIdAndUpdate(url._id || url.id, { isActive: false });
      try {
        await redisClient.del(`url:code:${url.shortCode}`);
        if (url.customAlias) {
          await redisClient.del(`url:alias:${url.customAlias.toLowerCase()}`);
        }
        await redisClient.del(`analytics:dashboard:${url.createdBy}`);
      } catch (cacheErr) {}
      return next(new AppError('This URL has expired', 410)); // 410 Gone
    }

    // Redirect to password prompt page in frontend if URL is password-protected
    if (url.isPasswordProtected) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.status(302).redirect(`${frontendUrl}/p/${url.shortCode}`);
    }

    // Increment click count atomically
    await Url.findByIdAndUpdate(url._id || url.id, { $inc: { clicks: 1 } });

    // Track click details asynchronously (does not block user redirect)
    try {
      const userAgent = req.headers['user-agent'] || '';
      const refererHeader = req.headers['referer'] || req.headers['referrer'];
      let referrer = 'Direct';
      if (refererHeader) {
        try {
          const urlObj = new URL(refererHeader);
          referrer = urlObj.hostname || refererHeader;
        } catch (err) {
          referrer = refererHeader;
        }
      }

      let ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
      if (ipAddress && ipAddress.includes(',')) {
        ipAddress = ipAddress.split(',')[0].trim();
      }

      const { parseUserAgent } = require('../utils/uaParser');
      const { browser, device, operatingSystem } = parseUserAgent(userAgent);

      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const time = now.toISOString().split('T')[1].substring(0, 8);

      const clickData = {
        url: url._id || url.id,
        createdBy: url.createdBy,
        timestamp: now,
        date,
        time,
        browser,
        device,
        operatingSystem,
        referrer,
        clickCount: 1
      };

      const { resolveGeoAndSaveClick } = require('../utils/geoResolver');
      resolveGeoAndSaveClick(clickData, ipAddress);
    } catch (trackError) {
      logger.error(`Error initiating click tracking: ${trackError.message}`);
    }

    // Redirect to original URL
    res.status(302).redirect(url.originalUrl);
  } catch (error) {
    next(error);
  }
};

// Update a URL
const updateUrl = async (req, res, next) => {
  try {
    const { originalUrl, title, customAlias, expiresAt, isActive, category, tags, note, isFavorite, isArchived, isPinned, password } = req.body;
    const url = await Url.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!url) {
      return next(new AppError('URL not found or unauthorized', 404));
    }

    const oldShortCode = url.shortCode;
    const oldCustomAlias = url.customAlias;

    if (originalUrl) {
      url.originalUrl = originalUrl;
    }
    if (title !== undefined) {
      url.title = title;
    }
    if (isActive !== undefined) {
      url.isActive = isActive;
    }
    if (category !== undefined) {
      url.category = category;
    }
    if (tags !== undefined) {
      url.tags = tags;
    }
    if (note !== undefined) {
      url.note = note;
    }
    if (isFavorite !== undefined) {
      url.isFavorite = isFavorite;
    }
    if (isArchived !== undefined) {
      url.isArchived = isArchived;
    }
    if (isPinned !== undefined) {
      url.isPinned = isPinned;
    }
    if (password !== undefined) {
      url.password = password;
    }

    // Custom Alias modification validation
    if (customAlias !== undefined) {
      const aliasTrimmed = customAlias ? customAlias.trim() : '';
      if (aliasTrimmed) {
        const validation = validateAlias(aliasTrimmed);
        if (!validation.isValid) {
          return next(new AppError(validation.error, 400));
        }

        const aliasNormalized = validation.normalized;

        if (aliasNormalized !== url.customAlias) {
          // Check if customAlias is already taken (excluding this URL itself)
          const existingAlias = await Url.findOne({
            _id: { $ne: url._id },
            $or: [
              { customAlias: aliasNormalized },
              { shortCode: { $regex: new RegExp(`^${aliasNormalized}$`, 'i') } }
            ]
          });

          if (existingAlias) {
            return next(new AppError('This custom alias is already taken', 400));
          }

          url.customAlias = aliasNormalized;
          url.shortCode = aliasNormalized;
        }
      } else if (url.customAlias) {
        // If they cleared the customAlias, we need to generate a new short code
        let shortCode;
        let codeExists = true;
        let attempts = 0;
        
        while (codeExists && attempts < 5) {
          const potentialCode = generateShortCode(6);
          const existing = await Url.findOne({
            $or: [
              { shortCode: potentialCode },
              { customAlias: potentialCode.toLowerCase() }
          ]
        });
          
          if (!existing) {
            shortCode = potentialCode;
            codeExists = false;
          }
          attempts++;
        }

        if (codeExists) {
          return next(new AppError('Server was unable to generate a unique short code, please try again.', 500));
        }

        url.customAlias = undefined;
        url.shortCode = shortCode;
      }
    }

    if (expiresAt !== undefined) {
      if (expiresAt === null || expiresAt === '') {
        url.expiresAt = undefined;
      } else {
        const expiryDate = new Date(expiresAt);
        if (isNaN(expiryDate.getTime())) {
          return next(new AppError('Invalid expiration date format', 400));
        }
        if (expiryDate <= new Date()) {
          return next(new AppError('Expiration date must be in the future', 400));
        }
        url.expiresAt = expiryDate;
      }
    }

    await url.save();

    // Invalidate caches
    try {
      await redisClient.del(`url:code:${oldShortCode}`);
      if (oldCustomAlias) {
        await redisClient.del(`url:alias:${oldCustomAlias.toLowerCase()}`);
      }
      await redisClient.del(`url:code:${url.shortCode}`);
      if (url.customAlias) {
        await redisClient.del(`url:alias:${url.customAlias.toLowerCase()}`);
      }
      await redisClient.del(`analytics:dashboard:${req.user._id}`);
    } catch (cacheErr) {
      logger.error(`Error invalidating cache in updateUrl: ${cacheErr.message}`);
    }

    res.status(200).json({
      status: 'success',
      data: {
        url: {
          id: url._id,
          originalUrl: url.originalUrl,
          shortCode: url.shortCode,
          title: url.title,
          customAlias: url.customAlias || null,
          clicks: url.clicks,
          isActive: url.isActive,
          expiresAt: url.expiresAt || null,
          createdAt: url.createdAt,
          category: url.category || null,
          tags: url.tags || [],
          note: url.note || '',
          isFavorite: url.isFavorite || false,
          isArchived: url.isArchived || false,
          isPinned: url.isPinned || false,
          isPasswordProtected: url.isPasswordProtected || false
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Verify password for a protected URL: POST /api/v1/urls/verify-password/:shortCode
const verifyUrlPassword = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const { password } = req.body;

    if (!password) {
      return next(new AppError('Password is required', 400));
    }

    // Search by shortCode or customAlias, explicitly selecting password
    const url = await Url.findOne({
      $or: [
        { shortCode },
        { customAlias: shortCode.toLowerCase() }
      ]
    }).select('+password');

    if (!url) {
      return next(new AppError('Short URL not found', 404));
    }

    // Check if active
    if (!url.isActive) {
      return next(new AppError('This URL is inactive', 400));
    }

    // Check if expired
    if (url.expiresAt && new Date(url.expiresAt) < new Date()) {
      url.isActive = false;
      await url.save();
      return next(new AppError('This URL has expired', 410));
    }

    // Check if URL is password protected
    if (!url.isPasswordProtected) {
      return next(new AppError('This URL is not password protected', 400));
    }

    // Compare passwords
    const isMatch = await url.comparePassword(password);
    if (!isMatch) {
      return next(new AppError('Incorrect password', 401));
    }

    // Increment click count atomically
    await Url.findByIdAndUpdate(url._id, { $inc: { clicks: 1 } });

    // Track click details asynchronously
    try {
      const userAgent = req.headers['user-agent'] || '';
      const refererHeader = req.headers['referer'] || req.headers['referrer'];
      let referrer = 'Direct';
      if (refererHeader) {
        try {
          const urlObj = new URL(refererHeader);
          referrer = urlObj.hostname || refererHeader;
        } catch (err) {
          referrer = refererHeader;
        }
      }

      let ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
      if (ipAddress && ipAddress.includes(',')) {
        ipAddress = ipAddress.split(',')[0].trim();
      }

      const { parseUserAgent } = require('../utils/uaParser');
      const { browser, device, operatingSystem } = parseUserAgent(userAgent);

      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const time = now.toISOString().split('T')[1].substring(0, 8);

      const clickData = {
        url: url._id,
        createdBy: url.createdBy,
        timestamp: now,
        date,
        time,
        browser,
        device,
        operatingSystem,
        referrer,
        clickCount: 1
      };

      const { resolveGeoAndSaveClick } = require('../utils/geoResolver');
      resolveGeoAndSaveClick(clickData, ipAddress);
    } catch (trackError) {
      logger.error(`Error initiating click tracking on password verify: ${trackError.message}`);
    }

    // Return the original URL for frontend redirection
    res.status(200).json({
      status: 'success',
      data: {
        originalUrl: url.originalUrl
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createUrl,
  getAllUrls,
  getUrl,
  deleteUrl,
  redirectUrl,
  updateUrl,
  verifyUrlPassword
};
