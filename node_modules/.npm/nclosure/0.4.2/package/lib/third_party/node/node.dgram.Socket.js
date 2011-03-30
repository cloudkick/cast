
goog.provide("node.dgram.Socket");

/**
 * @constructor
 */
node.dgram.Socket = function() {};


/**
 * @private
 * @type {*}
 */
node.dgram.Socket.core_ = require("dgram").Socket;