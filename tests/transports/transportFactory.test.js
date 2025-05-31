'use strict';

const transportFactory = require('../../src/transports/transportFactory');
const RabbitMQClient = require('../../src/transports/rabbitmqClient');
// const KafkaClient = require('../../src/transports/kafkaClient'); // Uncomment when implemented

describe('transportFactory', () => {
  test('should instantiate RabbitMQClient when config.type is "rabbitmq"', () => {
    const config = { type: 'rabbitmq', host: 'amqp://localhost:5672', queue: 'test-queue' };
    const transport = transportFactory.create(config);
    expect(transport).toBeInstanceOf(RabbitMQClient);
  });

  test('should be case-insensitive for type field', () => {
    const config = { type: 'RaBbItMq', host: 'amqp://localhost:5672', queue: 'q' };
    const transport = transportFactory.create(config);
    expect(transport).toBeInstanceOf(RabbitMQClient);
  });

  test('should throw an error if type is missing', () => {
    expect(() => transportFactory.create({})).toThrow(Error);
  });

  test('should throw an error for unsupported type', () => {
    const config = { type: 'unsupported', host: 'x', queue: 'y' };
    expect(() => transportFactory.create(config)).toThrow(/Unsupported transport type/);
  });

  // Placeholder for Kafka once implemented
  // test('should instantiate KafkaClient when config.type is "kafka"', () => {
  //   const config = { type: 'kafka', brokers: ['localhost:9092'], topic: 'test' };
  //   const transport = transportFactory.create(config);
  //   expect(transport).toBeInstanceOf(KafkaClient);
  // });
});
