'use strict';

/**
 * configSchema.js
 *
 * JSON Schema used by Ajv to validate the user-supplied configuration object.
 * Ensures required fields are present and correctly typed. Any unsupported
 * or misspelled field will trigger a ValidationError.
 */

module.exports = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['rabbitmq', 'kafka'],
    },
    host: {
      type: 'string',
      minLength: 1,
    },
    // For RabbitMQ: queue is required. For Kafka, topic/groupId could be used in future.
    queue: {
      type: 'string',
      minLength: 1,
    },
    exchange: {
      type: 'string',
    },
    durable: {
      type: 'boolean',
    },
    prefetch: {
      type: 'integer',
      minimum: 0,
    },
    noAck: {
      type: 'boolean',
    },
    logger: {
      type: 'object',
      description: 'Custom logger with methods: info, warn, error, debug',
    },
    retryPolicy: {
      type: 'object',
      properties: {
        retries: {
          type: 'integer',
          minimum: 0,
        },
        initialDelayMs: {
          type: 'integer',
          minimum: 0,
        },
        maxDelayMs: {
          type: 'integer',
          minimum: 0,
        },
        factor: {
          type: 'number',
          minimum: 1,
        },
      },
      required: ['retries', 'initialDelayMs', 'maxDelayMs', 'factor'],
      additionalProperties: false,
    },
  },
  required: ['type', 'host', 'queue'],
  additionalProperties: false,
};
