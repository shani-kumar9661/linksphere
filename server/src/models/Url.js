const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');


const urlSchema = new mongoose.Schema({
  originalUrl: {
    type: String,
    required: [true, 'Original URL is required'],
    trim: true,
    validate: {
      validator: function(v) {
        // Simple regex to check http/https URL format or localhost pattern
        return /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/.test(v) ||
               /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?([\/\w .-]*)*\/?$/.test(v);
      },
      message: props => `${props.value} is not a valid URL!`
    }
  },
  shortCode: {
    type: String,
    required: [true, 'Short code is required'],
    unique: true,
    trim: true,
    index: true
  },
  title: {
    type: String,
    trim: true
  },
  customAlias: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'URL must belong to a user']
  },
  clicks: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date
  },
  category: {
    type: String,
    enum: {
      values: ['Work', 'College', 'Portfolio', 'Social', 'Marketing', ''],
      message: 'Category must be one of: Work, College, Portfolio, Social, Marketing'
    },
    default: ''
  },
  tags: {
    type: [String],
    validate: {
      validator: function(v) {
        const allowed = ['Docker', 'React', 'AWS', 'AI'];
        return v.every(tag => allowed.includes(tag));
      },
      message: 'Tags must be one or more of: Docker, React, AWS, AI'
    },
    default: []
  },
  note: {
    type: String,
    default: ''
  },
  isFavorite: {
    type: Boolean,
    default: false
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  password: {
    type: String,
    select: false
  },
  isPasswordProtected: {
    type: Boolean,
    default: false
  },
  expirationReminderSent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});


// Normalize the originalUrl pre-save: ensure it starts with http:// or https://
urlSchema.pre('save', async function() {
  if (this.originalUrl && !/^https?:\/\//i.test(this.originalUrl)) {
    this.originalUrl = `http://${this.originalUrl}`;
  }
  
  // Set default title if missing
  if (!this.title) {
    try {
      const urlObj = new URL(this.originalUrl);
      this.title = urlObj.hostname;
    } catch (e) {
      this.title = this.originalUrl.substring(0, 30);
    }
  }

  // Hash password before saving if modified
  if (this.isModified('password')) {
    if (this.password) {
      this.password = await bcrypt.hash(this.password, 12);
      this.isPasswordProtected = true;
    } else {
      this.password = undefined;
      this.isPasswordProtected = false;
    }
  }
});

// Compare password
urlSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};


module.exports = mongoose.model('Url', urlSchema);
