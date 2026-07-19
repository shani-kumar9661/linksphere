const { createClient } = require('redis');
const logger = require('./logger');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const redisClient = createClient({
  url: redisUrl
});

redisClient.on('error', (err) => {
  logger.error(`Redis Client Error: ${err.message}`, { error: err });
});

redisClient.on('connect', () => {
  logger.info('Redis Client connecting...');
});

redisClient.on('ready', () => {
  logger.info('Redis Client ready and connected');
});

redisClient.on('reconnecting', () => {
  logger.warn('Redis Client reconnecting...');
});

redisClient.on('end', () => {
  logger.info('Redis Client connection closed');
});

const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (error) {
    logger.error(`Failed to connect to Redis: ${error.message}`, { error });
  }
};

module.exports = {
  redisClient,
  connectRedis
};
