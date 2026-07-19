const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

const runCleanupLogs = async () => {
  logger.info('Starting cleanupLogsJob...');
  try {
    const logsDir = path.join(__dirname, '../../logs');
    const logFiles = ['error.log', 'combined.log'];
    const maxSizeBytes = 5 * 1024 * 1024; // 5 MB

    let cleanupCount = 0;

    for (const fileName of logFiles) {
      const filePath = path.join(logsDir, fileName);
      
      if (!fs.existsSync(filePath)) {
        logger.info(`Log file ${fileName} does not exist. Skipping.`);
        continue;
      }

      const stats = fs.statSync(filePath);
      logger.info(`Log file ${fileName} size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);

      if (stats.size > maxSizeBytes) {
        const backupPath = `${filePath}.bak`;
        
        // Remove existing backup if it exists
        if (fs.existsSync(backupPath)) {
          fs.unlinkSync(backupPath);
          logger.info(`Deleted existing backup log: ${backupPath}`);
        }

        // Rename current to backup (rotation)
        fs.renameSync(filePath, backupPath);
        logger.info(`Rotated log file ${fileName} to ${fileName}.bak`);

        // Recreate empty log file
        fs.writeFileSync(filePath, '', 'utf8');
        logger.info(`Recreated empty log file: ${fileName}`);
        cleanupCount++;
      } else {
        logger.info(`Log file ${fileName} does not exceed size limit of 5MB. No rotation needed.`);
      }
    }

    logger.info(`cleanupLogsJob completed: ${cleanupCount} file(s) rotated.`);
    return { success: true, rotatedCount: cleanupCount };
  } catch (error) {
    logger.error(`Error in cleanupLogsJob: ${error.message}`, { error });
    return { success: false, error: error.message };
  }
};

module.exports = { runCleanupLogs };
