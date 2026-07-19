const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Report must belong to a user'],
    index: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  totalClicks: {
    type: Number,
    default: 0
  },
  clicksThisWeek: {
    type: Number,
    default: 0
  },
  mostPopularUrl: {
    id: mongoose.Schema.Types.ObjectId,
    title: String,
    shortCode: String,
    originalUrl: String,
    clicks: Number
  },
  breakdowns: {
    browsers: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    devices: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    operatingSystems: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    countries: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    referrers: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Report', reportSchema);
