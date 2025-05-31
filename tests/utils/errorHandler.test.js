'use strict';

const {
  ValidationError,
  ConnectionError,
  PublishError,
  ConsumeError,
  SerializationError,
} = require('../../src/utils/errorHandler');

describe('errorHandler.js', () => {
  describe('ValidationError', () => {
    it('should set name to "ValidationError" and include details when array is provided', () => {
      const details = [{ path: '/foo', message: 'is required' }];
      const err = new ValidationError('Invalid config', details);

      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('ValidationError');
      expect(err.details).toEqual(details);
      expect(err.message).toBe('Invalid config');
    });

    it('should default details to [] if non-array is passed', () => {
      const err = new ValidationError('Missing fields', undefined);

      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('ValidationError');
      expect(err.details).toEqual([]); // tady testujeme výchozí větev
      expect(err.message).toBe('Missing fields');
    });
  });

  describe('ConnectionError', () => {
    it('should set name to "ConnectionError" and carry cause', () => {
      const cause = new Error('Connection refused');
      const err = new ConnectionError('Cannot connect', cause);

      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('ConnectionError');
      expect(err.cause).toBe(cause);
      expect(err.message).toBe('Cannot connect');
    });
  });

  describe('PublishError', () => {
    it('should set name to "PublishError" and carry queue/cause', () => {
      const cause = new Error('Publish failed');
      const err = new PublishError('Failed', 'my-queue', cause);

      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('PublishError');
      expect(err.queue).toBe('my-queue');
      expect(err.cause).toBe(cause);
      expect(err.message).toBe('Failed');
    });
  });

  describe('ConsumeError', () => {
    it('should set name to "ConsumeError" and carry queue/cause', () => {
      const cause = new Error('Consume failed');
      const err = new ConsumeError('Cannot consume', 'my-queue', cause);

      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('ConsumeError');
      expect(err.queue).toBe('my-queue');
      expect(err.cause).toBe(cause);
      expect(err.message).toBe('Cannot consume');
    });
  });

  describe('SerializationError', () => {
    it('should set name to "SerializationError" and carry payload/cause', () => {
      const payload = { a: 1 };
      const cause = new Error('JSON error');
      const err = new SerializationError('Bad JSON', payload, cause);

      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('SerializationError');
      expect(err.payload).toBe(payload);
      expect(err.cause).toBe(cause);
      expect(err.message).toBe('Bad JSON');
    });
  });
});
