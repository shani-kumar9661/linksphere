/**
 * Recursively removes keys starting with '$' or containing '.' to prevent MongoDB query injection.
 * Modifies the object in-place to support Express 5 which uses read-only getters for properties like req.query/req.params.
 * @param {*} obj Input value to sanitize
 * @returns {*} Sanitized value
 */
const sanitizeMongoObject = (obj) => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = sanitizeMongoObject(obj[i]);
    }
    return obj;
  }

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key];
      } else {
        obj[key] = sanitizeMongoObject(obj[key]);
      }
    }
  }
  return obj;
};

const mongoSanitizer = (req, res, next) => {
  if (req.body) {
    sanitizeMongoObject(req.body);
  }
  if (req.query) {
    sanitizeMongoObject(req.query);
  }
  if (req.params) {
    sanitizeMongoObject(req.params);
  }
  next();
};

module.exports = mongoSanitizer;
