const fs = require('fs');
const path = require('path');

// Create a logs folder if it doesn't exist
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Log file path
const logFilePath = path.join(logDir, 'app.log');

// Write log function
function writeLog(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFilePath, logMessage, 'utf8');
}
const log = (message, isError = false) => {
    const logType = isError ? 'ERROR' : 'INFO';
    console[isError ? 'error' : 'log'](`[${new Date().toISOString()}] [${logType}] ${message}`);
};

module.exports = writeLog;
module.exports = log;
