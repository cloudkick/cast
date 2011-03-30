
goog.provide("node.tls.Server");

/**
 * @constructor
 */
node.tls.Server = function() {};


/**
 * @private
 * @type {*}
 */
node.tls.Server.core_ = require("tls").Server;