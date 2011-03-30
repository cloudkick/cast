
goog.provide("node.fs.Stats.Buffer");

/**
 * @constructor
 */
node.fs.Stats.Buffer = function() {};

/**
 * @type {number|null}
 */
node.fs.Stats.Buffer.prototype.poolSize = null;

/**
 * @param {string} b
 */
node.fs.Stats.Buffer.prototype.isBuffer = function(b) {
  return node.fs.Stats.Buffer.core_.isBuffer(b);
};

/**
 *
 */
node.fs.Stats.Buffer.prototype.byteLength = function() {
  return node.fs.Stats.Buffer.core_.byteLength();
};


/**
 * @private
 * @type {*}
 */
node.fs.Stats.Buffer.core_ = require("fs").Stats.Buffer;