````markdown
# @onlineapps/agent-mq-client

[![Build Status](https://img.shields.io/github/actions/workflow/status/onlineapps/agent-mq-client/nodejs.yml?branch=main)](https://github.com/onlineapps/agent-mq-client/actions)  
[![Coverage Status](https://codecov.io/gh/onlineapps/agent-mq-client/branch/main/graph/badge.svg)](https://codecov.io/gh/onlineapps/agent-mq-client)  
[![npm version](https://img.shields.io/npm/v/@onlineapps/agent-mq-client)](https://www.npmjs.com/package/@onlineapps/agent-mq-client)

> A promise-based, broker-agnostic client for sending and receiving messages via RabbitMQ. Designed for microservice agents that need a simple interface to publish and consume messages without dealing with low-level AMQP details.

---

## 🚀 Features

- **Broker-agnostic API**: abstract over RabbitMQ (primary) and easily extendable.
- **Promise-based interface**: `connect()`, `disconnect()`, `publish()`, `consume()`, `ack()`, `nack()` all return `Promise<void>`, simplifying async/await usage.
- **Automatic queue/exchange management**: asserts queues, exchanges, prefetch settings on demand.
- **Built-in serialization**: JSON serialization/deserialization with custom error handling.
- **Global error propagation**: register error handlers via `onError(callback)`.
- **Config validation**: strict schema validation (via Ajv) to catch missing or invalid fields at startup.
- **Extensible transport layer**: clear separation between core logic and transport implementations (`RabbitMQClient`, ...).
- **Stateless operations**: no persistent local state—broker handles retries and redelivery.

---

## 📦 Installation

```bash
npm install @onlineapps/agent-mq-client
# or
yarn add @onlineapps/agent-mq-client
````

> Requires Node.js ≥12. For RabbitMQ usage, ensure an accessible AMQP server.

---

## 🔧 Quick Start

```js
'use strict';

const AgentMQClient = require('@onlineapps/agent-mq-client');

(async () => {
  // 1. Instantiate client with configuration
  const client = new AgentMQClient({
    type: 'rabbitmq',                   // Supported: 'rabbitmq' (fully)
    host: 'amqp://guest:guest@localhost:5672',
    queue: 'job_queue',                 // Default queue name
    exchange: '',                       // Default direct exchange
    durable: true,                      // Declare queue/exchange as durable
    prefetch: 5,                        // Default prefetch count for consumers
    noAck: false,                       // Default auto-acknowledge = false
    retryPolicy: {                      // Optional reconnection policy (not enforced in v1.0.0)
      retries: 5,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      factor: 2
    }
  });

  // 2. Register a global error handler
  client.onError(err => {
    console.error('[AgentMQClient] Error:', err);
  });

  // 3. Connect to RabbitMQ
  try {
    await client.connect();
    console.log('Connected to broker');
  } catch (err) {
    console.error('Connection failed:', err);
    process.exit(1);
  }

  // 4. Publish a sample message
  const samplePayload = { taskId: 'abc123', action: 'processData', timestamp: Date.now() };
  try {
    await client.publish('job_queue', samplePayload, {
      persistent: true,
      headers: { origin: 'quickStart' }
    });
    console.log('Message published:', samplePayload);
  } catch (err) {
    console.error('Publish error:', err);
  }

  // 5. Consume messages
  try {
    await client.consume(
      'job_queue',
      async (msg) => {
        const data = JSON.parse(msg.content.toString('utf8'));
        console.log('Received:', data);
        // Process message...
        await client.ack(msg);
      },
      { prefetch: 5, noAck: false }
    );
    console.log('Consuming from "job_queue"...');
  } catch (err) {
    console.error('Consume error:', err);
  }

  // 6. Graceful shutdown on SIGINT
  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    try {
      await client.disconnect();
      console.log('Disconnected, exiting.');
      process.exit(0);
    } catch (discErr) {
      console.error('Error during disconnect:', discErr);
      process.exit(1);
    }
  });
})();
```

---

## 📄 Configuration

Configuration can be provided to the `AgentMQClient` constructor or as overrides to `connect()`. Below is a summary of supported fields (see `docs/api.md` for full details):

| Field         | Type      | Description                                                                                                                                                        | Default                                                              |
| ------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `type`        | `string`  | Transport type: `'rabbitmq'`                                                                                     | `'rabbitmq'`                                                         |
| `host`        | `string`  | Connection URI or hostname. For RabbitMQ: e.g. `'amqp://user:pass@localhost:5672'`.                                                                                | *Required*                                                           |
| `queue`       | `string`  | Default queue name for publish/consume if not overridden per call.                                                                                                 | `''`                                                                 |
| `exchange`    | `string`  | Default exchange name. Empty string uses the default direct exchange.                                                                                              | `''`                                                                 |
| `durable`     | `boolean` | Declare queues/exchanges as durable.                                                                                                                               | `true`                                                               |
| `prefetch`    | `integer` | Default prefetch count for consumers.                                                                                                                              | `1`                                                                  |
| `noAck`       | `boolean` | Default auto-acknowledge setting for consumers. If `true`, messages will be auto-acked.                                                                            | `false`                                                              |
| `logger`      | `object`  | Custom logger with methods: `info()`, `warn()`, `error()`, `debug()`. If omitted, `console` is used.                                                               | `null`                                                               |
| `retryPolicy` | `object`  | Reconnection policy with properties:<br>‒ `retries` (number)<br>‒ `initialDelayMs` (ms)<br>‒ `maxDelayMs` (ms)<br>‒ `factor` (multiplier). Not enforced in v1.0.0. | `{ retries: 5, initialDelayMs: 1000, maxDelayMs: 30000, factor: 2 }` |

---

## 🛠️ API Reference

For full class and method documentation, including parameter descriptions, return values, and error details, see [docs/api.md](https://github.com/onlineapps/agent-mq-client/blob/main/docs/api.md).

---

## ✅ Testing

```bash
# Install dev dependencies, then run tests
npm test
# or
yarn test
```

* Tests are written in Jest and cover:

  * Core client methods (`connect`, `disconnect`, `publish`, `consume`, `ack`, `nack`).
  * Transport factory behavior.
  * RabbitMQ transport (mocked via Jest/Sinon).
  * Serialization and error handling utilities.

---

## 🎨 Coding Standards

* **Linting**: ESLint (`eslint:recommended` + Prettier).
* **Formatting**: Prettier — check with `npm run prettier:check`, fix with `npm run prettier:fix`.
* **Testing**: Jest, aiming for ≥90% coverage.

---

## 🤝 Contributing

Contributions welcome! Please see [CONTRIBUTING.md](https://github.com/onlineapps/agent-mq-client/blob/main/CONTRIBUTING.md) for guidelines:

1. Fork the repo.
2. Create a feature branch: `git checkout -b feature/your-feature`.
3. Run tests locally and ensure linting passes.
4. Commit your changes and push to your branch.
5. Open a Pull Request against `main`.

---

## 📜 License

This project is licensed under the MIT License. See [LICENSE](https://github.com/onlineapps/agent-mq-client/blob/main/LICENSE) for details.

```
```
