const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const VALID_STACKS = new Set(['backend']);
const VALID_LEVELS = new Set(['debug', 'info', 'warn', 'error', 'fatal']);
const VALID_PACKAGES = new Set([
  'cache',
  'controller',
  'cron_job',
  'db',
  'domain',
  'handler',
  'repository',
  'route',
  'service',
  'auth',
  'config',
  'middleware',
  'utils'
]);

const LOG_SERVER_URL = process.env.BASE_URL ? `${process.env.BASE_URL}/logs` : 'http://20.207.122.201/evaluation-service/logs';
const AUTH_TOKEN = process.env.ACCESS_TOKEN || null;

console.log('logging_middleware loaded');
console.log('  env ACCESS_TOKEN exists:', !!process.env.ACCESS_TOKEN);
console.log('  AUTH_TOKEN constant exists:', !!AUTH_TOKEN);
console.log('  LOG_SERVER_URL:', LOG_SERVER_URL);

function normalize(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function validateField(value, name, allowed) {
  const normalized = normalize(value);
  if (typeof normalized !== 'string' || normalized.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  if (!allowed.has(normalized)) {
    throw new RangeError(`${name} must be one of: ${Array.from(allowed).join(', ')}`);
  }
  return normalized;
}

async function sendToLogServer(payload, retryCount = 0) {
  if (!AUTH_TOKEN) {
    console.error('No access token available for logging');
    return null;
  }

  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  try {
    const response = await axios.post(LOG_SERVER_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      timeout: 10000
    });

    if (response.status === 200 || response.status === 201) {
      return response.data;
    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  } catch (error) {
    if (retryCount < maxRetries) {
      const delay = baseDelay * Math.pow(2, retryCount);
      console.error(`Logging failed, retrying in ${delay}ms: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendToLogServer(payload, retryCount + 1);
    } else {
      console.error(`Logging failed after ${maxRetries} retries: ${error.message}`);
      return null;
    }
  }
}

/**
 * Logs a structured message to the evaluation service
 * @param {string} stack - The stack (must be 'backend')
 * @param {string} level - The log level ('debug', 'info', 'warn', 'error', 'fatal')
 * @param {string} pkg - The package ('cache', 'controller', etc.)
 * @param {string} message - The log message
 * @returns {Promise<string|null>} The logID if successful, null otherwise
 */
async function Log(stack, level, pkg, message) {
  const normalizedStack = validateField(stack, 'stack', VALID_STACKS);
  const normalizedLevel = validateField(level, 'level', VALID_LEVELS);
  const normalizedPackage = validateField(pkg, 'package', VALID_PACKAGES);

  if (typeof message !== 'string') {
    throw new TypeError('message must be a string');
  }

  const payload = {
    stack: normalizedStack,
    level: normalizedLevel,
    package: normalizedPackage,
    message
  };

  const response = await sendToLogServer(payload);
  if (response && response.logID) {
    return response.logID;
  }
  return null;
}

function requestLogger(req, res, next) {
  Log('backend', 'info', 'middleware', `Incoming request: ${req.method} ${req.originalUrl}`).catch(() => {});
  next();
}

module.exports = {
  Log,
  requestLogger,
  VALID_STACKS,
  VALID_LEVELS,
  VALID_PACKAGES
};
