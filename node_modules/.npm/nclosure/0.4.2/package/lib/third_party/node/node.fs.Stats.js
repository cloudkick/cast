
goog.provide("node.fs.Stats");

/**
 * Objects returned from <code>fs.stat()</code> and <code>fs.lstat()</code> are of this type.
 *
 *  - <code>stats.isFile()</code>
 *  - <code>stats.isDirectory()</code>
 *  - <code>stats.isBlockDevice()</code>
 *  - <code>stats.isCharacterDevice()</code>
 *  - <code>stats.isSymbolicLink()</code> (only valid with  <code>fs.lstat()</code>)
 *  - <code>stats.isFIFO()</code>
 *  - <code>stats.isSocket()</code>
 * @constructor
 */
node.fs.Stats = function() {};

/**
 * @type {string|null}
 */
node.fs.Stats.prototype.global = null;

/**
 * @type {string|null}
 */
node.fs.Stats.prototype.process = null;

/**
 * @type {string|null}
 */
node.fs.Stats.prototype.GLOBAL = null;

/**
 * @type {string|null}
 */
node.fs.Stats.prototype.root = null;

/**
 * @type {string|null}
 */
node.fs.Stats.prototype.console = null;

/**
 * @type {string|null}
 */
node.fs.Stats.prototype.nclosure = null;

/**
 * @type {string|null}
 */
node.fs.Stats.prototype.COMPILED = null;

/**
 * @type {string|null}
 */
node.fs.Stats.prototype.goog = null;

/**
 * @type {string|null}
 */
node.fs.Stats.prototype.top = null;

/**
 * @type {string|null}
 */
node.fs.Stats.prototype.window = null;

/**
 * @type {string|null}
 */
node.fs.Stats.prototype.ncnode = null;

/**
 *
 */
node.fs.Stats.prototype.DTRACE_NET_SERVER_CONNECTION = function() {
  return node.fs.Stats.core_.DTRACE_NET_SERVER_CONNECTION();
};

/**
 *
 */
node.fs.Stats.prototype.DTRACE_NET_STREAM_END = function() {
  return node.fs.Stats.core_.DTRACE_NET_STREAM_END();
};

/**
 *
 */
node.fs.Stats.prototype.DTRACE_HTTP_SERVER_REQUEST = function() {
  return node.fs.Stats.core_.DTRACE_HTTP_SERVER_REQUEST();
};

/**
 *
 */
node.fs.Stats.prototype.DTRACE_HTTP_SERVER_RESPONSE = function() {
  return node.fs.Stats.core_.DTRACE_HTTP_SERVER_RESPONSE();
};

/**
 *
 */
node.fs.Stats.prototype.setTimeout = function() {
  return node.fs.Stats.core_.setTimeout();
};

/**
 *
 */
node.fs.Stats.prototype.setInterval = function() {
  return node.fs.Stats.core_.setInterval();
};

/**
 *
 */
node.fs.Stats.prototype.clearTimeout = function() {
  return node.fs.Stats.core_.clearTimeout();
};

/**
 *
 */
node.fs.Stats.prototype.clearInterval = function() {
  return node.fs.Stats.core_.clearInterval();
};

/**
 * @param {string} path
 */
node.fs.Stats.prototype.require = function(path) {
  return node.fs.Stats.core_.require(path);
};


/**
 * @private
 * @type {*}
 */
node.fs.Stats.core_ = require("fs").Stats;