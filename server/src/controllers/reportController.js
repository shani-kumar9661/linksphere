const Report = require('../models/Report');
const AppError = require('../utils/AppError');

/**
 * Retrieves all analytics reports generated for the authenticated user (paginated)
 * GET /api/v1/reports
 */
const getMyReports = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Pagination parameters
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const reports = await Report.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Report.countDocuments({ user: userId });

    res.status(200).json({
      status: 'success',
      results: reports.length,
      page,
      pages: Math.ceil(total / limit),
      total,
      data: {
        reports
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves a specific analytics report details by ID
 * GET /api/v1/reports/:id
 */
const getReportById = async (req, res, next) => {
  try {
    const reportId = req.params.id;
    const userId = req.user._id;

    const report = await Report.findById(reportId);

    if (!report) {
      return next(new AppError('No report found with that ID', 404));
    }

    // Verify report belongs to the authenticated user (except if they are an admin)
    if (report.user.toString() !== userId.toString() && req.user.role !== 'admin') {
      return next(new AppError('You do not have permission to access this report', 403));
    }

    res.status(200).json({
      status: 'success',
      data: {
        report
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyReports,
  getReportById
};
