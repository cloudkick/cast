
goog.provide("node.http.Agent");

/**
 * @constructor
 */
node.http.Agent = function() {};

/**
 * @type {string|null}
 */
node.http.Agent.prototype.defaultMaxSockets = null;


/**
 * @private
 * @type {*}
 */
node.http.Agent.core_ = require("http").Agent;