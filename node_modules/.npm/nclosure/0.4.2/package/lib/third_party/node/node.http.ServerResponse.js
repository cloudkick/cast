
goog.provide("node.http.ServerResponse");

/**
 * This object is created internally by a HTTP server--not by the user. It is
 * passed as the second parameter to the <code>'request'</code> event. It is a <code>Writable Stream</code>.
 * @constructor
 */
node.http.ServerResponse = function() {};


/**
 * @private
 * @type {*}
 */
node.http.ServerResponse.core_ = require("http").ServerResponse;