
goog.provide("node.buffer.Buffer");

/**
 * @constructor
 */
node.buffer.Buffer = function() {};

/**
 * @type {number|null}
 */
node.buffer.Buffer.prototype.poolSize = null;

/**
 * @param {string} b
 */
node.buffer.Buffer.prototype.isBuffer = function(b) {
  return node.buffer.Buffer.core_.isBuffer(b);
};

/**
 *
 */
node.buffer.Buffer.prototype.byteLength = function() {
  return node.buffer.Buffer.core_.byteLength();
};


/**
 * @private
 * @type {*}
 */
node.buffer.Buffer.core_ = require("buffer").Buffer;