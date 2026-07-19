const mongoose = require('mongoose');
const { redisClient } = require('../config/redis');

/**
 * Format bytes to human readable Megabytes (MB)
 * @param {number} bytes 
 * @returns {string}
 */
const formatMemory = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

/**
 * Formats uptime in seconds to human readable format (e.g. 1d 4h 12m 3s)
 * @param {number} seconds 
 * @returns {string}
 */
const formatUptime = (seconds) => {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
};

exports.getHealth = async (req, res) => {
  try {
    // 1. Database Status
    const dbState = mongoose.connection.readyState;
    let dbStatus = 'disconnected';
    if (dbState === 1) dbStatus = 'connected';
    else if (dbState === 2) dbStatus = 'connecting';
    else if (dbState === 3) dbStatus = 'disconnecting';

    // 2. Redis Status
    let redisStatus = 'disconnected';
    if (redisClient && redisClient.isOpen) {
      try {
        const pingRes = await redisClient.ping();
        if (pingRes === 'PONG') {
          redisStatus = 'connected';
        } else {
          redisStatus = 'unresponsive';
        }
      } catch (err) {
        redisStatus = 'error';
      }
    }

    // 3. Memory Usage
    const memory = process.memoryUsage();

    // 4. Uptime
    const uptimeSeconds = process.uptime();

    const isHealthy = dbStatus === 'connected' && redisStatus === 'connected';

    const healthData = {
      status: isHealthy ? 'success' : 'unhealthy',
      database: dbStatus,
      redis: redisStatus,
      memoryUsage: {
        rss: formatMemory(memory.rss),
        heapTotal: formatMemory(memory.heapTotal),
        heapUsed: formatMemory(memory.heapUsed),
        external: formatMemory(memory.external)
      },
      uptime: Number(uptimeSeconds.toFixed(2)),
      uptimeFormatted: formatUptime(uptimeSeconds),
      timestamp: new Date().toISOString()
    };

    return res.status(isHealthy ? 200 : 503).json(healthData);
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while performing the health check',
      error: error.message
    });
  }
};
