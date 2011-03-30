
goog.provide("node.crypto.Cipher");

/**
 * @constructor
 */
node.crypto.Cipher = function() {};

/**
 * @type {string|null}
 */
node.crypto.Cipher.prototype.global = null;

/**
 * @type {string|null}
 */
node.crypto.Cipher.prototype.process = null;

/**
 * @type {string|null}
 */
node.crypto.Cipher.prototype.GLOBAL = null;

/**
 * @type {string|null}
 */
node.crypto.Cipher.prototype.root = null;

/**
 * @type {string|null}
 */
node.crypto.Cipher.prototype.console = null;

/**
 * @type {string|null}
 */
node.crypto.Cipher.prototype.nclosure = null;

/**
 * @type {string|null}
 */
node.crypto.Cipher.prototype.COMPILED = null;

/**
 * @type {string|null}
 */
node.crypto.Cipher.prototype.goog = null;

/**
 * @type {string|null}
 */
node.crypto.Cipher.prototype.top = null;

/**
 * @type {string|null}
 */
node.crypto.Cipher.prototype.window = null;

/**
 * @type {string|null}
 */
node.crypto.Cipher.prototype.ncnode = null;

/**
 *
 */
node.crypto.Cipher.prototype.DTRACE_NET_SERVER_CONNECTION = function() {
  return node.crypto.Cipher.core_.DTRACE_NET_SERVER_CONNECTION();
};

/**
 *
 */
node.crypto.Cipher.prototype.DTRACE_NET_STREAM_END = function() {
  return node.crypto.Cipher.core_.DTRACE_NET_STREAM_END();
};

/**
 *
 */
node.crypto.Cipher.prototype.DTRACE_HTTP_SERVER_REQUEST = function() {
  return node.crypto.Cipher.core_.DTRACE_HTTP_SERVER_REQUEST();
};

/**
 *
 */
node.crypto.Cipher.prototype.DTRACE_HTTP_SERVER_RESPONSE = function() {
  return node.crypto.Cipher.core_.DTRACE_HTTP_SERVER_RESPONSE();
};

/**
 *
 */
node.crypto.Cipher.prototype.setTimeout = function() {
  return node.crypto.Cipher.core_.setTimeout();
};

/**
 *
 */
node.crypto.Cipher.prototype.setInterval = function() {
  return node.crypto.Cipher.core_.setInterval();
};

/**
 *
 */
node.crypto.Cipher.prototype.clearTimeout = function() {
  return node.crypto.Cipher.core_.clearTimeout();
};

/**
 *
 */
node.crypto.Cipher.prototype.clearInterval = function() {
  return node.crypto.Cipher.core_.clearInterval();
};

/**
 * @param {string} path
 */
node.crypto.Cipher.prototype.require = function(path) {
  return node.crypto.Cipher.core_.require(path);
};


/**
 * @private
 * @type {*}
 */
node.crypto.Cipher.core_ = require("crypto").Cipher;