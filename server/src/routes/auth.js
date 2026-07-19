const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const {
  registerValidator,
  loginValidator,
  changePasswordValidator,
  updateMeValidator,
  forgotPasswordValidator,
  resetPasswordValidator
} = require('../middleware/validator');
const { authLimiter } = require('../middleware/rateLimiter');

// Public routes
router.post('/register', authLimiter, registerValidator, authController.register);
router.post('/login', authLimiter, loginValidator, authController.login);
router.post('/refresh-token', authController.refreshToken);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/forgot-password', authLimiter, forgotPasswordValidator, authController.forgotPassword);
router.post('/reset-password/:token', authLimiter, resetPasswordValidator, authController.resetPassword);

// Protected routes
router.use(protect);

router.post('/logout', authController.logout);
router.post('/resend-verification', authLimiter, authController.resendVerification);
router.get('/me', authController.getMe);
router.patch('/update-me', updateMeValidator, authController.updateMe);
router.patch('/change-password', changePasswordValidator, authController.changePassword);
router.patch('/profile-picture', authController.updateProfilePicture);
router.delete('/delete-me', authController.deleteMe);

module.exports = router;
