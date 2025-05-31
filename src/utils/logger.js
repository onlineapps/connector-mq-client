'use strict';

/**
 * logger.js
 *
 * Provides a simple abstraction over console or a custom logger.
 * If the user passes a custom logger object with methods { info, warn, error, debug },
 * these are used; otherwise console.* se použije jako fallback.
 */

function createLogger(customLogger) {
  const methods = ['info', 'warn', 'error', 'debug'];
  if (
    customLogger &&
    typeof customLogger === 'object' &&
    methods.every((fn) => typeof customLogger[fn] === 'function')
  ) {
    // Wrap custom logger to ensure consistent signature
    return {
      info: (...args) => customLogger.info(...args),
      warn: (...args) => customLogger.warn(...args),
      error: (...args) => customLogger.error(...args),
      debug: (...args) => customLogger.debug(...args),
    };
  }

  // Fallback to console
  return {
    info: (...args) => console.log('[INFO]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    debug: (...args) => console.debug('[DEBUG]', ...args),
  };
}

module.exports = {
  createLogger,
};
