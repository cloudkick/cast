
goog.provide("node.crypto.Verify.Buffer");

/**
 * @constructor
 */
node.crypto.Verify.Buffer = function() {};

/**
 * @type {number|null}
 */
node.crypto.Verify.Buffer.prototype.poolSize = null;

/**
 * @param {string} b
 */
node.crypto.Verify.Buffer.prototype.isBuffer = function(b) {
  return node.crypto.Verify.Buffer.core_.isBuffer(b);
};

/**
 *
 */
node.crypto.Verify.Buffer.prototype.byteLength = function() {
  return node.crypto.Verify.Buffer.core_.byteLength();
};


/**
 * @private
 * @type {*}
 */
node.crypto.Verify.Buffer.core_ = require("crypto").Verify.Buffer;