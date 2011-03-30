
goog.provide("node.crypto.Sign");

/**
 * @constructor
 */
node.crypto.Sign = function() {};

/**
 * @type {string|null}
 */
node.crypto.Sign.prototype.global = null;

/**
 * @type {string|null}
 */
node.crypto.Sign.prototype.process = null;

/**
 * @type {string|null}
 */
node.crypto.Sign.prototype.GLOBAL = null;

/**
 * @type {string|null}
 */
node.crypto.Sign.prototype.root = null;

/**
 * @type {string|null}
 */
node.crypto.Sign.prototype.console = null;

/**
 * @type {string|null}
 */
node.crypto.Sign.prototype.nclosure = null;

/**
 * @type {string|null}
 */
node.crypto.Sign.prototype.COMPILED = null;

/**
 * @type {string|null}
 */
node.crypto.Sign.prototype.goog = null;

/**
 * @type {string|null}
 */
node.crypto.Sign.prototype.top = null;

/**
 * @type {string|null}
 */
node.crypto.Sign.prototype.window = null;

/**
 * @type {string|null}
 */
node.crypto.Sign.prototype.ncnode = null;

/**
 *
 */
node.crypto.Sign.prototype.DTRACE_NET_SERVER_CONNECTION = function() {
  return node.crypto.Sign.core_.DTRACE_NET_SERVER_CONNECTION();
};

/**
 *
 */
node.crypto.Sign.prototype.DTRACE_NET_STREAM_END = function() {
  return node.crypto.Sign.core_.DTRACE_NET_STREAM_END();
};

/**
 *
 */
node.crypto.Sign.prototype.DTRACE_HTTP_SERVER_REQUEST = function() {
  return node.crypto.Sign.core_.DTRACE_HTTP_SERVER_REQUEST();
};

/**
 *
 */
node.crypto.Sign.prototype.DTRACE_HTTP_SERVER_RESPONSE = function() {
  return node.crypto.Sign.core_.DTRACE_HTTP_SERVER_RESPONSE();
};

/**
 *
 */
node.crypto.Sign.prototype.setTimeout = function() {
  return node.crypto.Sign.core_.setTimeout();
};

/**
 *
 */
node.crypto.Sign.prototype.setInterval = function() {
  return node.crypto.Sign.core_.setInterval();
};

/**
 *
 */
node.crypto.Sign.prototype.clearTimeout = function() {
  return node.crypto.Sign.core_.clearTimeout();
};

/**
 *
 */
node.crypto.Sign.prototype.clearInterval = function() {
  return node.crypto.Sign.core_.clearInterval();
};

/**
 * @param {string} path
 */
node.crypto.Sign.prototype.require = function(path) {
  return node.crypto.Sign.core_.require(path);
};


/**
 * @private
 * @type {*}
 */
node.crypto.Sign.core_ = require("crypto").Sign;