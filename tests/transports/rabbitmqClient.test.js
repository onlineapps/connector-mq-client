'use strict';

const amqp = require('amqplib');
const RabbitMQClient = require('../../src/transports/rabbitmqClient');

jest.mock('amqplib');

describe('rabbitmqClient', () => {
  let channelMock;
  let connectionMock;
  const originalAmqpConnect = amqp.connect;

  const fakeConfig = {
    host: 'amqp://localhost:5672',
    queue: 'test-queue',
    exchange: '',
    durable: true,
    prefetch: 1,
    noAck: false,
  };

  beforeEach(() => {
    // Create fresh mocks for channel and connection
    channelMock = {
      assertQueue: jest.fn().mockResolvedValue(),
      assertExchange: jest.fn().mockResolvedValue(),
      sendToQueue: jest.fn(),
      publish: jest.fn(),
      waitForConfirms: jest.fn().mockResolvedValue(),
      consume: jest.fn().mockResolvedValue(),
      prefetch: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
      close: jest.fn().mockResolvedValue(),
      on: jest.fn(),
    };

    connectionMock = {
      createConfirmChannel: jest.fn().mockResolvedValue(channelMock),
      close: jest.fn().mockResolvedValue(),
      on: jest.fn(),
    };

    // Default behavior: amqp.connect resolves to our connectionMock
    amqp.connect.mockResolvedValue(connectionMock);
  });

  afterAll(() => {
    // Restore original amqp.connect in case other tests rely on it
    amqp.connect = originalAmqpConnect;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('connect() should ignore close error when cleaning up and rethrow original', async () => {
    const client = new RabbitMQClient(fakeConfig);
    // Simulate successful amqp.connect, but confirm channel fails and close also fails
    const badConn = {
      createConfirmChannel: jest.fn().mockRejectedValue(new Error('confirm fail')),
      close: jest.fn().mockRejectedValue(new Error('close fail')),
      on: jest.fn(),
    };

    amqp.connect.mockResolvedValue(badConn);

    await expect(client.connect()).rejects.toThrow('confirm fail');
    expect(badConn.close).toHaveBeenCalled();
  });

  test('connect() should cleanup and rethrow if createConfirmChannel fails', async () => {
    // Create a client and simulate connection succeeding but channel creation failing
    const client = new RabbitMQClient(fakeConfig);
    const failingConn = {
      createConfirmChannel: jest.fn().mockRejectedValue(new Error('confirm fail')),
      close: jest.fn().mockResolvedValue(),
      on: jest.fn(),
    };
    amqp.connect.mockResolvedValue(failingConn);

    await expect(client.connect()).rejects.toThrow('confirm fail');
    expect(failingConn.close).toHaveBeenCalled();
  });

  test('consume() should propagate error if assertQueue fails and emit error', async () => {
    const client = new RabbitMQClient(fakeConfig);
    const errorHandler = jest.fn();
    client.on('error', errorHandler);

    await client.connect();
    // Simulate assertQueue throwing an error
    const assertErr = new Error('assertQueue fail');
    channelMock.assertQueue.mockRejectedValue(assertErr);

    await expect(client.consume('test-queue', async () => {})).rejects.toThrow(
      'assertQueue fail'
    );
    expect(errorHandler).toHaveBeenCalledWith(assertErr);
  });

  test('connect() should create connection and confirm channel', async () => {
    const client = new RabbitMQClient(fakeConfig);
    await client.connect();

    expect(amqp.connect).toHaveBeenCalledWith(fakeConfig.host);
    expect(connectionMock.createConfirmChannel).toHaveBeenCalled();

    // Check that channel.on was registered for 'error' and 'close'
    expect(channelMock.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(channelMock.on).toHaveBeenCalledWith('close', expect.any(Function));
    // Check that connection.on was registered for 'error' and 'close'
    expect(connectionMock.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(connectionMock.on).toHaveBeenCalledWith('close', expect.any(Function));
  });

  test('consume() should propagate error if channel.consume fails and emit error', async () => {
    const client = new RabbitMQClient(fakeConfig);
    const errorHandler = jest.fn();
    client.on('error', errorHandler);

    await client.connect();
    const consumeErr = new Error('consume fail');
    channelMock.consume.mockRejectedValue(consumeErr);

    await expect(client.consume('test-queue', async () => {})).rejects.toThrow(
      'consume fail'
    );
    expect(errorHandler).toHaveBeenCalledWith(consumeErr);
  });

  test('connect() should propagate error if amqp.connect rejects', async () => {
    amqp.connect.mockRejectedValue(new Error('Connection failure'));

    const client = new RabbitMQClient(fakeConfig);
    await expect(client.connect()).rejects.toThrow('Connection failure');
  });

  test('should emit error when underlying channel emits "error"', async () => {
    const client = new RabbitMQClient(fakeConfig);
    const errorHandler = jest.fn();
    client.on('error', errorHandler);

    await client.connect();

    // Find the callback registered for channel 'error'
    const channelErrorCb = channelMock.on.mock.calls.find(call => call[0] === 'error')[1];
    const fakeErr = new Error('Channel failure');
    channelErrorCb(fakeErr);

    expect(errorHandler).toHaveBeenCalledWith(fakeErr);
  });

  test('should emit error when underlying channel emits "close"', async () => {
    const client = new RabbitMQClient(fakeConfig);
    const errorHandler = jest.fn();
    client.on('error', errorHandler);

    await client.connect();

    // Find the callback registered for channel 'close'
    const channelCloseCb = channelMock.on.mock.calls.find(call => call[0] === 'close')[1];
    channelCloseCb();

    expect(errorHandler).toHaveBeenCalled();
    expect(errorHandler.mock.calls[0][0].message).toBe('RabbitMQ channel closed unexpectedly');
  });

  test('should emit error when underlying connection emits "error"', async () => {
    const client = new RabbitMQClient(fakeConfig);
    const errorHandler = jest.fn();
    client.on('error', errorHandler);

    await client.connect();

    // Find the callback registered for connection 'error'
    const connErrorCb = connectionMock.on.mock.calls.find(call => call[0] === 'error')[1];
    const fakeErr = new Error('Connection lost');
    connErrorCb(fakeErr);

    expect(errorHandler).toHaveBeenCalledWith(fakeErr);
  });

  test('should emit error when underlying connection emits "close"', async () => {
    const client = new RabbitMQClient(fakeConfig);
    const errorHandler = jest.fn();
    client.on('error', errorHandler);

    await client.connect();

    // Find the callback registered for connection 'close'
    const connCloseCb = connectionMock.on.mock.calls.find(call => call[0] === 'close')[1];
    connCloseCb();

    expect(errorHandler).toHaveBeenCalled();
    expect(errorHandler.mock.calls[0][0].message).toBe('RabbitMQ connection closed unexpectedly');
  });

  test('disconnect() should close channel and connection without errors', async () => {
    const client = new RabbitMQClient(fakeConfig);
    await client.connect();
    await client.disconnect();

    expect(channelMock.close).toHaveBeenCalled();
    expect(connectionMock.close).toHaveBeenCalled();
  });

  test('disconnect() should emit error if channel.close rejects', async () => {
    channelMock.close.mockRejectedValue(new Error('channel close error'));
    const client = new RabbitMQClient(fakeConfig);
    const errorHandler = jest.fn();
    client.on('error', errorHandler);

    await client.connect();
    await client.disconnect();

    expect(errorHandler).toHaveBeenCalledWith(expect.objectContaining({ message: 'channel close error' }));
    // Connection.close still called
    expect(connectionMock.close).toHaveBeenCalled();
  });

  test('disconnect() should emit error if connection.close rejects', async () => {
    connectionMock.close.mockRejectedValue(new Error('connection close error'));
    const client = new RabbitMQClient(fakeConfig);
    const errorHandler = jest.fn();
    client.on('error', errorHandler);

    await client.connect();
    // Make channel.close succeed
    channelMock.close.mockResolvedValue();
    await client.disconnect();

    expect(errorHandler).toHaveBeenCalledWith(expect.objectContaining({ message: 'connection close error' }));
  });

  test('publish() to default queue should assertQueue, sendToQueue, and wait for confirms', async () => {
    const client = new RabbitMQClient(fakeConfig);
    await client.connect();

    const buffer = Buffer.from('message');
    await client.publish('test-queue', buffer, { persistent: true, headers: { a: 1 } });

    expect(channelMock.assertQueue).toHaveBeenCalledWith('test-queue', {
      durable: fakeConfig.durable,
    });
    expect(channelMock.sendToQueue).toHaveBeenCalledWith('test-queue', buffer, {
      persistent: true,
      headers: { a: 1 },
      routingKey: 'test-queue',
    });
    expect(channelMock.waitForConfirms).toHaveBeenCalled();
  });

  test('publish() should throw if channel is not initialized', async () => {
    const client = new RabbitMQClient(fakeConfig);
    await expect(client.publish('test-queue', Buffer.from('x'))).rejects.toThrow(
      'Cannot publish: channel is not initialized'
    );
  });

  test('publish() to exchange should assertExchange and publish', async () => {
    const configWithExchange = { ...fakeConfig, exchange: 'my-exchange' };
    const client = new RabbitMQClient(configWithExchange);
    await client.connect();

    const buffer = Buffer.from('hi');
    await client.publish('ignored-queue', buffer, { routingKey: 'rk', persistent: false });

    expect(channelMock.assertExchange).toHaveBeenCalledWith('my-exchange', 'direct', {
      durable: true,
    });
    expect(channelMock.publish).toHaveBeenCalledWith('my-exchange', 'rk', buffer, {
      persistent: false,
      headers: {},
    });
    expect(channelMock.waitForConfirms).toHaveBeenCalled();
  });

  test('publish() should propagate errors thrown by sendToQueue', async () => {
    const client = new RabbitMQClient(fakeConfig);
    await client.connect();

    channelMock.sendToQueue.mockImplementation(() => {
      throw new Error('sendToQueue failed');
    });

    await expect(client.publish('test-queue', Buffer.from('x'))).rejects.toThrow(
      'sendToQueue failed'
    );
  });

  test('consume() should assertQueue, set prefetch, and register consumer', async () => {
    const client = new RabbitMQClient(fakeConfig);
    await client.connect();

    const handler = jest.fn().mockResolvedValue();
    await client.consume('test-queue', handler, { prefetch: 5, noAck: true });

    expect(channelMock.assertQueue).toHaveBeenCalledWith('test-queue', {
      durable: fakeConfig.durable,
    });
    expect(channelMock.prefetch).toHaveBeenCalledWith(5);
    expect(channelMock.consume).toHaveBeenCalledWith('test-queue', expect.any(Function), {
      noAck: true,
    });
  });

  test('consume() should throw if channel is not initialized', async () => {
    const client = new RabbitMQClient(fakeConfig);
    await expect(
      client.consume('test-queue', async () => {})
    ).rejects.toThrow('Cannot consume: channel is not initialized');
  });

  test('handler success path: should call ack when noAck is false', async () => {
    const client = new RabbitMQClient(fakeConfig);
    await client.connect();

    const handler = jest.fn().mockResolvedValue();
    await client.consume('test-queue', handler, { noAck: false });

    // Extract the registered consume callback
    const consumeCallback = channelMock.consume.mock.calls[0][1];
    const fakeMsg = { content: Buffer.from('x') };

    await consumeCallback(fakeMsg);
    expect(handler).toHaveBeenCalledWith(fakeMsg);
    expect(channelMock.ack).toHaveBeenCalledWith(fakeMsg);
  });

  test('handler error path: should call nack with requeue true', async () => {
    const client = new RabbitMQClient(fakeConfig);
    await client.connect();

    const handler = jest.fn().mockRejectedValue(new Error('handler failed'));
    await client.consume('test-queue', handler, { noAck: false });

    const consumeCallback = channelMock.consume.mock.calls[0][1];
    const fakeMsg = { content: Buffer.from('x') };

    await consumeCallback(fakeMsg);
    expect(handler).toHaveBeenCalledWith(fakeMsg);
    expect(channelMock.nack).toHaveBeenCalledWith(fakeMsg, false, true);
  });

  test('consume callback should ignore null messages', async () => {
    const client = new RabbitMQClient(fakeConfig);
    await client.connect();

    const handler = jest.fn().mockResolvedValue();
    await client.consume('test-queue', handler, { noAck: false });

    const consumeCallback = channelMock.consume.mock.calls[0][1];
    // Simulate msg === null
    await consumeCallback(null);

    expect(handler).not.toHaveBeenCalled();
    expect(channelMock.ack).not.toHaveBeenCalled();
    expect(channelMock.nack).not.toHaveBeenCalled();
  });

  test('ack() should throw if channel not initialized', async () => {
    const client = new RabbitMQClient(fakeConfig);
    await expect(client.ack({})).rejects.toThrow('Cannot ack: channel is not initialized');
  });

  test('nack() should throw if channel not initialized', async () => {
    const client = new RabbitMQClient(fakeConfig);
    await expect(client.nack({})).rejects.toThrow('Cannot nack: channel is not initialized');
  });

  test('ack() should delegate to channel.ack when connected', async () => {
    const client = new RabbitMQClient(fakeConfig);
    await client.connect();

    const fakeMsg = { content: Buffer.from('y') };
    await client.ack(fakeMsg);
    expect(channelMock.ack).toHaveBeenCalledWith(fakeMsg);
  });

  test('nack() should delegate to channel.nack with default requeue=true when connected', async () => {
    const client = new RabbitMQClient(fakeConfig);
    await client.connect();

    const fakeMsg = { content: Buffer.from('z') };
    await client.nack(fakeMsg);
    expect(channelMock.nack).toHaveBeenCalledWith(fakeMsg, false, true);
  });

  test('nack() should pass requeue=false when specified', async () => {
    const client = new RabbitMQClient(fakeConfig);
    await client.connect();

    const fakeMsg = { content: Buffer.from('z') };
    await client.nack(fakeMsg, { requeue: false });
    expect(channelMock.nack).toHaveBeenCalledWith(fakeMsg, false, false);
  });

  test('consume() with noAck true should not ack messages', async () => {
    const configNoAck = { ...fakeConfig, noAck: true };
    const client = new RabbitMQClient(configNoAck);
    await client.connect();

    const handler = jest.fn().mockResolvedValue();
    await client.consume('test-queue', handler, { noAck: true });

    const consumeCallback = channelMock.consume.mock.calls[0][1];
    const fakeMsg = { content: Buffer.from('y') };

    await consumeCallback(fakeMsg);
    expect(handler).toHaveBeenCalledWith(fakeMsg);
    expect(channelMock.ack).not.toHaveBeenCalled();
  });

  test('ack() should emit error and throw if channel.ack throws', async () => {
    const client = new RabbitMQClient(fakeConfig);
    await client.connect();
    // Simulate channel.ack throwing
    const fakeErr = new Error('ack failure');
    channelMock.ack.mockImplementation(() => {
      throw fakeErr;
    });

    const errorHandler = jest.fn();
    client.on('error', errorHandler);

    await expect(client.ack({})).rejects.toThrow('ack failure');
    expect(errorHandler).toHaveBeenCalledWith(fakeErr);
  });

  test('nack() should emit error and throw if channel.nack throws', async () => {
    const client = new RabbitMQClient(fakeConfig);
    await client.connect();
    // Simulate channel.nack throwing
    const fakeErr = new Error('nack failure');
    channelMock.nack.mockImplementation(() => {
      throw fakeErr;
    });

    const errorHandler = jest.fn();
    client.on('error', errorHandler);

    await expect(client.nack({}, { requeue: false })).rejects.toThrow('nack failure');
    expect(errorHandler).toHaveBeenCalledWith(fakeErr);
  });

  test('consume() should skip prefetch when non-number is provided', async () => {
    const client = new RabbitMQClient(fakeConfig);
    await client.connect();

    const handler = jest.fn().mockResolvedValue();
    // Pass prefetch as null to force skip
    await client.consume('test-queue', handler, { prefetch: null, noAck: true });
    expect(channelMock.prefetch).not.toHaveBeenCalled();
  });

  test('publish() should emit error and throw if waitForConfirms fails', async () => {
    const client = new RabbitMQClient(fakeConfig);
    const errorHandler = jest.fn();
    client.on('error', errorHandler);

    await client.connect();
    // Make assertQueue succeed, but waitForConfirms fail
    channelMock.waitForConfirms.mockRejectedValue(new Error('confirms failure'));

    const buffer = Buffer.from('data');
    await expect(client.publish('test-queue', buffer, {})).rejects.toThrow('confirms failure');
    expect(errorHandler).toHaveBeenCalledWith(expect.objectContaining({ message: 'confirms failure' }));
  });

  test('consume() should call prefetch when numeric value is provided', async () => {
    const client = new RabbitMQClient(fakeConfig);
    await client.connect();
  
    const handler = jest.fn().mockResolvedValue();
    // Pass prefetch as a number to force the branch
    await client.consume('test-queue', handler, { prefetch: 10, noAck: true });
    expect(channelMock.prefetch).toHaveBeenCalledWith(10);
  });
  
  test('consume() should skip prefetch when string is provided', async () => {
    const client = new RabbitMQClient(fakeConfig);
    await client.connect();
  
    const handler = jest.fn().mockResolvedValue();
    // Pass prefetch as a string—you still must skip channel.prefetch
    await client.consume('test-queue', handler, { prefetch: 'not-a-number', noAck: true });
    expect(channelMock.prefetch).not.toHaveBeenCalled();
  });
  
});
