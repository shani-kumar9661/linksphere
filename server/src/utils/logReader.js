const fs = require('fs').promises;

/**
 * Strips ANSI color/control codes from a string.
 * @param {string} str 
 * @returns {string}
 */
function stripAnsi(str) {
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

/**
 * Reads the last N lines of a file, parsing each line as a JSON object (ignoring malformed or empty lines).
 * @param {string} filePath - Absolute path to the log file
 * @param {number} lineCount - Max number of log lines to return
 * @returns {Promise<Object[]>}
 */
async function readLastLogLines(filePath, lineCount = 100) {
  try {
    const fileHandle = await fs.open(filePath, 'r');
    const { size } = await fileHandle.stat();
    
    if (size === 0) {
      await fileHandle.close();
      return [];
    }

    // Read up to 512KB from the end of the file to prevent loading massive files in memory
    const bufferSize = Math.min(size, 512 * 1024);
    const buffer = Buffer.alloc(bufferSize);
    
    await fileHandle.read(buffer, 0, bufferSize, size - bufferSize);
    await fileHandle.close();

    const content = buffer.toString('utf-8');
    const rawLines = content.split('\n');
    
    const parsedLogs = [];
    // Iterate from the end to get the requested count of valid log entries
    for (let i = rawLines.length - 1; i >= 0; i--) {
      const line = rawLines[i].trim();
      if (!line) continue;

      try {
        const cleanLine = stripAnsi(line);
        const parsed = JSON.parse(cleanLine);
        parsedLogs.push(parsed);
        if (parsedLogs.length >= lineCount) {
          break;
        }
      } catch (err) {
        // Skip malformed/partial JSON lines
        continue;
      }
    }

    return parsedLogs;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

module.exports = {
  readLastLogLines,
  stripAnsi
};
