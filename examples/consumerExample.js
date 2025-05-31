// consumerExample.js

'use strict';

/**
 * Example: How to consume messages using @onlineapps/agent-mq-client
 */

const AgentMQClient = require('@onlineapps/agent-mq-client');

(async () => {
  // 1. Construct client with configuration
  const client = new AgentMQClient({
    type: 'rabbitmq',
    host: 'amqp://guest:guest@localhost:5672',
    queue: 'tasks',       // the same queue name we publish to
    exchange: '',
    durable: true,
    prefetch: 5,          // allow up to 5 unacknowledged messages
    noAck: false,         // require manual ack
    retryPolicy: {
      retries: 5,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      factor: 2
    }
  });

  // 2. Register global error handler
  client.onError(err => {
    console.error('[Consumer] MQ Error:', err);
  });

  // 3. Connect to RabbitMQ
  try {
    await client.connect();
    console.log('[Consumer] Connected to RabbitMQ');
  } catch (err) {
    console.error('[Consumer] Connection failed:', err);
    process.exit(1);
  }

  // 4. Start consuming messages
  try {
    await client.consume(
      'tasks',
      async (msg) => {
        // msg.content is a Buffer
        let payload;
        try {
          payload = JSON.parse(msg.content.toString('utf8'));
        } catch (parseErr) {
          console.error('[Consumer] Failed to parse message:', parseErr);
          // Nack and requeue if payload is malformed
          await client.nack(msg, { requeue: false });
          return;
        }

        console.log('[Consumer] Received payload:', payload);

        // Process the payload (simulate async work)
        try {
          // Example: simulate processing delay
          await new Promise(resolve => setTimeout(resolve, 500));

          console.log(`[Consumer] Processing task ${payload.taskId} completed.`);
          // Acknowledge only after processing succeeds
          await client.ack(msg);
        } catch (processingErr) {
          console.error('[Consumer] Error processing task:', processingErr);
          // If processing fails, nack and requeue the message
          await client.nack(msg, { requeue: true });
        }
      },
      {
        prefetch: 5,
        noAck: false
      }
    );

    console.log('[Consumer] Waiting for messages on queue "tasks"...');
  } catch (err) {
    console.error('[Consumer] Consume setup failed:', err);
    process.exit(1);
  }

  // 5. Graceful shutdown on SIGINT
  process.on('SIGINT', async () => {
    console.log('[Consumer] Shutdown initiated...');
    try {
      await client.disconnect();
      console.log('[Consumer] Disconnected, exiting.');
      process.exit(0);
    } catch (disconnectErr) {
      console.error('[Consumer] Error during disconnect:', disconnectErr);
      process.exit(1);
    }
  });
})();
