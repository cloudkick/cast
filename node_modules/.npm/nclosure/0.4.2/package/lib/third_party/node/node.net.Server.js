
goog.provide("node.net.Server");

/**
 * @constructor
 */
node.net.Server = function() {};

/**
 * @type {string|null}
 */
node.net.Server.prototype.connections = null;

/**
 * @type {string|null}
 */
node.net.Server.prototype.allowHalfOpen = null;

/**
 * @type {string|null}
 */
node.net.Server.prototype.watcher = null;

/**
 * @param {string} msecs
 */
node.net.Server.prototype.pause = function(msecs) {
  return node.net.Server.core_.pause(msecs);
};

/**
 *
 */
node.net.Server.prototype.listen = function() {
  return node.net.Server.core_.listen();
};

/**
 * @param {string} fd
 * @param {string} type
 */
node.net.Server.prototype.listenFD = function(fd, type) {
  return node.net.Server.core_.listenFD(fd, type);
};

/**
 *
 */
node.net.Server.prototype.address = function() {
  return node.net.Server.core_.address();
};

/**
 *
 */
node.net.Server.prototype.close = function() {
  return node.net.Server.core_.close();
};

/**
 * @param {string} n
 */
node.net.Server.prototype.setMaxListeners = function(n) {
  return node.net.Server.core_.setMaxListeners(n);
};

/**
 * @param {string} type
 */
node.net.Server.prototype.emit = function(type) {
  return node.net.Server.core_.emit(type);
};

/**
 * @param {string} type
 * @param {string} listener
 */
node.net.Server.prototype.addListener = function(type, listener) {
  return node.net.Server.core_.addListener(type, listener);
};

/**
 * @param {string} type
 * @param {string} listener
 */
node.net.Server.prototype.on = function(type, listener) {
  return node.net.Server.core_.on(type, listener);
};

/**
 * @param {string} type
 * @param {string} listener
 */
node.net.Server.prototype.once = function(type, listener) {
  return node.net.Server.core_.once(type, listener);
};

/**
 * @param {string} type
 * @param {string} listener
 */
node.net.Server.prototype.removeListener = function(type, listener) {
  return node.net.Server.core_.removeListener(type, listener);
};

/**
 * @param {string} type
 */
node.net.Server.prototype.removeAllListeners = function(type) {
  return node.net.Server.core_.removeAllListeners(type);
};

/**
 * @param {string} type
 */
node.net.Server.prototype.listeners = function(type) {
  return node.net.Server.core_.listeners(type);
};


/**
 * @private
 * @type {*}
 */
node.net.Server.core_ = require("net").Server;