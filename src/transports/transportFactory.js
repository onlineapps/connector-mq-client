'use strict';

/**
 * transportFactory: selects and instantiates the appropriate transport
 * based on configuration. Currently supports RabbitMQ; Kafka support
 * can be added later by extending this factory.
 */

const RabbitMQClient = require('./rabbitmqClient');
// const KafkaClient = require('./kafkaClient'); // Uncomment once Kafka implementation is available

/**
 * Factory method: returns a transport instance based on config.type.
 * @param {Object} config
 * @param {'rabbitmq'} config.type - Transport type ('rabbitmq' for now)
 * @returns {Object} Instance of transport (RabbitMQClient, KafkaClient, etc.)
 * @throws {Error} If the configured type is unsupported or missing
 */
function create(config) {
  if (!config || !config.type) {
    throw new Error('Transport type is required in configuration');
  }

  switch (config.type.toLowerCase()) {
    case 'rabbitmq':
      return new RabbitMQClient(config);

    // case 'kafka':
    //   return new KafkaClient(config);

    default:
      throw new Error(`Unsupported transport type: ${config.type}`);
  }
}

module.exports = {
  create,
};
