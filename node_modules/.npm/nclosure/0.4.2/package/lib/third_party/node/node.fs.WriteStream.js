
goog.provide("node.fs.WriteStream");

/**
 * <code>WriteStream</code> is a <code>Writable Stream</code>.
 * @constructor
 */
node.fs.WriteStream = function() {};


/**
 * @private
 * @type {*}
 */
node.fs.WriteStream.core_ = require("fs").WriteStream;