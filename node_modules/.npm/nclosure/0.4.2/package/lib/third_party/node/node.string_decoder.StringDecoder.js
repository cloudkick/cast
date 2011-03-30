
goog.provide("node.string_decoder.StringDecoder");

/**
 * @constructor
 */
node.string_decoder.StringDecoder = function() {};


/**
 * @private
 * @type {*}
 */
node.string_decoder.StringDecoder.core_ = require("string_decoder").StringDecoder;