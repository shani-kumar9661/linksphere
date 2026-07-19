const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validator');

// All report routes require authentication
router.use(protect);

router.get('/', reportController.getMyReports);
router.get('/:id', validateIdParam, reportController.getReportById);

module.exports = router;
