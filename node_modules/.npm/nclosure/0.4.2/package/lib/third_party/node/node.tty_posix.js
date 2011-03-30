/**
 * @name node.tty_posix
 * @namespace
 */

goog.provide("node.tty_posix");

/**
 * @param {string} path
 * @param {Array.<*>} args
 */
node.tty_posix.open = function(path, args) {
  return node.tty_posix.core_.open(path, args);
};


/**
 * @private
 * @type {*}
 */
node.tty_posix.core_ = require("tty_posix");