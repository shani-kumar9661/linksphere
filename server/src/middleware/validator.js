const { body, param, query, validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

/**
 * Generic middleware to inspect validation results and throw AppError if validation fails
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => err.msg).join(', ');
    return next(new AppError(errorMessages, 400));
  }
  next();
};

/**
 * Validation rules for MongoDB Object ID parameter
 */
const validateIdParam = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  validate
];

/**
 * Validation rules for URL shortCode parameter
 */
const validateShortCodeParam = [
  param('shortCode')
    .trim()
    .notEmpty()
    .withMessage('Short code is required'),
  validate
];

/**
 * Auth validation schemas
 */
const registerValidator = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Please provide a username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain alphanumeric characters and underscores'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Please provide an email address')
    .isEmail()
    .withMessage('Please fill a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Please provide a password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  validate
];

const loginValidator = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Please provide email and password')
    .isEmail()
    .withMessage('Please fill a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Please provide email and password'),
  validate
];

const changePasswordValidator = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  validate
];

const updateMeValidator = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain alphanumeric characters and underscores'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please fill a valid email address')
    .normalizeEmail(),
  validate
];

const forgotPasswordValidator = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Please provide an email address')
    .isEmail()
    .withMessage('Please fill a valid email address')
    .normalizeEmail(),
  validate
];

const resetPasswordValidator = [
  param('token')
    .notEmpty()
    .withMessage('Reset token is required')
    .isHexadecimal()
    .withMessage('Invalid token format'),
  body('password')
    .notEmpty()
    .withMessage('Please provide a password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  validate
];

/**
 * URL validation schemas
 */
const createUrlValidator = [
  body('originalUrl')
    .trim()
    .notEmpty()
    .withMessage('Original URL is required')
    .custom((val) => {
      // Matches typical URL structures or localhost
      const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/;
      const localhostRegex = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?([\/\w .-]*)*\/?$/;
      if (!urlRegex.test(val) && !localhostRegex.test(val)) {
        throw new Error(`${val} is not a valid URL!`);
      }
      return true;
    }),
  body('title')
    .optional()
    .trim(),
  body('customAlias')
    .optional()
    .trim()
    .matches(/^[a-zA-Z0-9-_]{3,30}$/)
    .withMessage('Custom alias must be alphanumeric (dashes/underscores allowed) and between 3 and 30 characters'),
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Invalid expiration date format')
    .toDate()
    .custom((val) => {
      if (val <= new Date()) {
        throw new Error('Expiration date must be in the future');
      }
      return true;
    }),
  body('category')
    .optional()
    .isIn(['Work', 'College', 'Portfolio', 'Social', 'Marketing', ''])
    .withMessage('Category must be one of: Work, College, Portfolio, Social, Marketing'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
    .custom((tags) => {
      const allowed = ['Docker', 'React', 'AWS', 'AI'];
      if (!tags.every(tag => allowed.includes(tag))) {
        throw new Error('Tags must be one or more of: Docker, React, AWS, AI');
      }
      return true;
    }),
  body('note')
    .optional()
    .isString()
    .withMessage('Note must be a string'),
  body('isFavorite')
    .optional()
    .isBoolean()
    .withMessage('isFavorite must be a boolean'),
  body('isArchived')
    .optional()
    .isBoolean()
    .withMessage('isArchived must be a boolean'),
  body('isPinned')
    .optional()
    .isBoolean()
    .withMessage('isPinned must be a boolean'),
  body('password')
    .optional()
    .isString()
    .withMessage('Password must be a string'),
  validate
];

const updateUrlValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  body('originalUrl')
    .optional()
    .trim()
    .custom((val) => {
      const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/;
      const localhostRegex = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?([\/\w .-]*)*\/?$/;
      if (!urlRegex.test(val) && !localhostRegex.test(val)) {
        throw new Error(`${val} is not a valid URL!`);
      }
      return true;
    }),
  body('title')
    .optional()
    .trim(),
  body('customAlias')
    .optional()
    .trim()
    .matches(/^[a-zA-Z0-9-_]{3,30}$/)
    .withMessage('Custom alias must be alphanumeric (dashes/underscores allowed) and between 3 and 30 characters'),
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Invalid expiration date format')
    .toDate()
    .custom((val) => {
      if (val <= new Date()) {
        throw new Error('Expiration date must be in the future');
      }
      return true;
    }),
  body('category')
    .optional()
    .isIn(['Work', 'College', 'Portfolio', 'Social', 'Marketing', ''])
    .withMessage('Category must be one of: Work, College, Portfolio, Social, Marketing'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
    .custom((tags) => {
      const allowed = ['Docker', 'React', 'AWS', 'AI'];
      if (!tags.every(tag => allowed.includes(tag))) {
        throw new Error('Tags must be one or more of: Docker, React, AWS, AI');
      }
      return true;
    }),
  body('note')
    .optional()
    .isString()
    .withMessage('Note must be a string'),
  body('isFavorite')
    .optional()
    .isBoolean()
    .withMessage('isFavorite must be a boolean'),
  body('isArchived')
    .optional()
    .isBoolean()
    .withMessage('isArchived must be a boolean'),
  body('isPinned')
    .optional()
    .isBoolean()
    .withMessage('isPinned must be a boolean'),
  body('password')
    .optional()
    .isString()
    .withMessage('Password must be a string'),
  validate
];

const verifyUrlPasswordValidator = [
  param('shortCode')
    .trim()
    .notEmpty()
    .withMessage('Short code is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isString()
    .withMessage('Password must be a string'),
  validate
];

module.exports = {
  validateIdParam,
  validateShortCodeParam,
  registerValidator,
  loginValidator,
  changePasswordValidator,
  updateMeValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  createUrlValidator,
  updateUrlValidator,
  verifyUrlPasswordValidator
};
