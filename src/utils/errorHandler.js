'use strict';

/**
 * errorHandler.js
 *
 * Defines all custom error types used by AgentMQClient and RabbitMQClient.
 * Each extends the built-in Error class and carries additional contextual fields.
 */

/**
 * ValidationError
 * Thrown when user-supplied configuration does not match schema.
 * - message: human-readable description
 * - details: array of { path, message } describing each invalid field
 */
class ValidationError extends Error {
  /**
   * @param {string} message
   * @param {Array<{path: string, message: string}>} details
   */
  constructor(message, details) {
    super(message);
    this.name = 'ValidationError';
    this.details = Array.isArray(details) ? details : [];
    Error.captureStackTrace(this, ValidationError);
  }
}

/**
 * ConnectionError
 * Thrown when client cannot connect to broker.
 * - message: description of what went wrong
 * - cause: original error object
 */
class ConnectionError extends Error {
  /**
   * @param {string} message
   * @param {Error} cause
   */
  constructor(message, cause) {
    super(message);
    this.name = 'ConnectionError';
    this.cause = cause;
    Error.captureStackTrace(this, ConnectionError);
  }
}

/**
 * PublishError
 * Thrown when publishing a message fails.
 * - message: description
 * - queue: target queue name
 * - cause: original error
 */
class PublishError extends Error {
  /**
   * @param {string} message
   * @param {string} queue
   * @param {Error} cause
   */
  constructor(message, queue, cause) {
    super(message);
    this.name = 'PublishError';
    this.queue = queue;
    this.cause = cause;
    Error.captureStackTrace(this, PublishError);
  }
}

/**
 * ConsumeError
 * Thrown when setting up a consumer fails.
 * - message: description
 * - queue: queue name associated with the consumer
 * - cause: original error
 */
class ConsumeError extends Error {
  /**
   * @param {string} message
   * @param {string} queue
   * @param {Error} cause
   */
  constructor(message, queue, cause) {
    super(message);
    this.name = 'ConsumeError';
    this.queue = queue;
    this.cause = cause;
    Error.captureStackTrace(this, ConsumeError);
  }
}

/**
 * SerializationError
 * Thrown when JSON serialization or deserialization fails.
 * - message: description
 * - payload: original object or buffer that caused the error
 * - cause: native exception (e.g., TypeError for circular references)
 */
class SerializationError extends Error {
  /**
   * @param {string} message
   * @param {*} payload
   * @param {Error} cause
   */
  constructor(message, payload, cause) {
    super(message);
    this.name = 'SerializationError';
    this.payload = payload;
    this.cause = cause;
    Error.captureStackTrace(this, SerializationError);
  }
}

module.exports = {
  ValidationError,
  ConnectionError,
  PublishError,
  ConsumeError,
  SerializationError,
};
