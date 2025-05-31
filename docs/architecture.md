````markdown
<!-- docs/architecture.md -->

# Architecture Overview

- [Introduction](#introduction)
- [Components](#components)
  - [AgentMQClient (Core)](#agentmqclient-core)
  - [Transport Layer](#transport-layer)
    - [TransportFactory](#transportfactory)
    - [RabbitMQClient](#rabbitmqclient)
    - [(KafkaClient – optional)](#kafkaclient-–-optional)
  - [Configuration](#configuration)
    - [defaultConfig.js](#defaultconfigjs)
    - [configSchema.js](#configschemajs)
  - [Utilities](#utilities)
    - [Serializer](#serializer)
    - [ErrorHandler](#errorhandler)
    - [Logger](#logger)
- [Control Flow](#control-flow)
  - [Initialization](#initialization)
  - [Connecting](#connecting)
  - [Publishing](#publishing)
  - [Consuming](#consuming)
  - [Error Handling & Retries](#error-handling--retries)
  - [Disconnect](#disconnect)
- [Extensibility](#extensibility)
  - [New Transport](#new-transport)
  - [Custom Serializer](#custom-serializer)
- [Testing](#testing)
- [Versioning & Releases](#versioning--releases)
- [Glossary](#glossary)

---

## Introduction

A concise overview of `@onlineapps/agent-mq-client`:  
A lightweight client that abstracts message‐queue interactions (RabbitMQ by default). It handles configuration, connection, serialization, error normalization, publishing, consuming, and cleanup. Designed for easy integration into microservices, with minimal dependencies and clear extension points.

---

## Components

### AgentMQClient (Core)

- **Role**  
  - Central orchestrator: merges user config with defaults, sets up logger, serializer, error handler.  
  - Instantiates transport via `TransportFactory`.  
  - Exposes public methods:  
    ```js
    const client = new AgentMQClient(userConfig);
    await client.connect();
    await client.publish(target, payload);
    await client.consume(source, handler);
    await client.disconnect();
    ```
  - Delegates broker‐specific logic to transport adapters.

- **Key Properties**  
  - `this.config` (final merged configuration)  
  - `this.transport` (e.g., a `RabbitMQClient` instance)  
  - `this.logger`, `this.serializer`, `this.errorHandler`

---

### Transport Layer

Handles low-level broker interactions. Swap implementations via `config.type`.

#### TransportFactory

- Reads `config.type`  
- Returns corresponding client (e.g., `RabbitMQClient`) initialized with its `config`, `serializer`, `errorHandler`, `logger`  
- Throws if required transport config is missing

#### RabbitMQClient

- **Purpose**  
  - Connect to RabbitMQ (default), open channel, declare queue/exchange, set `prefetch`.  
  - Publish (with confirmation) and consume (manual ack/nack).  
  - Reconnect with backoff when needed.

- **Methods**  
  - `connect(): Promise<void>`: `amqplib.connect(...)`, `createChannel()`, `assertQueue()`, `prefetch()`, event handlers  
  - `publish(queueOrExchange, buffer, options): Promise<void>`: `channel.publish()` or `channel.sendToQueue()`; handle confirms  
  - `consume(queue, handler, options): Promise<void>`: `channel.consume()`, wrap user handler; call `ack()`/`nack()`  
  - `ack(message)`, `nack(message, requeue = true)`  
  - `disconnect(): Promise<void>`: `channel.close()`, `connection.close()`

- **Error Handling**  
  - Wrap all broker errors via `wrapTransportError(err, context)` (e.g., `'connect'`, `'publish'`, `'consume'`)

#### (KafkaClient – optional)

- Mentioned briefly: similar responsibilities using `kafkajs` (connect, produce, consume, commit offsets).  
- Included by default as a hint for future support; core remains focused on RabbitMQ.

---

### Configuration

Centralized validation and defaults.

#### defaultConfig.js

- Provides sane defaults:
  ```js
  module.exports = {
    type: 'rabbitmq',
    rabbitmq: {
      host: 'amqp://localhost',
      queue: 'default',
      durable: true,
      reconnectRetries: 5,
      reconnectBackoff: 2000,
      prefetch: 10,
    },
    serializer: { encode: JSON.stringify, decode: JSON.parse },
    logger: null, // fallback to console logger
  };
````

* Merges with `userConfig` in `AgentMQClient` constructor.

#### configSchema.js

* Uses a validation library (e.g., Joi) to ensure required fields for the chosen transport are present and correctly typed.
* Example for RabbitMQ:

  ```js
  const Joi = require('joi');
  const rabbitmqSchema = Joi.object({
    type: Joi.string().valid('rabbitmq').required(),
    rabbitmq: Joi.object({
      host: Joi.string().uri().required(),
      queue: Joi.string().required(),
      durable: Joi.boolean().default(true),
      reconnectRetries: Joi.number().integer().min(0).default(5),
      reconnectBackoff: Joi.number().integer().min(0).default(2000),
      prefetch: Joi.number().integer().min(1).default(10),
    }).required(),
    serializer: Joi.object({
      encode: Joi.func().required(),
      decode: Joi.func().required(),
    }).optional(),
    logger: Joi.object({
      info: Joi.func().required(),
      warn: Joi.func().required(),
      error: Joi.func().required(),
      debug: Joi.func().required(),
    }).optional(),
  });
  module.exports = { rabbitmq: rabbitmqSchema };
  ```
* Applied at runtime: invalid config → `ValidationError`.

---

### Utilities

#### Serializer (`serializer.js`)

* Default: JSON ↔ `Buffer`

  ```js
  module.exports = {
    encode: (payload) => Buffer.from(JSON.stringify(payload)),
    decode: (buffer) => JSON.parse(buffer.toString('utf8')),
  };
  ```
* Users can override (`Avro`, `Protobuf`, etc.). Errors become `ValidationError`.

#### ErrorHandler (`errorHandler.js`)

* Defines standardized error classes: `ConnectionError`, `PublishError`, `ConsumeError`, `ValidationError`.
* `wrapTransportError(err, context)` maps native errors to these classes.
* Transports throw wrapped errors; `AgentMQClient` propagates or calls `onError`.

#### Logger (`logger.js`)

* Default: wrappers around `console.log`, `console.warn`, `console.error`, `console.debug` (conditional on `DEBUG`).
* If `config.logger` is provided, use that instead.

---

## Control Flow

### Initialization

1. **Construct `AgentMQClient(userConfig)`**
2. **Validate** with `configSchema` → merge with `defaultConfig`.
3. **Instantiate** `logger`, `serializer`, `errorHandler`.
4. \*\*TransportFactory.create(config, serializer, wrapError, logger)`→`RabbitMQClient\` (or future transport).
5. **Store** references (`this.config`, `this.transport`, etc.).

### Connecting

```js
await client.connect();
```

* Checks `connected`; if false, calls `transport.connect()`.
* **RabbitMQClient.connect()**: `amqplib.connect`, `createChannel`, `assertQueue`, `prefetch`, set up event listeners.
* Wrapped errors via `wrapTransportError(err, 'connect')`.
* On success, `client.connected = true`.

### Publishing

```js
await client.publish(destination, payload, options);
```

1. Ensure `connected`.
2. `const data = serializer.encode(payload)` → may throw `ValidationError`.
3. `await transport.publish(destination, data, options)`:

   * **RabbitMQClient.publish()**: `channel.publish()` or `sendToQueue()`; wait for confirmation.
   * Errors wrapped as `PublishError`.
4. Returns `Promise<void>` or rejects with `PublishError`.

### Consuming

```js
await client.consume(source, messageHandler, options);
```

1. Ensure `connected`.
2. Delegate to `transport.consume(source, internalHandler, options)`.
3. **internalHandler(rawMsg)**:

   * Decode: `const obj = serializer.decode(rawMsg.content)`.
   * Call user’s `messageHandler(obj, rawMsg)`.
   * On success: `transport.ack(rawMsg)` (RabbitMQ).
   * On user‐error: `transport.nack(rawMsg, requeue)` or wrap via `ConsumeError`.
4. `client.consume()` resolves once subscription is active; messages processed asynchronously.

### Error Handling & Retries

* **Connection Errors**:

  * Retry up to `reconnectRetries`, with `reconnectBackoff` delay.
  * On exhaust → throw `ConnectionError`.
* **Publish Errors**:

  * Optionally retry based on `publishRetries`/`publishBackoff`.
  * On final failure → `PublishError`.
* **Consume Errors**:

  * **RabbitMQ**: on handler error → `nack()`, optionally requeue or send to DLQ.
  * **Kafka** (if used): uncommitted offset → redelivery if auto‐commit disabled.

### Disconnect

```js
await client.disconnect();
```

* If not connected, return.
* Set `closing = true`.
* Call `transport.disconnect()`.

  * **RabbitMQClient.disconnect()**: `channel.close()`, `connection.close()`.
* On success: `connected = false`.

---

## Extensibility

### New Transport

To add another broker (e.g., AWS SQS):

1. **Create** `src/transports/sqsClient.js` implementing:

   * `connect()`, `disconnect()`, `publish()`, `consume()`
   * Use `serializer`, `wrapError`, `logger` in constructor.
2. **Update** `transportFactory.js`:

   ```js
   case 'sqs':
     return new SQSClient(config.sqs, serializer, wrapError, logger);
   ```
3. **Extend** `defaultConfig.js` and `configSchema.js` with `sqs` section.
4. **Write** unit tests (`tests/transports/sqsClient.test.js`) mocking AWS SDK.

### Custom Serializer

* Pass in `config.serializer.encode` / `config.serializer.decode` (e.g., Avro).
* Internally:

  * `publish()`: calls custom `encode` → returns `Buffer`
  * `consume()`: calls custom `decode` on `Buffer`
* If custom serializer throws, wrapped as `ValidationError`.

---

## Testing

* **Unit Tests (Jest or Mocha/Chai)**

  * `client.test.js`: mock `TransportFactory`, verify method calls, config validation, error propagation.
  * `transportFactory.test.js`: correct transport instantiation.
  * `rabbitmqClient.test.js`: mock `amqplib`, test connect/publish/consume/error wrapping.
  * `serializer.test.js`, `errorHandler.test.js`, `logger` tests.

* **Integration Tests (Optional, Docker/CI)**

  * RabbitMQ: spin up local broker, publish/consume real messages, test ack/nack, prefetch, reconnection.
  * Kafka (if used): similar flow with test cluster or testcontainers.

---

## Versioning & Releases

* **Semantic Versioning**: MAJOR.MINOR.PATCH.
* **Release Steps**:

  1. Bump `package.json` version.
  2. Update `CHANGELOG.md` under new version heading.
  3. Commit and tag (e.g., `v1.2.0`).
  4. `npm publish --access public`.
  5. GitHub release with changelog notes.

---

## Glossary

* **Broker**: Message broker (e.g., RabbitMQ).
* **Queue**: Broker buffer for messages (RabbitMQ).
* **Prefetch**: Max un‐acked messages for consumer (RabbitMQ).
* **Serializer**: Converts between JS objects and binary payloads.
* **ErrorHandler**: Normalizes transport errors into custom classes.
* **DLQ**: Dead‐Letter Queue for unprocessable messages.

```
```
