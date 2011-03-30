
goog.provide("node.process.EventEmitter.Buffer");

/**
 * @constructor
 */
node.process.EventEmitter.Buffer = function() {};

/**
 * @type {number|null}
 */
node.process.EventEmitter.Buffer.prototype.poolSize = null;

/**
 * @param {string} b
 */
node.process.EventEmitter.Buffer.prototype.isBuffer = function(b) {
  return node.process.EventEmitter.Buffer.core_.isBuffer(b);
};

/**
 *
 */
node.process.EventEmitter.Buffer.prototype.byteLength = function() {
  return node.process.EventEmitter.Buffer.core_.byteLength();
};


/**
 * @private
 * @type {*}
 */
node.process.EventEmitter.Buffer.core_ = process.EventEmitter.Buffer;