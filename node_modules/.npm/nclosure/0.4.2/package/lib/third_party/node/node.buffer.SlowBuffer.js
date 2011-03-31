
goog.provide("node.buffer.SlowBuffer");

/**
 * @constructor
 */
node.buffer.SlowBuffer = function() {};

/**
 *
 */
node.buffer.SlowBuffer.prototype.byteLength = function() {
  return node.buffer.SlowBuffer.core_.byteLength();
};

/**
 *
 */
node.buffer.SlowBuffer.prototype.makeFastBuffer = function() {
  return node.buffer.SlowBuffer.core_.makeFastBuffer();
};


/**
 * @private
 * @type {*}
 */
node.buffer.SlowBuffer.core_ = require("buffer").SlowBuffer;