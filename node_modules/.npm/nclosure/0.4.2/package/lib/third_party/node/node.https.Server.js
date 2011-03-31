
goog.provide("node.https.Server");

/**
 * @constructor
 */
node.https.Server = function() {};


/**
 * @private
 * @type {*}
 */
node.https.Server.core_ = require("https").Server;