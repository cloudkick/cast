
goog.provide("node.fs.FileWriteStream");

/**
 * @constructor
 */
node.fs.FileWriteStream = function() {};


/**
 * @private
 * @type {*}
 */
node.fs.FileWriteStream.core_ = require("fs").FileWriteStream;