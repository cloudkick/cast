
goog.provide("node.fs.FileReadStream");

/**
 * @constructor
 */
node.fs.FileReadStream = function() {};


/**
 * @private
 * @type {*}
 */
node.fs.FileReadStream.core_ = require("fs").FileReadStream;