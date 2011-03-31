
goog.provide("node.crypto.Credentials");

/**
 * @constructor
 */
node.crypto.Credentials = function() {};

/**
 * @type {string|null}
 */
node.crypto.Credentials.prototype.context = null;


/**
 * @private
 * @type {*}
 */
node.crypto.Credentials.core_ = require("crypto").Credentials;