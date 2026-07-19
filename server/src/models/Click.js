const mongoose = require('mongoose');

const clickSchema = new mongoose.Schema({
  url: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Url',
    required: [true, 'Click must belong to a URL'],
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Click must be associated with a URL owner'],
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  date: {
    type: String,
    required: true,
    index: true
  },
  time: {
    type: String,
    required: true
  },
  browser: {
    type: String,
    default: 'Unknown'
  },
  device: {
    type: String,
    default: 'Unknown'
  },
  operatingSystem: {
    type: String,
    default: 'Unknown'
  },
  country: {
    type: String,
    default: 'Unknown'
  },
  city: {
    type: String,
    default: 'Unknown'
  },
  referrer: {
    type: String,
    default: 'Direct'
  },
  clickCount: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Click', clickSchema);
