import { ENV } from '../constants/index';

/**
 * Logger utility for development and production
 */

const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

const getLevelColor = (level) => {
  const colors = {
    DEBUG: '#90CAF9',
    INFO: '#4CAF50',
    WARN: '#FFC107',
    ERROR: '#F44336',
  };
  return colors[level] || '#000';
};

const shouldLog = (level) => {
  if (ENV.IS_PRODUCTION) {
    return level !== LogLevel.DEBUG;
  }
  return true;
};

const formatMessage = (level, title, data) => {
  const timestamp = new Date().toISOString();
  return {
    timestamp,
    level,
    title,
    data,
  };
};

const logToConsole = (level, title, data) => {
  if (!shouldLog(level)) return;

  const color = getLevelColor(level);
  const style = `color: ${color}; font-weight: bold;`;
  const message = formatMessage(level, title, data);

  console.group(`%c[${level}] ${title}`, style);
  console.log('Timestamp:', message.timestamp);
  if (data) {
    console.log('Data:', data);
  }
  console.groupEnd();
};

export const logger = {
  debug: (title, data) => logToConsole(LogLevel.DEBUG, title, data),
  info: (title, data) => logToConsole(LogLevel.INFO, title, data),
  warn: (title, data) => logToConsole(LogLevel.WARN, title, data),
  error: (title, data) => logToConsole(LogLevel.ERROR, title, data),

  // API logging
  apiCall: (method, endpoint, data) => {
    logger.info(`API ${method} request`, {
      endpoint,
      data,
    });
  },

  apiResponse: (endpoint, response) => {
    logger.info(`API response from ${endpoint}`, response);
  },

  apiError: (endpoint, error) => {
    logger.error(`API error from ${endpoint}`, {
      message: error.message,
      status: error.status,
    });
  },

  // User action logging
  userAction: (action, details) => {
    logger.info(`User action: ${action}`, details);
  },

  // Performance logging
  performance: (name, duration) => {
    logger.info(`Performance: ${name}`, {
      duration: `${duration}ms`,
    });
  },
};

export default logger;
