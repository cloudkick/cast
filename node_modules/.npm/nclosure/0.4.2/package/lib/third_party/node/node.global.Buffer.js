
goog.provide("node.global.Buffer");

/**
 * @constructor
 */
node.global.Buffer = function() {};

/**
 * @type {number|null}
 */
node.global.Buffer.prototype.poolSize = null;

/**
 * @param {string} b
 */
node.global.Buffer.prototype.isBuffer = function(b) {
  return node.global.Buffer.core_.isBuffer(b);
};

/**
 *
 */
node.global.Buffer.prototype.byteLength = function() {
  return node.global.Buffer.core_.byteLength();
};


/**
 * @private
 * @type {*}
 */
node.global.Buffer.core_ = global.Buffer;