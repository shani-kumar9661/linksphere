const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Url = require('../models/Url');
const Click = require('../models/Click');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const emailUtil = require('../utils/email');
const logger = require('../config/logger');
const { createNotification } = require('../utils/notificationHelper');
const { redisClient } = require('../config/redis');

// Cookie options for refresh token
const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/api/v1/auth', // Scoped to auth endpoints to prevent sending it elsewhere
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days default fallback
  };
};

// Generate Access and Refresh Tokens
const generateTokens = async (user) => {
  const accessToken = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const rawRefreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  // Hash the refresh token before saving to the DB to prevent leaks
  const hashedRefreshToken = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  user.refreshToken = hashedRefreshToken;
  await user.save({ validateBeforeSave: false });
  try {
    await redisClient.del(`session:user:${user._id}`);
  } catch (err) {}

  return { accessToken, refreshToken: rawRefreshToken };
};

// Register user
const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    // Check if email or username already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return next(new AppError('Email already registered', 400));
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return next(new AppError('Username is already taken', 400));
    }

    // Create user
    const user = new User({ username, email, password });
    
    // Generate verification token (saved directly to user doc)
    const verificationToken = user.generateVerificationToken();
    await user.save();

    // Send verification email
    try {
      await emailUtil.sendVerificationEmail(user, verificationToken);
    } catch (emailErr) {
      logger.error(`Failed to send verification email: ${emailErr.message}`);
      // Don't fail registration if email fails to send in dev
    }

    // Generate authentication tokens
    const { accessToken, refreshToken } = await generateTokens(user);

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, getCookieOptions());

    res.status(201).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isVerified: user.isVerified,
          role: user.role,
          isDisabled: user.isDisabled,
          createdAt: user.createdAt
        },
        accessToken
      }
    });
  } catch (error) {
    next(error);
  }
};

// Login user
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    // Find user and explicitly select password field
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError('Incorrect email or password', 401));
    }

    if (user.isDisabled) {
      return next(new AppError('Your account has been disabled. Please contact support.', 403));
    }

    // Generate tokens
    const { accessToken, refreshToken } = await generateTokens(user);

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, getCookieOptions());

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isVerified: user.isVerified,
          role: user.role,
          isDisabled: user.isDisabled,
          createdAt: user.createdAt
        },
        accessToken
      }
    });
  } catch (error) {
    next(error);
  }
};

// Logout user
const logout = async (req, res, next) => {
  try {
    // If user is authenticated, clear their refresh token in the DB and invalidate cache
    if (req.user) {
      req.user.refreshToken = undefined;
      await req.user.save({ validateBeforeSave: false });
      try {
        await redisClient.del(`session:user:${req.user._id}`);
      } catch (cacheErr) {
        logger.error(`Error invalidating session cache in logout: ${cacheErr.message}`);
      }
    }

    res.clearCookie('refreshToken', {
      ...getCookieOptions(),
      maxAge: 0 // instantly expire cookie
    });

    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Refresh Access Token
const refreshToken = async (req, res, next) => {
  try {
    // Retrieve token from cookie or request body (for versatility in testing)
    const token = req.cookies.refreshToken || req.body.refreshToken;

    if (!token) {
      return next(new AppError('No refresh token provided', 401));
    }

    // Hash the token to compare with DB
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user by the hashed refresh token
    const user = await User.findOne({ refreshToken: hashedToken });
    if (!user) {
      return next(new AppError('Invalid refresh token or session has expired', 401));
    }

    if (user.isDisabled) {
      return next(new AppError('Your account has been disabled. Please contact support.', 403));
    }

    // Verify JWT signature of the refresh token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      // If token expired or was modified, remove it from DB and invalidate cache
      user.refreshToken = undefined;
      await user.save({ validateBeforeSave: false });
      try {
        await redisClient.del(`session:user:${user._id}`);
      } catch (cacheErr) {}
      return next(new AppError('Expired or invalid refresh token', 401));
    }

    // Token is valid! Rotate tokens (generate new access and refresh tokens)
    const { accessToken, refreshToken: newRefreshToken } = await generateTokens(user);

    // Set new refresh token cookie
    res.cookie('refreshToken', newRefreshToken, getCookieOptions());

    res.status(200).json({
      status: 'success',
      data: {
        accessToken
      }
    });
  } catch (error) {
    next(error);
  }
};

// Verify Email
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with matching token and valid expiry
    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return next(new AppError('Verification token is invalid or has expired', 400));
    }

    // Mark as verified and clear verification fields
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save({ validateBeforeSave: false });
    try {
      await redisClient.del(`session:user:${user._id}`);
    } catch (cacheErr) {}

    res.status(200).json({
      status: 'success',
      message: 'Email verified successfully!'
    });
  } catch (error) {
    next(error);
  }
};

// Resend Email Verification Token
const resendVerification = async (req, res, next) => {
  try {
    const user = req.user;

    if (user.isVerified) {
      return next(new AppError('This account is already verified', 400));
    }

    // Generate new token
    const verificationToken = user.generateVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Send email
    await emailUtil.sendVerificationEmail(user, verificationToken);

    res.status(200).json({
      status: 'success',
      message: 'Verification email sent successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Forgot Password Request
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(new AppError('Please provide an email address', 400));
    }

    const user = await User.findOne({ email });
    
    // For security reasons, don't leak whether email exists in our DB
    if (!user) {
      return res.status(200).json({
        status: 'success',
        message: 'If that email address exists in our database, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Send password reset email
    try {
      await emailUtil.sendPasswordResetEmail(user, resetToken);
    } catch (emailErr) {
      logger.error(`Failed to send password reset email: ${emailErr.message}`);
      return next(new AppError('There was an error sending the password reset email. Try again later.', 500));
    }

    res.status(200).json({
      status: 'success',
      message: 'If that email address exists in our database, a password reset link has been sent.'
    });
  } catch (error) {
    next(error);
  }
};

// Reset Password
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return next(new AppError('Please provide a new password', 400));
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid reset token and unexpired timer
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return next(new AppError('Token is invalid or has expired', 400));
    }

    // Set new password and clear token fields
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    
    // Invalidate current refresh token/sessions to force re-login
    user.refreshToken = undefined;
    
    await user.save(); // pre-save hook will hash password automatically!

    // Trigger Notification
    await createNotification({
      userId: user._id,
      title: 'Password Changed',
      message: 'Your account password has been changed successfully.',
      type: 'password_changed'
    });

    // Generate new tokens and set session cookie
    const { accessToken, refreshToken } = await generateTokens(user);
    res.cookie('refreshToken', refreshToken, getCookieOptions());

    res.status(200).json({
      status: 'success',
      message: 'Password reset successfully',
      data: {
        accessToken
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get current user profile
const getMe = async (req, res, next) => {
  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        isVerified: req.user.isVerified,
        role: req.user.role,
        isDisabled: req.user.isDisabled,
        profilePicture: req.user.profilePicture || '',
        createdAt: req.user.createdAt
      }
    }
  });
};

// Update name (username) and email
const updateMe = async (req, res, next) => {
  try {
    const { username, email } = req.body;
    const user = req.user;

    if (!username && !email) {
      return next(new AppError('Please provide username or email to update', 400));
    }

    let emailChanged = false;

    if (username && username !== user.username) {
      if (username.length < 3) {
        return next(new AppError('Username must be at least 3 characters', 400));
      }
      if (username.length > 30) {
        return next(new AppError('Username cannot exceed 30 characters', 400));
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return next(new AppError('Username can only contain alphanumeric characters and underscores', 400));
      }

      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return next(new AppError('Username is already taken', 400));
      }
      user.username = username;
    }

    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(email)) {
        return next(new AppError('Please fill a valid email address', 400));
      }

      const existingEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        return next(new AppError('Email already registered', 400));
      }

      user.email = email.toLowerCase();
      user.isVerified = false;
      emailChanged = true;
    }

    if (emailChanged) {
      const verificationToken = user.generateVerificationToken();
      await user.save();
      try {
        await emailUtil.sendVerificationEmail(user, verificationToken);
      } catch (emailErr) {
        logger.error(`Failed to send verification email during profile update: ${emailErr.message}`);
      }
    } else {
      await user.save();
    }

    try {
      await redisClient.del(`session:user:${user._id}`);
    } catch (cacheErr) {}

    res.status(200).json({
      status: 'success',
      message: emailChanged ? 'Profile updated. A verification link has been sent to your new email.' : 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isVerified: user.isVerified,
          role: user.role,
          isDisabled: user.isDisabled,
          profilePicture: user.profilePicture || '',
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update profile picture (Base64 data)
const updateProfilePicture = async (req, res, next) => {
  try {
    const { profilePicture } = req.body;
    const user = req.user;

    user.profilePicture = profilePicture || '';
    await user.save({ validateBeforeSave: false });

    try {
      await redisClient.del(`session:user:${user._id}`);
    } catch (cacheErr) {}

    res.status(200).json({
      status: 'success',
      message: 'Profile picture updated successfully',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isVerified: user.isVerified,
          role: user.role,
          isDisabled: user.isDisabled,
          profilePicture: user.profilePicture || '',
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Change Password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return next(new AppError('Please provide current password and new password', 400));
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user || !(await user.comparePassword(currentPassword))) {
      return next(new AppError('Incorrect current password', 401));
    }

    if (newPassword.length < 8) {
      return next(new AppError('Password must be at least 8 characters', 400));
    }

    user.password = newPassword;
    user.refreshToken = undefined;
    await user.save();

    try {
      await createNotification({
        userId: user._id,
        title: 'Password Changed',
        message: 'Your account password has been changed successfully.',
        type: 'password_changed'
      });
    } catch (notifErr) {
      logger.error(`Notification trigger failed during password change: ${notifErr.message}`);
    }

    const { accessToken, refreshToken } = await generateTokens(user);
    res.cookie('refreshToken', refreshToken, getCookieOptions());

    res.status(200).json({
      status: 'success',
      message: 'Password changed successfully',
      data: {
        accessToken
      }
    });
  } catch (error) {
    next(error);
  }
};

// Delete account
const deleteMe = async (req, res, next) => {
  try {
    const userId = req.user._id;

    res.clearCookie('refreshToken', {
      ...getCookieOptions(),
      maxAge: 0
    });

    // Fetch user's URLs before deletion to invalidate caches
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
      logger.error(`Error deleting user cache in deleteMe: ${cacheErr.message}`);
    }

    await Click.deleteMany({ createdBy: userId });
    await Url.deleteMany({ createdBy: userId });
    await Notification.deleteMany({ user: userId });
    
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      status: 'success',
      message: 'Your account has been deleted successfully along with all your data.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  refreshToken,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  getMe,
  updateMe,
  updateProfilePicture,
  changePassword,
  deleteMe
};
