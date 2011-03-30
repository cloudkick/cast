
goog.provide("node.http.Server");

/**
 * This is an <code>EventEmitter</code> with the following events:
 * @constructor
 */
node.http.Server = function() {};

/**
 * @type {string|null}
 */
node.http.Server.prototype.connections = null;

/**
 * @type {string|null}
 */
node.http.Server.prototype.allowHalfOpen = null;

/**
 * @type {string|null}
 */
node.http.Server.prototype.watcher = null;

/**
 * @type {string|null}
 */
node.http.Server.prototype.httpAllowHalfOpen = null;

/**
 * @param {string} msecs
 */
node.http.Server.prototype.pause = function(msecs) {
  return node.http.Server.core_.pause(msecs);
};

/**
 * Start a UNIX socket server listening for connections on the given <code>path</code>.
 *
 * This function is asynchronous. The last parameter <code>callback</code> will be called
 * when the server has been bound.
 */
node.http.Server.prototype.listen = function() {
  return node.http.Server.core_.listen();
};

/**
 * @param {string} fd
 * @param {string} type
 */
node.http.Server.prototype.listenFD = function(fd, type) {
  return node.http.Server.core_.listenFD(fd, type);
};

/**
 *
 */
node.http.Server.prototype.address = function() {
  return node.http.Server.core_.address();
};

/**
 * Stops the server from accepting new connections.
 */
node.http.Server.prototype.close = function() {
  return node.http.Server.core_.close();
};

/**
 * @param {string} n
 */
node.http.Server.prototype.setMaxListeners = function(n) {
  return node.http.Server.core_.setMaxListeners(n);
};

/**
 * @param {string} type
 */
node.http.Server.prototype.emit = function(type) {
  return node.http.Server.core_.emit(type);
};

/**
 * @param {string} type
 * @param {string} listener
 */
node.http.Server.prototype.addListener = function(type, listener) {
  return node.http.Server.core_.addListener(type, listener);
};

/**
 * @param {string} type
 * @param {string} listener
 */
node.http.Server.prototype.on = function(type, listener) {
  return node.http.Server.core_.on(type, listener);
};

/**
 * @param {string} type
 * @param {string} listener
 */
node.http.Server.prototype.once = function(type, listener) {
  return node.http.Server.core_.once(type, listener);
};

/**
 * @param {string} type
 * @param {string} listener
 */
node.http.Server.prototype.removeListener = function(type, listener) {
  return node.http.Server.core_.removeListener(type, listener);
};

/**
 * @param {string} type
 */
node.http.Server.prototype.removeAllListeners = function(type) {
  return node.http.Server.core_.removeAllListeners(type);
};

/**
 * @param {string} type
 */
node.http.Server.prototype.listeners = function(type) {
  return node.http.Server.core_.listeners(type);
};


/**
 * @private
 * @type {*}
 */
node.http.Server.core_ = require("http").Server;