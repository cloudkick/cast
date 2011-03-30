
goog.provide("node.stream.Stream");

/**
 * @constructor
 */
node.stream.Stream = function() {};


/**
 * @private
 * @type {*}
 */
node.stream.Stream.core_ = require("stream").Stream;