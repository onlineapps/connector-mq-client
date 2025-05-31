'use strict';

/**
 * serializer.js
 *
 * Contains helper functions for serializing and deserializing payloads.
 * On failure, throws a SerializationError (defined in errorHandler.js).
 */

const { SerializationError } = require('./errorHandler');

/**
 * Serializes a JavaScript object to JSON string.
 * @param {Object} obj
 * @returns {string}
 * @throws {SerializationError} If JSON.stringify fails (e.g., circular reference).
 */
function serialize(obj) {
  try {
    return JSON.stringify(obj);
  } catch (err) {
    throw new SerializationError('Failed to serialize object', obj, err);
  }
}

/**
 * Deserializes a Buffer or string into a JavaScript object via JSON.parse.
 * @param {Buffer|string} buffer
 * @returns {Object}
 * @throws {SerializationError} If JSON.parse fails or buffer cannot be converted.
 */
function deserialize(buffer) {
  try {
    const str = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : buffer;
    return JSON.parse(str);
  } catch (err) {
    throw new SerializationError('Failed to deserialize payload', buffer, err);
  }
}

module.exports = {
  serialize,
  deserialize,
};
