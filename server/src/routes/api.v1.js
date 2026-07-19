const express = require('express');
const router = express.Router();
const AppError = require('../utils/AppError');
const healthController = require('../controllers/healthController');
const authRouter = require('./auth');
const urlRouter = require('./url');
const analyticsRouter = require('./analytics');
const notificationRouter = require('./notification');
const adminRouter = require('./admin');
const reportRouter = require('./report');

// Health check endpoint
router.get('/health', healthController.getHealth);

// Test error handler route
router.get('/test-error', (req, res, next) => {
  next(new AppError('This is a test operational error!', 400));
});

// Mount routes
router.use('/auth', authRouter);
router.use('/urls', urlRouter);
router.use('/analytics', analyticsRouter);
router.use('/notifications', notificationRouter);
router.use('/admin', adminRouter);
router.use('/reports', reportRouter);

module.exports = router;
