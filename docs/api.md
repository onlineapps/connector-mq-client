````markdown
# API Reference

* [Introduction](#introduction)
* [Installation](#installation)
* [Configuration](#configuration)
* [Client Class](#client-class)
  * [Constructor](#constructor)
  * [connect(options)](#connectoptions)
  * [disconnect()](#disconnect)
  * [publish(queue, message, [options])](#publishqueue-message-options)
  * [consume(queue, handler, [options])](#consumequeue-handler-options)
  * [ack(msg)](#ackmsg)
  * [nack(msg, [options])](#nackmsg-options)
  * [onError(callback)](#onerrorcallback)
* [Error Handling](#error-handling)
* [Example (RabbitMQ)](#example-rabbitmq)
* [License](#license)

---

## Introduction

`@onlineapps/agent-mq-client` exposes a promise-based interface for publishing and consuming messages via RabbitMQ (with placeholder for Kafka). It offloads queue/exchange setup, serialization, and error propagation so your code remains broker-agnostic.

---

## Installation

```bash
npm install @onlineapps/agent-mq-client
````

Requires Node.js ≥12. Ensure an accessible RabbitMQ server when using `type: 'rabbitmq'`. Kafka fields are accepted but not fully supported in v1.

---

## Configuration

Pass a plain object to the constructor (or to `connect()` for overrides). Invalid or missing required fields trigger a `ValidationError`.

| Field         | Type      | Description                                                                                     | Default               |
| ------------- | --------- | ----------------------------------------------------------------------------------------------- | --------------------- |
| `type`        | `string`  | Transport type: `'rabbitmq'` (fully supported) or `'kafka'` (limited).                          | *required*            |
| `host`        | `string`  | Connection URI/hostname (e.g., `amqp://user:pass@localhost:5672`).                              | *required*            |
| `queue`       | `string`  | Default queue name for publish/consume if not overridden per call.                              | `''`                  |
| `exchange`    | `string`  | Default exchange name; `''` uses the default direct exchange.                                   | `''`                  |
| `durable`     | `boolean` | Declare queues/exchanges as durable.                                                            | `true`                |
| `prefetch`    | `integer` | Default prefetch count for consumers.                                                           | `1`                   |
| `noAck`       | `boolean` | Default auto-acknowledge setting for consumers.                                                 | `false`               |
| `logger`      | `object`  | Custom logger with methods `info()`, `warn()`, `error()`, `debug()`. Falls back to `console.*`. | `null`                |
| `retryPolicy` | `object`  | `{ retries, initialDelayMs, maxDelayMs, factor }`. Not enforced in v1.0.0.                      | `{5, 1000, 30000, 2}` |

> **Note:** Kafka-specific fields (`brokers`, `groupId`, `topic`) are validated but functionality remains minimal until full Kafka support is added.

---

## Client Class

Import and use in CommonJS:

```js
const AgentMQClient = require('@onlineapps/agent-mq-client');
```

All methods return `Promise<void>` unless noted otherwise. Internal transport errors propagate via `onError()`.

### Constructor

```js
/**
 * @param {Object} config
 * @throws {ValidationError} If required fields are missing/invalid.
 */
new AgentMQClient(config)
```

* Merges `config` with defaults.
* Validates against `src/config/configSchema.js`.
* Does **not** establish any connection; call `connect()` to start.

### connect(options)

```js
/**
 * @param {Object} [options]  Overrides for host, queue, etc.
 * @returns {Promise<void>}
 * @throws {ConnectionError} If connection fails.
 */
async connect(options)
```

1. Merge `options` into existing config.
2. Instantiate transport via `transportFactory.create(config)`.
3. Attach transport-level error events to `onError`.
4. Call `transport.connect(config)` (opens connection and channel).

### disconnect()

```js
/**
 * @returns {Promise<void>}
 * @throws {Error} If shutting down fails unexpectedly.
 */
async disconnect()
```

* Calls `transport.disconnect()`.
* Closes channel and connection.
* After resolving, the client must call `connect()` again to reuse.

### publish(queue, message, \[options])

```js
/**
 * @param {string} queue
 * @param {Object|Buffer|string} message
 * @param {Object} [options]  { routingKey?: string, persistent?: boolean, headers?: Object }
 * @returns {Promise<void>}
 * @throws {ConnectionError} If not connected.
 * @throws {SerializationError} If message serialization fails.
 * @throws {PublishError} If transport.publish fails.
 */
async publish(queue, message, options)
```

1. Throws `ConnectionError` if not connected.
2. Serialize `message`:

   * `Buffer` → use as-is.
   * `string` → `Buffer.from(string)`.
   * Other → `JSON.stringify(...)`; failure → `SerializationError`.
3. Delegate to `transport.publish(queue, buffer, options)`. On failure, wrap into `PublishError`.

### consume(queue, handler, \[options])

```js
/**
 * @param {string} queue
 * @param {function(Object): Promise<void>} handler  Receives raw `msg` object { content: Buffer, fields, properties }.
 * @param {Object} [options]  { prefetch?: number, noAck?: boolean }
 * @returns {Promise<void>}
 * @throws {ConnectionError} If not connected.
 * @throws {ConsumeError} If transport.consume setup fails.
 */
async consume(queue, handler, options)
```

1. Throws `ConnectionError` if not connected.
2. Build `consumeOptions` from `options` or defaults (`prefetch`, `noAck`).
3. Call `transport.consume(queue, internalCallback, consumeOptions)`.
4. `internalCallback(msg)`:

   * `await handler(msg)`.
   * If `noAck === false`: `client.ack(msg)`.
   * On handler throw: `client.nack(msg, { requeue: true })`.
5. Transport-level failures invoke `ConsumeError`.

### ack(msg)

```js
/**
 * @param {Object} msg  RabbitMQ message.
 * @returns {Promise<void>}
 * @throws {ConnectionError} If not connected.
 */
async ack(msg)
```

Delegates to `transport.ack(msg)`. Throws if channel is not initialized.

### nack(msg, \[options])

```js
/**
 * @param {Object} msg
 * @param {Object} [options]  { requeue?: boolean } (default `true`)
 * @returns {Promise<void>}
 * @throws {ConnectionError} If not connected.
 */
async nack(msg, options)
```

Delegates to `transport.nack(msg, options)`.

### onError(callback)

```js
/**
 * @param {function(Error): void} callback
 */
onError(callback)
```

* Registers a global error handler.
* Invoked for any transport-level or internal error.

---

## Error Handling

All custom errors extend `Error` and add contextual fields:

* **ValidationError**
  Thrown when config validation fails.

  * `message`: human‐readable description.
  * `details`: array of `{ path, message }` from schema validator.

* **ConnectionError**
  Thrown if client cannot connect.

  * `message`: description.
  * `cause`: original error.

* **PublishError**
  Thrown if publishing fails.

  * `message`: description.
  * `queue`: target queue name.
  * `cause`: underlying error.

* **ConsumeError**
  Thrown if consumer setup fails.

  * `message`: description.
  * `queue`: queue name.
  * `cause`: underlying error.

* **SerializationError**
  Thrown if JSON serialization/deserialization fails.

  * `message`: description.
  * `payload`: original object or buffer.
  * `cause`: native exception.

---

## Example (RabbitMQ)

```js
'use strict';

const AgentMQClient = require('@onlineapps/agent-mq-client');

(async () => {
  const client = new AgentMQClient({
    type: 'rabbitmq',
    host: 'amqp://guest:guest@localhost:5672',
    queue: 'jobs',
  });

  client.onError(err => console.error('MQ Error:', err));

  try {
    await client.connect();
    console.log('Connected');
  } catch (err) {
    console.error('Connect failed:', err);
    process.exit(1);
  }

  // Publish
  try {
    await client.publish('jobs', { jobId: 'xyz', payload: { foo: 'bar' } });
    console.log('Published job');
  } catch (err) {
    console.error('Publish error:', err);
  }

  // Consume
  try {
    await client.consume(
      'jobs',
      async msg => {
        const data = JSON.parse(msg.content.toString());
        console.log('Received job:', data);
        await client.ack(msg);
      },
      { prefetch: 3, noAck: false }
    );
    console.log('Consuming from "jobs"...');
  } catch (err) {
    console.error('Consume error:', err);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await client.disconnect();
    process.exit(0);
  });
})();
```

---

## License

Licensed under MIT. See [LICENSE](../LICENSE) for details.
