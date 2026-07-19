const mongoose = require('mongoose');
const logger = require('./logger');
const User = require('../models/User');

const seedAdminUser = async () => {
  try {
    const adminEmail = 'admin@linksphere.com';
    const adminExists = await User.findOne({ email: adminEmail });
    if (!adminExists) {
      const admin = new User({
        username: 'admin',
        email: adminEmail,
        password: 'AdminPassword123!',
        isVerified: true,
        role: 'admin'
      });
      await admin.save();
      logger.info('Default admin user seeded successfully: admin@linksphere.com / AdminPassword123!');
    }
  } catch (error) {
    logger.error(`Error seeding admin user: ${error.message}`);
  }
};

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/linksphere';
    const conn = await mongoose.connect(mongoUri);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    await seedAdminUser();
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB connection disconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error(`MongoDB connection error: ${err.message}`);
});

// Graceful close on app termination
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed through app termination');
  process.exit(0);
});

module.exports = connectDB;
