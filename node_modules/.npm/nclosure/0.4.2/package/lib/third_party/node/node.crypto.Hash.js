
goog.provide("node.crypto.Hash");

/**
 * @constructor
 */
node.crypto.Hash = function() {};


/**
 * @private
 * @type {*}
 */
node.crypto.Hash.core_ = require("crypto").Hash;