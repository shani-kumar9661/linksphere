const Notification = require('../models/Notification');
const logger = require('../config/logger');

/**
 * Creates a user notification and logs the event
 * @param {Object} params
 * @param {string} params.userId - Target user's ID
 * @param {string} params.title - Title of the notification
 * @param {string} params.message - Content detail
 * @param {string} params.type - Enum type of the notification
 */
const createNotification = async ({ userId, title, message, type }) => {
  try {
    const notification = await Notification.create({
      user: userId,
      title,
      message,
      type
    });
    logger.info(`Notification created: ${type} for user ${userId}`);
    return notification;
  } catch (error) {
    logger.error(`Failed to create notification of type ${type}: ${error.message}`);
  }
};

module.exports = { createNotification };
