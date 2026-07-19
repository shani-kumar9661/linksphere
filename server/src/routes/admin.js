const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validator');

// Protect all routes under this router, and restrict to admin role
router.use(protect);
router.use(restrictTo('admin'));

// Platform statistics route
router.get('/stats', adminController.getPlatformStats);

// User management routes
router.get('/users', adminController.getAllUsers);
router.patch('/users/:id/toggle-disable', validateIdParam, adminController.toggleUserDisable);
router.delete('/users/:id', validateIdParam, adminController.deleteUser);

// URL management routes
router.get('/urls', adminController.getAllUrls);
router.delete('/urls/:id', validateIdParam, adminController.deleteUrl);

// Background jobs trigger route
router.post('/jobs/:jobName/trigger', adminController.triggerJob);

// Logs management routes
router.get('/logs/requests', adminController.getRequestLogs);
router.get('/logs/errors', adminController.getErrorLogs);

module.exports = router;
