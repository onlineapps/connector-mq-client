'use strict';

/**
 * Entry point for @onlineapps/agent-mq-client.
 * Exports the AgentMQClient class and MQWrapper extension
 */

const AgentMQClient = require('./client');
const MQWrapper = require('./mqWrapper');

// Default export remains AgentMQClient for backward compatibility
module.exports = AgentMQClient;

// Named exports for both classes
module.exports.AgentMQClient = AgentMQClient;
module.exports.MQWrapper = MQWrapper;
