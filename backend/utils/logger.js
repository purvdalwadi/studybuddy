const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { format } = winston;
const { combine, timestamp, printf, colorize, align, json, errors, splat } = format;
require('winston-daily-rotate-file');

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define custom colors for different log levels
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

// Add colors to winston
winston.addColors(colors);

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const ts = timestamp.slice(0, 19).replace('T', ' ');
  let log = `${ts} [${level}]: ${message}`;
  
  if (stack) {
    log += `\n${stack}`;
  }
  
  if (Object.keys(meta).length > 0) {
    log += `\n${JSON.stringify(meta, null, 2)}`;
  }
  
  return log;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    splat(),
    json()
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        consoleFormat
      ),
      handleExceptions: true,
      handleRejections: true
    }),
    // Daily rotating file transport for error logs
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error'
    }),
    // Daily rotating file transport for all logs
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d'
    })
  ],
  defaultMeta: { service: 'studybuddy-api' },
  exitOnError: false // Don't exit on handled exceptions
});

// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: combine(
      colorize({ all: true }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      align(),
      consoleFormat
    ),
    level: 'debug',
    handleExceptions: true,
    handleRejections: true
  }));
}

// Create a stream object with a 'write' function that will be used by morgan
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  // Recommended: send the information to a crash reporting service
  // process.exit(1); // Exit with failure
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error });
  // Recommended: send the information to a crash reporting service
  // process.exit(1); // Exit with failure
});

// Add color methods to logger for console output
Object.keys(colors).forEach(level => {
  logger[`${level}Color`] = (message) => {
    const color = colors[level] || 'white';
    return `\x1b[${color === 'red' ? '31' : 
                         color === 'green' ? '32' : 
                         color === 'yellow' ? '33' : 
                         color === 'blue' ? '34' : 
                         color === 'magenta' ? '35' : '37'}m${message}\x1b[0m`;
  };
});

module.exports = logger;
