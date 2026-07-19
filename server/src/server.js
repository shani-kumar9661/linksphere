const dotenv = require('dotenv');
const logger = require('./config/logger');

// Catch uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
  logger.info('Shutting down due to uncaught exception...');
  process.exit(1);
});

// Load environment variables
dotenv.config();

const connectDB = require('./config/db');
const { connectRedis, redisClient } = require('./config/redis');
const app = require('./app');

// Connect to Databases
connectDB();
connectRedis();

const Url = require('./models/Url');
const { createNotification } = require('./utils/notificationHelper');
const { initJobs } = require('./jobs');

// Start background jobs scheduler after DB connection
initJobs();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`, { stack: err.stack });
  logger.info('Shutting down server gracefully...');
  server.close(() => {
    logger.info('Server closed. Exiting process...');
    process.exit(1);
  });
});
