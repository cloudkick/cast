
goog.provide("node.process.EventEmitter");

/**
 * @constructor
 */
node.process.EventEmitter = function() {};

/**
 * @type {string|null}
 */
node.process.EventEmitter.prototype.global = null;

/**
 * @type {string|null}
 */
node.process.EventEmitter.prototype.process = null;

/**
 * @type {string|null}
 */
node.process.EventEmitter.prototype.GLOBAL = null;

/**
 * @type {string|null}
 */
node.process.EventEmitter.prototype.root = null;

/**
 * @type {string|null}
 */
node.process.EventEmitter.prototype.console = null;

/**
 * @type {string|null}
 */
node.process.EventEmitter.prototype.nclosure = null;

/**
 * @type {string|null}
 */
node.process.EventEmitter.prototype.COMPILED = null;

/**
 * @type {string|null}
 */
node.process.EventEmitter.prototype.goog = null;

/**
 * @type {string|null}
 */
node.process.EventEmitter.prototype.top = null;

/**
 * @type {string|null}
 */
node.process.EventEmitter.prototype.window = null;

/**
 * @type {string|null}
 */
node.process.EventEmitter.prototype.ncnode = null;

/**
 *
 */
node.process.EventEmitter.prototype.DTRACE_NET_SERVER_CONNECTION = function() {
  return node.process.EventEmitter.core_.DTRACE_NET_SERVER_CONNECTION();
};

/**
 *
 */
node.process.EventEmitter.prototype.DTRACE_NET_STREAM_END = function() {
  return node.process.EventEmitter.core_.DTRACE_NET_STREAM_END();
};

/**
 *
 */
node.process.EventEmitter.prototype.DTRACE_HTTP_SERVER_REQUEST = function() {
  return node.process.EventEmitter.core_.DTRACE_HTTP_SERVER_REQUEST();
};

/**
 *
 */
node.process.EventEmitter.prototype.DTRACE_HTTP_SERVER_RESPONSE = function() {
  return node.process.EventEmitter.core_.DTRACE_HTTP_SERVER_RESPONSE();
};

/**
 *
 */
node.process.EventEmitter.prototype.setTimeout = function() {
  return node.process.EventEmitter.core_.setTimeout();
};

/**
 *
 */
node.process.EventEmitter.prototype.setInterval = function() {
  return node.process.EventEmitter.core_.setInterval();
};

/**
 *
 */
node.process.EventEmitter.prototype.clearTimeout = function() {
  return node.process.EventEmitter.core_.clearTimeout();
};

/**
 *
 */
node.process.EventEmitter.prototype.clearInterval = function() {
  return node.process.EventEmitter.core_.clearInterval();
};

/**
 * @param {string} path
 */
node.process.EventEmitter.prototype.require = function(path) {
  return node.process.EventEmitter.core_.require(path);
};


/**
 * @private
 * @type {*}
 */
node.process.EventEmitter.core_ = process.EventEmitter;