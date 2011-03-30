
goog.provide("node.crypto.Decipher.Buffer");

/**
 * @constructor
 */
node.crypto.Decipher.Buffer = function() {};

/**
 * @type {number|null}
 */
node.crypto.Decipher.Buffer.prototype.poolSize = null;

/**
 * @param {string} b
 */
node.crypto.Decipher.Buffer.prototype.isBuffer = function(b) {
  return node.crypto.Decipher.Buffer.core_.isBuffer(b);
};

/**
 *
 */
node.crypto.Decipher.Buffer.prototype.byteLength = function() {
  return node.crypto.Decipher.Buffer.core_.byteLength();
};


/**
 * @private
 * @type {*}
 */
node.crypto.Decipher.Buffer.core_ = require("crypto").Decipher.Buffer;