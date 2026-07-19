const UAParser = require('ua-parser-js');

/**
 * Parses user agent string and returns browser, device type, and operating system.
 * @param {string} userAgentString 
 * @returns {object} { browser, device, operatingSystem }
 */
const parseUserAgent = (userAgentString) => {
  if (!userAgentString) {
    return {
      browser: 'Unknown',
      device: 'Desktop',
      operatingSystem: 'Unknown'
    };
  }

  const parser = new UAParser(userAgentString);
  const result = parser.getResult();

  // Normalize device type
  let deviceType = result.device.type; // e.g. mobile, tablet, smarttv
  if (!deviceType) {
    deviceType = 'Desktop';
  } else {
    // Capitalize first letter (e.g. 'mobile' -> 'Mobile')
    deviceType = deviceType.charAt(0).toUpperCase() + deviceType.slice(1);
  }

  return {
    browser: result.browser.name || 'Unknown',
    device: deviceType,
    operatingSystem: result.os.name || 'Unknown'
  };
};

module.exports = {
  parseUserAgent
};
