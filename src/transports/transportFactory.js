'use strict';

/**
 * transportFactory: selects and instantiates the appropriate transport
 * based on configuration. Currently supports RabbitMQ; 
 */

const RabbitMQClient = require('./rabbitmqClient');

/**
 * Factory method: returns a transport instance based on config.type.
 * @param {Object} config
 * @param {'rabbitmq'} config.type - Transport type ('rabbitmq' for now)
 * @returns {Object} Instance of transport (RabbitMQClient, etc.)
 * @throws {Error} If the configured type is unsupported or missing
 */
function create(config) {
  if (!config || !config.type) {
    throw new Error('Transport type is required in configuration');
  }

  switch (config.type.toLowerCase()) {
    case 'rabbitmq':
      return new RabbitMQClient(config);

    default:
      throw new Error(`Unsupported transport type: ${config.type}`);
  }
}

module.exports = {
  create,
};
