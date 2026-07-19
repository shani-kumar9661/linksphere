const express = require('express');
const router = express.Router();
const urlController = require('../controllers/urlController');
const { protect } = require('../middleware/auth');
const {
  createUrlValidator,
  updateUrlValidator,
  verifyUrlPasswordValidator,
  validateIdParam
} = require('../middleware/validator');

// Public route for password verification
router.post('/verify-password/:shortCode', verifyUrlPasswordValidator, urlController.verifyUrlPassword);

// All URL endpoints require authentication
router.use(protect);

router.route('/')
  .post(createUrlValidator, urlController.createUrl)
  .get(urlController.getAllUrls);

router.route('/:id')
  .get(validateIdParam, urlController.getUrl)
  .patch(updateUrlValidator, urlController.updateUrl)
  .delete(validateIdParam, urlController.deleteUrl);

module.exports = router;
