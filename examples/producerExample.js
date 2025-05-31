// producerExample.js

'use strict';

/**
 * Example: How to publish messages using @onlineapps/agent-mq-client
 */

const AgentMQClient = require('@onlineapps/agent-mq-client');

(async () => {
  // 1. Construct client with configuration
  const client = new AgentMQClient({
    type: 'rabbitmq',
    host: 'amqp://guest:guest@localhost:5672',
    queue: 'tasks',       // default queue name
    exchange: '',         // use default direct exchange
    durable: true,        // make queue durable
    prefetch: 1,          // not relevant for producer
    noAck: false,         // not relevant for producer
    retryPolicy: {
      retries: 5,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      factor: 2
    }
  });

  // 2. Register global error handler
  client.onError(err => {
    console.error('[Producer] MQ Error:', err);
  });

  // 3. Connect to RabbitMQ
  try {
    await client.connect();
    console.log('[Producer] Connected to RabbitMQ');
  } catch (err) {
    console.error('[Producer] Connection failed:', err);
    process.exit(1);
  }

  // 4. Prepare a sample payload
  const payload = {
    taskId: 'task-123',
    createdAt: new Date().toISOString(),
    data: {
      userId: 42,
      action: 'processOrder',
      details: {
        orderId: 1001,
        items: [
          { productId: 'A1', quantity: 2 },
          { productId: 'B2', quantity: 1 }
        ]
      }
    }
  };

  // 5. Publish the message
  try {
    await client.publish('tasks', payload, {
      persistent: true,
      headers: { source: 'producerExample' }
    });
    console.log('[Producer] Message published to queue "tasks":', payload);
  } catch (err) {
    console.error('[Producer] Publish failed:', err);
  }

  // 6. Optional: Disconnect after a short delay or on signal
  function shutdown() {
    client.disconnect()
      .then(() => {
        console.log('[Producer] Disconnected, exiting.');
        process.exit(0);
      })
      .catch(disconnectErr => {
        console.error('[Producer] Error during disconnect:', disconnectErr);
        process.exit(1);
      });
  }

  // For demo purposes, disconnect after 2 seconds
  setTimeout(shutdown, 2000);

  // Or handle Ctrl+C
  process.on('SIGINT', shutdown);
})();
