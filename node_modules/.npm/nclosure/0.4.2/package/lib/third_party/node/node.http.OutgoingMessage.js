
goog.provide("node.http.OutgoingMessage");

/**
 * @constructor
 */
node.http.OutgoingMessage = function() {};


/**
 * @private
 * @type {*}
 */
node.http.OutgoingMessage.core_ = require("http").OutgoingMessage;