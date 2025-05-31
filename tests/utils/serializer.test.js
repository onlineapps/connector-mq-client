'use strict';

const { serialize, deserialize } = require('../../src/utils/serializer');
const { SerializationError } = require('../../src/utils/errorHandler');

describe('serializer.js', () => {
  describe('serialize()', () => {
    test('should convert a plain object to a JSON string', () => {
      const obj = { a: 1, b: 'text', c: true };
      const json = serialize(obj);
      expect(typeof json).toBe('string');
      expect(JSON.parse(json)).toEqual(obj);
    });

    test('should throw SerializationError for circular reference', () => {
      const obj = {};
      obj.self = obj;
      expect(() => serialize(obj)).toThrow(SerializationError);
      try {
        serialize(obj);
      } catch (err) {
        expect(err).toBeInstanceOf(SerializationError);
        expect(err.message).toMatch(/Failed to serialize/);
        expect(err.payload).toBe(obj);
        expect(err.cause).toBeInstanceOf(Error);
      }
    });
  });

  describe('deserialize()', () => {
    test('should convert a Buffer containing JSON to an object', () => {
      const original = { x: 42, y: 'hello' };
      const buffer = Buffer.from(JSON.stringify(original), 'utf8');
      const result = deserialize(buffer);
      expect(result).toEqual(original);
    });

    test('should convert a JSON string to an object', () => {
      const original = { nested: { foo: 'bar' } };
      const str = JSON.stringify(original);
      const result = deserialize(str);
      expect(result).toEqual(original);
    });

    test('should throw SerializationError for invalid JSON string', () => {
      const bad = '{ invalidJson: }';
      expect(() => deserialize(bad)).toThrow(SerializationError);
      try {
        deserialize(bad);
      } catch (err) {
        expect(err).toBeInstanceOf(SerializationError);
        expect(err.message).toMatch(/Failed to deserialize/);
        expect(err.payload).toBe(bad);
        expect(err.cause).toBeInstanceOf(Error);
      }
    });

    test('should throw SerializationError for non-JSON Buffer', () => {
      const buffer = Buffer.from('not a json', 'utf8');
      expect(() => deserialize(buffer)).toThrow(SerializationError);
      try {
        deserialize(buffer);
      } catch (err) {
        expect(err).toBeInstanceOf(SerializationError);
        expect(err.payload).toBe(buffer);
        expect(err.cause).toBeInstanceOf(Error);
      }
    });
  });
});
