const crypto = require('crypto');

/**
 * Generates a cryptographically secure random alphanumeric string of specified length.
 * Uses Base62 characters: A-Z, a-z, 0-9.
 * @param {number} length - Length of short code to generate (default 6)
 * @returns {string}
 */
const generateShortCode = (length = 6) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
};

module.exports = generateShortCode;
