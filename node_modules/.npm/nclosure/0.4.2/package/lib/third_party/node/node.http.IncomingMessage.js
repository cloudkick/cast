
goog.provide("node.http.IncomingMessage");

/**
 * @constructor
 */
node.http.IncomingMessage = function() {};


/**
 * @private
 * @type {*}
 */
node.http.IncomingMessage.core_ = require("http").IncomingMessage;