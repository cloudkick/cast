/**
 * @name node.https
 * @namespace
 * HTTPS is the HTTP protocol over TLS&#47;SSL. In Node this is implemented as a
 * separate module.
 */

goog.provide("node.https");

/**
 * @param {string} opts
 * @param {string} requestListener
 */
node.https.createServer = function(opts, requestListener) {
  return node.https.core_.createServer(opts, requestListener);
};

/**
 * @param {Object} options
 */
node.https.getAgent = function(options) {
  return node.https.core_.getAgent(options);
};

/**
 * @param {Object} options
 * @param {function(Error?,...[*]):undefined=} cb
 */
node.https.request = function(options, cb) {
  return node.https.core_.request(options, cb);
};

/**
 * @param {Object} options
 * @param {function(Error?,...[*]):undefined=} cb
 */
node.https.get = function(options, cb) {
  return node.https.core_.get(options, cb);
};


/**
 * @private
 * @type {*}
 */
node.https.core_ = require("https");