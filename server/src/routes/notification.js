const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validator');

// All notification routes require authentication
router.use(protect);

router.route('/')
  .get(notificationController.getUserNotifications);

router.route('/:id/read')
  .patch(validateIdParam, notificationController.markAsRead);

router.route('/:id')
  .delete(validateIdParam, notificationController.deleteNotification);

module.exports = router;
