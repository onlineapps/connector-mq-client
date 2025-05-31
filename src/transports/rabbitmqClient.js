'use strict';

/**
 * RabbitMQClient: transport implementation for RabbitMQ using amqplib.
 * Implements connect, disconnect, publish, consume, ack, nack, and error propagation.
 */

const amqp = require('amqplib');
const EventEmitter = require('events');

class RabbitMQClient extends EventEmitter {
  /**
   * @param {Object} config
   * @param {string} config.host         - AMQP URI or hostname (e.g., 'amqp://localhost:5672')
   * @param {string} [config.queue]      - Default queue name (optional; can be overridden per call)
   * @param {string} [config.exchange]   - Default exchange (default: '')
   * @param {boolean} [config.durable]   - Declare queues/exchanges as durable (default: true)
   * @param {number} [config.prefetch]   - Default prefetch count for consumers (default: 1)
   * @param {boolean} [config.noAck]     - Default auto-acknowledge setting (default: false)
   * @param {Object} [config.retryPolicy] - { retries, initialDelayMs, maxDelayMs, factor } (not implemented here)
   */
  constructor(config) {
    super();
    this._config = Object.assign(
      {
        exchange: '',
        durable: true,
        prefetch: 1,
        noAck: false,
      },
      config
    );

    this._connection = null;
    this._channel = null;
  }

  /**
   * Connects to RabbitMQ server and creates a confirm channel.
   * @returns {Promise<void>}
   * @throws {Error} If connection or channel creation fails.
   */
  async connect() {
    try {
      this._connection = await amqp.connect(this._config.host);
      this._connection.on('error', (err) => this.emit('error', err));
      this._connection.on('close', () => {
        // Emit a connection close error to notify listeners
        this.emit('error', new Error('RabbitMQ connection closed unexpectedly'));
      });

      // Use ConfirmChannel to enable publisher confirms
      this._channel = await this._connection.createConfirmChannel();
      this._channel.on('error', (err) => this.emit('error', err));
      this._channel.on('close', () => {
        // Emit a channel close error
        this.emit('error', new Error('RabbitMQ channel closed unexpectedly'));
      });
    } catch (err) {
      // Cleanup partially created resources
      if (this._connection) {
        try {
          await this._connection.close();
        } catch (_) {
          /* ignore */
        }
        this._connection = null;
      }
      throw err;
    }
  }

  /**
   * Disconnects: closes channel and connection.
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (this._channel) {
        await this._channel.close();
        this._channel = null;
      }
    } catch (err) {
      this.emit('error', err);
    }
    try {
      if (this._connection) {
        await this._connection.close();
        this._connection = null;
      }
    } catch (err) {
      this.emit('error', err);
    }
  }

  /**
   * Publishes a message buffer to the specified queue (or default queue) or exchange.
   * @param {string} queue           - Target queue name.
   * @param {Buffer} buffer          - Message payload as Buffer.
   * @param {Object} [options]       - Overrides: routingKey, persistent, headers.
   * @returns {Promise<void>}
   * @throws {Error} If publish fails or channel is not available.
   */
  async publish(queue, buffer, options = {}) {
    if (!this._channel) {
      throw new Error('Cannot publish: channel is not initialized');
    }

    const exchange = this._config.exchange || '';
    const routingKey = options.routingKey || queue;
    const persistent = options.persistent !== undefined ? options.persistent : this._config.durable;
    const headers = options.headers || {};

    try {
      // Ensure queue exists if publishing directly to queue and using default exchange
      if (!exchange) {
        await this._channel.assertQueue(queue, { durable: this._config.durable });
        this._channel.sendToQueue(queue, buffer, { persistent, headers, routingKey });
      } else {
        // If exchange is specified, assert exchange and publish to it
        await this._channel.assertExchange(exchange, 'direct', { durable: this._config.durable });
        this._channel.publish(exchange, routingKey, buffer, { persistent, headers });
      }
      // Wait for confirmation
      await this._channel.waitForConfirms();
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Starts consuming messages from the specified queue.
   * @param {string} queue                         - Queue name to consume from.
   * @param {function(Object): Promise<void>} onMessage - Async handler receiving raw msg.
   * @param {Object} [options]                     - Overrides: prefetch, noAck.
   * @returns {Promise<void>}
   * @throws {Error} If consume setup fails or channel is not available.
   */
  async consume(queue, onMessage, options = {}) {
    if (!this._channel) {
      throw new Error('Cannot consume: channel is not initialized');
    }

    const durable = this._config.durable;
    const prefetch = options.prefetch !== undefined ? options.prefetch : this._config.prefetch;
    const noAck = options.noAck !== undefined ? options.noAck : this._config.noAck;

    try {
      // Ensure queue exists
      await this._channel.assertQueue(queue, { durable });
      // Set prefetch if provided
      if (typeof prefetch === 'number') {
        this._channel.prefetch(prefetch);
      }

      await this._channel.consume(
        queue,
        async (msg) => {
          if (msg === null) {
            return;
          }
          try {
            await onMessage(msg);
            if (!noAck) {
              this._channel.ack(msg);
            }
          } catch (handlerErr) {
            // Negative acknowledge and requeue by default
            this._channel.nack(msg, false, true);
          }
        },
        { noAck }
      );
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Acknowledges a message.
   * @param {Object} msg - RabbitMQ message object.
   */
  async ack(msg) {
    if (!this._channel) {
      throw new Error('Cannot ack: channel is not initialized');
    }
    try {
      this._channel.ack(msg);
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Negative-acknowledges a message.
   * @param {Object} msg - RabbitMQ message object.
   * @param {Object} [options] - { requeue: boolean }.
   */
  async nack(msg, options = {}) {
    if (!this._channel) {
      throw new Error('Cannot nack: channel is not initialized');
    }
    const requeue = options.requeue !== undefined ? options.requeue : true;
    try {
      this._channel.nack(msg, false, requeue);
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }
}

module.exports = RabbitMQClient;
