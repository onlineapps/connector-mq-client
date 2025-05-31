'use strict';

/**
 * defaultConfig.js
 *
 * Provides default configuration values for AgentMQClient.
 * Users can override any of these by passing a custom config object
 * or by supplying overrides to connect().
 */

module.exports = {
  // Transport type: currently only 'rabbitmq' is fully supported.
  // If set to 'kafka' in future, additional Kafka-specific fields will be honored.
  type: 'rabbitmq',

  // RabbitMQ connection URI or hostname (e.g., 'amqp://localhost:5672').
  host: 'amqp://localhost:5672',

  // Default queue name; can be overridden per call to publish/consume.
  queue: '',

  // Default exchange name (empty string → default direct exchange).
  exchange: '',

  // Declare queues/exchanges as durable by default.
  durable: true,

  // Default prefetch count for consumers.
  prefetch: 1,

  // Default auto-acknowledge setting for consumers.
  noAck: false,

  // Custom logger object (if not provided, console.* will be used).
  // Expected interface: { info(), warn(), error(), debug() }.
  logger: null,

  // Retry policy for reconnect attempts (not fully implemented in current version).
  // - retries: maximum number of reconnection attempts
  // - initialDelayMs: starting backoff delay
  // - maxDelayMs: maximum backoff delay
  // - factor: exponential backoff multiplier
  retryPolicy: {
    retries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    factor: 2,
  },
};
