
goog.provide("node.fs.ReadStream");

/**
 * <code>ReadStream</code> is a <code>Readable Stream</code>.
 * @constructor
 */
node.fs.ReadStream = function() {};


/**
 * @private
 * @type {*}
 */
node.fs.ReadStream.core_ = require("fs").ReadStream;