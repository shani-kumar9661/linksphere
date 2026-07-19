const logger = require('../config/logger');

/**
 * Resolves geolocation details (Country & City) asynchronously and saves the click record.
 * This runs in the background to avoid blocking user redirection.
 * @param {object} clickData 
 * @param {string} ipAddress 
 */
const resolveGeoAndSaveClick = async (clickData, ipAddress) => {
  try {
    const isLocalhost = !ipAddress || 
      ipAddress === '127.0.0.1' || 
      ipAddress === '::1' || 
      ipAddress === 'localhost' || 
      ipAddress.startsWith('::ffff:127.0.0.1') ||
      ipAddress.startsWith('fe80:');

    if (isLocalhost) {
      clickData.country = 'Localhost';
      clickData.city = 'Localhost';
    } else {
      // Use ip-api.com free geolocation service
      const response = await fetch(`http://ip-api.com/json/${ipAddress}`);
      if (response.ok) {
        const geo = await response.json();
        if (geo.status === 'success') {
          clickData.country = geo.country || 'Unknown';
          clickData.city = geo.city || 'Unknown';
        }
      }
    }
  } catch (error) {
    logger.error(`GeoIP lookup error for IP ${ipAddress}: ${error.message}`);
  } finally {
    try {
      const Click = require('../models/Click');
      const click = new Click(clickData);
      await click.save();

      // Invalidate creator's analytics dashboard cache
      try {
        const { redisClient } = require('../config/redis');
        await redisClient.del(`analytics:dashboard:${clickData.createdBy}`);
      } catch (cacheErr) {
        logger.error(`Failed to invalidate analytics cache on click: ${cacheErr.message}`);
      }
    } catch (saveError) {
      logger.error(`Failed to save click record: ${saveError.message}`);
    }
  }
};

module.exports = {
  resolveGeoAndSaveClick
};
