'use strict';

/**
 * AgentMQClient: a promise-based, broker-agnostic client for RabbitMQ (and minimal Kafka support).
 * Uses transportFactory to select the appropriate transport implementation.
 */

const Ajv = require('ajv');
const merge = require('lodash.merge');

const configSchema = require('./config/configSchema');
const defaultConfig = require('./config/defaultConfig');
const transportFactory = require('./transports/transportFactory');
const serializer = require('./utils/serializer');
const {
  ConnectionError,
  PublishError,
  ConsumeError,
  ValidationError,
  SerializationError,
} = require('./utils/errorHandler');

class AgentMQClient {
  /**
   * @param {Object} config - User-supplied configuration.
   * @throws {ValidationError} If required fields are missing or invalid.
   */
  constructor(config) {
    const ajv = new Ajv({ allErrors: true, useDefaults: true });
    const validate = ajv.compile(configSchema);

    // Merge user config with defaults
    this._config = merge({}, defaultConfig, config || {});

    // Validate merged config
    const valid = validate(this._config);
    if (!valid) {
      const details = validate.errors.map((err) => ({
        path: err.instancePath,
        message: err.message,
      }));
      throw new ValidationError('Invalid configuration', details);
    }

    this._transport = null;
    this._connected = false;
    this._errorHandlers = [];
  }

  /**
   * Connects to the message broker using merged configuration.
   * @param {Object} [options] - Optional overrides for host, queue, etc.
   * @returns {Promise<void>}
   * @throws {ConnectionError} If connecting fails.
   */
  async connect(options = {}) {
    if (this._connected) return;

    // Merge overrides into existing config
    this._config = merge({}, this._config, options);

    try {
      // Instantiate appropriate transport: RabbitMQClient or KafkaClient
      this._transport = transportFactory.create(this._config);

      // Register internal error propagation
      this._transport.on('error', (err) => this._handleError(err));

      await this._transport.connect(this._config);
      this._connected = true;
    } catch (err) {
      throw new ConnectionError('Failed to connect to broker', err);
    }
  }

  /**
   * Disconnects from the message broker.
   * @returns {Promise<void>}
   * @throws {Error} If disconnecting fails unexpectedly.
   */
  async disconnect() {
    if (!this._connected || !this._transport) return;
    try {
      await this._transport.disconnect();
      this._connected = false;
      this._transport = null;
    } catch (err) {
      throw new Error(`Error during disconnect: ${err.message}`);
    }
  }

  /**
   * Publishes a message to the specified queue.
   * @param {string} queue - Target queue name.
   * @param {Object|Buffer|string} message - Payload to send.
   * @param {Object} [options] - RabbitMQ-specific overrides (routingKey, persistent, headers).
   * @returns {Promise<void>}
   * @throws {ConnectionError} If not connected.
   * @throws {PublishError} If publish fails.
   */
  async publish(queue, message, options = {}) {
    if (!this._connected || !this._transport) {
      throw new ConnectionError('Cannot publish: client is not connected');
    }

    let buffer;
    try {
      if (Buffer.isBuffer(message)) {
        buffer = message;
      } else if (typeof message === 'string') {
        buffer = Buffer.from(message, 'utf8');
      } else {
        const json = serializer.serialize(message);
        buffer = Buffer.from(json, 'utf8');
      }
    } catch (err) {
      throw new SerializationError('Failed to serialize message', message, err);
    }

    try {
      await this._transport.publish(queue, buffer, options);
    } catch (err) {
      throw new PublishError(`Failed to publish to queue "${queue}"`, queue, err);
    }
  }

  /**
   * Begins consuming messages from the specified queue.
   * @param {string} queue - Name of the queue to consume from.
   * @param {function(Object): Promise<void>} messageHandler - Async function to process each message.
   * @param {Object} [options] - RabbitMQ-specific overrides (prefetch, noAck).
   * @returns {Promise<void>}
   * @throws {ConnectionError} If not connected.
   * @throws {ConsumeError} If consumer setup fails.
   */
  async consume(queue, messageHandler, options = {}) {
    if (!this._connected || !this._transport) {
      throw new ConnectionError('Cannot consume: client is not connected');
    }

    // Apply prefetch and noAck overrides if provided
    const { prefetch, noAck } = options;
    const consumeOptions = {};
    if (typeof prefetch === 'number') consumeOptions.prefetch = prefetch;
    if (typeof noAck === 'boolean') consumeOptions.noAck = noAck;

    try {
      await this._transport.consume(
        queue,
        async (msg) => {
          try {
            await messageHandler(msg);
            if (consumeOptions.noAck === false) {
              await this.ack(msg);
            }
          } catch (handlerErr) {
            // On handler error, nack with requeue: true
            await this.nack(msg, { requeue: true });
          }
        },
        consumeOptions
      );
    } catch (err) {
      throw new ConsumeError(`Failed to start consumer for queue "${queue}"`, queue, err);
    }
  }

  /**
   * Acknowledges a RabbitMQ message.
   * @param {Object} msg - RabbitMQ message object.
   * @returns {Promise<void>}
   */
  async ack(msg) {
    if (!this._connected || !this._transport) {
      throw new ConnectionError('Cannot ack: client is not connected');
    }
    return this._transport.ack(msg);
  }

  /**
   * Negative-acknowledges a RabbitMQ message.
   * @param {Object} msg - RabbitMQ message object.
   * @param {Object} [options] - Options such as { requeue: boolean }.
   * @returns {Promise<void>}
   */
  async nack(msg, options = {}) {
    if (!this._connected || !this._transport) {
      throw new ConnectionError('Cannot nack: client is not connected');
    }
    return this._transport.nack(msg, options);
  }

  /**
   * Registers a global error handler. Internal or transport-level errors will be forwarded here.
   * @param {function(Error): void} callback
   */
  onError(callback) {
    if (typeof callback === 'function') {
      this._errorHandlers.push(callback);
    }
  }

  /**
   * Internal helper to invoke all registered error handlers.
   * @param {Error} error
   * @private
   */
  _handleError(error) {
    this._errorHandlers.forEach((cb) => {
      try {
        cb(error);
      } catch (_) {
        // Ignore errors in user-provided error handlers
      }
    });
  }
}

module.exports = AgentMQClient;
