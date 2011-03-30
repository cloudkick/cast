
goog.provide("node.tty_win32.ReadStream");

/**
 * @constructor
 */
node.tty_win32.ReadStream = function() {};


/**
 * @private
 * @type {*}
 */
node.tty_win32.ReadStream.core_ = require("tty_win32").ReadStream;