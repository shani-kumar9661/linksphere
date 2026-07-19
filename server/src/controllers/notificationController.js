const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');

// Get all notifications for the current user
const getUserNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: notifications.length,
      data: {
        notifications
      }
    });
  } catch (error) {
    next(error);
  }
};

// Mark notification(s) as read
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (id === 'all') {
      await Notification.updateMany(
        { user: req.user._id, isRead: false },
        { $set: { isRead: true } }
      );

      return res.status(200).json({
        status: 'success',
        message: 'All notifications marked as read'
      });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notification) {
      return next(new AppError('Notification not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        notification
      }
    });
  } catch (error) {
    next(error);
  }
};

// Delete notification(s)
const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (id === 'all') {
      await Notification.deleteMany({ user: req.user._id });

      return res.status(200).json({
        status: 'success',
        message: 'All notifications deleted'
      });
    }

    const notification = await Notification.findOneAndDelete({
      _id: id,
      user: req.user._id
    });

    if (!notification) {
      return next(new AppError('Notification not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserNotifications,
  markAsRead,
  deleteNotification
};
