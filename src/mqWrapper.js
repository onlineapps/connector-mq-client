'use strict';

const EventEmitter = require('events');
const AgentMQClient = require('./client');

/**
 * MQ Wrapper - Extension of connector-mq-client for workflow support
 * Adds workflow-specific functionality on top of base MQ client
 */
class MQWrapper extends AgentMQClient {
  constructor(config = {}) {
    super(config);
    this.serviceName = config.serviceName || 'unknown';
    this.workflowDefaults = {
      ttl: config.defaultTTL || 30000,
      dlxExchange: config.dlxExchange || 'dlx',
      autoDelete: config.autoDelete || 300000, // 5 minutes
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 2000
    };
  }

  /**
   * Create or ensure queue exists with workflow-specific defaults
   * @param {string} queueName - Name of the queue
   * @param {Object} options - Queue options
   * @returns {Promise} Queue assertion result
   */
  async ensureQueue(queueName, options = {}) {
    const queueOptions = {
      durable: options.durable !== false,
      arguments: {
        ...options.arguments
      }
    };

    // Add TTL if specified
    if (options.ttl !== null) {
      queueOptions.arguments['x-message-ttl'] = options.ttl || this.workflowDefaults.ttl;
    }

    // Add DLQ configuration
    if (options.dlq !== false) {
      queueOptions.arguments['x-dead-letter-exchange'] = this.workflowDefaults.dlxExchange;
      queueOptions.arguments['x-dead-letter-routing-key'] = options.dlqKey || `${queueName}.dlq`;
    }

    // Add auto-delete expiry
    if (options.expires !== null) {
      queueOptions.arguments['x-expires'] = options.expires || this.workflowDefaults.autoDelete;
    }

    // Add max retries
    if (options.maxRetries) {
      queueOptions.arguments['x-max-retries'] = options.maxRetries;
    }

    // Use parent class assertQueue method
    return this.channel.assertQueue(queueName, queueOptions);
  }

  /**
   * Setup service queues (main queue + DLQ)
   * @param {string} serviceName - Name of the service
   * @returns {Promise} Setup result
   */
  async setupServiceQueues(serviceName = null) {
    const service = serviceName || this.serviceName;
    
    // Create main processing queue
    await this.ensureQueue(`${service}.queue`, {
      ttl: this.workflowDefaults.ttl,
      dlq: true,
      expires: this.workflowDefaults.autoDelete
    });

    // Create dead letter queue (no TTL, no expiry)
    await this.ensureQueue(`${service}.dlq`, {
      ttl: null,
      dlq: false,
      expires: null
    });

    // Create DLQ exchange if it doesn't exist
    await this.channel.assertExchange(this.workflowDefaults.dlxExchange, 'direct', {
      durable: true
    });

    // Bind DLQ to exchange
    await this.channel.bindQueue(
      `${service}.dlq`,
      this.workflowDefaults.dlxExchange,
      `${service}.queue.dlq`
    );

    return { main: `${service}.queue`, dlq: `${service}.dlq` };
  }

  /**
   * Publish workflow step to next service
   * @param {string} service - Target service name
   * @param {Object} message - Workflow message
   * @returns {Promise} Publish result
   */
  async publishWorkflowStep(service, message) {
    const queueName = `${service}.queue`;
    
    // Ensure queue exists with appropriate TTL
    const ttl = message.current_step === 0 ? 10000 : this.workflowDefaults.ttl;
    await this.ensureQueue(queueName, { ttl, dlq: true });

    // Prepare message buffer
    const messageBuffer = Buffer.from(JSON.stringify(message));

    // Publish with mandatory flag and persistence
    const published = await this.channel.publish(
      '', // Default exchange
      queueName,
      messageBuffer,
      {
        mandatory: true,
        persistent: true,
        headers: {
          'x-workflow-id': message.workflow_id,
          'x-current-step': message.current_step,
          'x-service': service
        }
      }
    );

    // Emit monitoring event
    this.emit('workflow.step.sent', {
      workflow_id: message.workflow_id,
      service: service,
      step: message.current_step,
      timestamp: new Date().toISOString()
    });

    return published;
  }

  /**
   * Setup handler for unroutable messages
   * @param {Function} handler - Optional custom handler
   */
  setupUnroutableHandler(handler = null) {
    this.channel.on('return', async (msg) => {
      const routingKey = msg.fields.routingKey;
      const messageContent = msg.content.toString();
      
      console.error('[MQWrapper] Unroutable message detected', {
        routingKey,
        exchange: msg.fields.exchange,
        replyText: msg.fields.replyText
      });

      if (handler) {
        // Use custom handler
        await handler(msg);
      } else {
        // Default: send to unroutable DLQ
        await this.ensureQueue('unroutable.dlq', {
          ttl: null,
          dlq: false,
          expires: null
        });
        
        await this.channel.sendToQueue('unroutable.dlq', msg.content, {
          persistent: true,
          headers: {
            'x-original-routing-key': routingKey,
            'x-timestamp': new Date().toISOString(),
            'x-reason': msg.fields.replyText
          }
        });
      }

      // Emit event
      this.emit('message.unroutable', {
        routingKey,
        content: messageContent
      });
    });
  }

  /**
   * Retry message with exponential backoff
   * @param {string} queue - Queue name
   * @param {Object|Buffer} message - Message to retry
   * @param {number} attempt - Current attempt number
   * @returns {Promise<boolean>} Success status
   */
  async retryWithBackoff(queue, message, attempt = 1) {
    const maxAttempts = this.workflowDefaults.retryAttempts;
    
    if (attempt > maxAttempts) {
      // Max retries exceeded, send to DLQ
      const dlqName = `${queue}.dlq`;
      await this.ensureQueue(dlqName, { ttl: null, dlq: false });
      
      const messageBuffer = Buffer.isBuffer(message) 
        ? message 
        : Buffer.from(JSON.stringify(message));
      
      await this.channel.sendToQueue(dlqName, messageBuffer, {
        persistent: true,
        headers: {
          'x-retry-count': attempt - 1,
          'x-failed-queue': queue,
          'x-timestamp': new Date().toISOString()
        }
      });

      this.emit('message.failed', {
        queue,
        attempt: attempt - 1,
        message: message.toString ? message.toString() : message
      });

      return false;
    }

    // Calculate delay with exponential backoff
    const delay = Math.pow(2, attempt - 1) * this.workflowDefaults.retryDelay;
    
    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      const messageBuffer = Buffer.isBuffer(message) 
        ? message 
        : Buffer.from(JSON.stringify(message));
      
      await this.channel.sendToQueue(queue, messageBuffer, {
        persistent: true,
        headers: {
          'x-retry-attempt': attempt,
          'x-retry-delay': delay
        }
      });

      this.emit('message.retried', {
        queue,
        attempt,
        delay
      });

      return true;
    } catch (error) {
      console.error(`[MQWrapper] Retry ${attempt} failed for queue ${queue}:`, error.message);
      // Recursive retry
      return this.retryWithBackoff(queue, message, attempt + 1);
    }
  }

  /**
   * Subscribe to workflow messages with automatic parsing
   * @param {string} queue - Queue name
   * @param {Function} handler - Message handler
   * @param {Object} options - Subscription options
   * @returns {Promise} Subscription result
   */
  async subscribeWorkflow(queue, handler, options = {}) {
    return this.subscribe(queue, async (msg) => {
      try {
        // Parse workflow message
        const content = msg.content.toString();
        const workflowMessage = JSON.parse(content);
        
        // Add message metadata
        workflowMessage._meta = {
          deliveryTag: msg.fields.deliveryTag,
          redelivered: msg.fields.redelivered,
          exchange: msg.fields.exchange,
          routingKey: msg.fields.routingKey
        };

        // Call handler with parsed message
        await handler(workflowMessage, msg);
        
        // Auto-acknowledge if not disabled
        if (options.autoAck !== false) {
          await this.channel.ack(msg);
        }
      } catch (error) {
        console.error('[MQWrapper] Error processing workflow message:', error);
        
        // Handle error based on options
        if (options.requeueOnError) {
          // Requeue the message
          await this.channel.nack(msg, false, true);
        } else if (options.retryOnError) {
          // Retry with backoff
          await this.retryWithBackoff(queue, msg.content);
          await this.channel.ack(msg);
        } else {
          // Send to DLQ
          await this.channel.nack(msg, false, false);
        }
        
        // Emit error event
        this.emit('workflow.error', {
          queue,
          error: error.message,
          message: msg.content.toString()
        });
      }
    }, options);
  }

  /**
   * Create workflow message structure
   * @param {Object} cookbook - Cookbook definition
   * @param {Object} input - Input data
   * @param {Object} user - User context
   * @returns {Object} Workflow message
   */
  createWorkflowMessage(cookbook, input = {}, user = {}) {
    return {
      workflow_id: this.generateWorkflowId(),
      cookbook: cookbook,
      current_step: 0,
      context: {
        user: user,
        input: input,
        results: {}
      },
      trace: [{
        step: 'init',
        service: this.serviceName,
        timestamp: new Date().toISOString()
      }],
      timeout: this.calculateTimeout(cookbook),
      retry_count: 0,
      error: null
    };
  }

  /**
   * Generate unique workflow ID
   * @returns {string} Workflow ID
   */
  generateWorkflowId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    const service = this.serviceName.substr(0, 3).toLowerCase();
    return `wf_${service}_${timestamp}_${random}`;
  }

  /**
   * Calculate workflow timeout
   * @param {Object} cookbook - Cookbook definition
   * @returns {string} ISO timestamp
   */
  calculateTimeout(cookbook) {
    const baseTimeout = cookbook.timeout || 300000; // 5 minutes default
    const stepCount = cookbook.steps ? cookbook.steps.length : 1;
    const totalTimeout = baseTimeout * stepCount;
    return new Date(Date.now() + totalTimeout).toISOString();
  }

  /**
   * Setup dead letter consumer for a service
   * @param {string} serviceName - Service name
   * @param {Function} handler - DLQ message handler
   * @returns {Promise} Consumer tag
   */
  async consumeDeadLetters(serviceName, handler) {
    const dlqName = `${serviceName || this.serviceName}.dlq`;
    
    return this.subscribe(dlqName, async (msg) => {
      const content = msg.content.toString();
      let parsedContent;
      
      try {
        parsedContent = JSON.parse(content);
      } catch (e) {
        parsedContent = content;
      }

      const deadLetter = {
        content: parsedContent,
        headers: msg.properties.headers,
        originalQueue: msg.properties.headers['x-failed-queue'],
        retryCount: msg.properties.headers['x-retry-count'] || 0,
        timestamp: msg.properties.headers['x-timestamp'],
        reason: msg.properties.headers['x-death'] 
          ? msg.properties.headers['x-death'][0].reason 
          : 'unknown'
      };

      await handler(deadLetter);
      await this.channel.ack(msg);
    });
  }
}

module.exports = MQWrapper;