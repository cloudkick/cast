/**
 * @fileoverview This is only here because goog.js needs this and it does not
 * support the goog.require syntax as goog is not loaded yet.
 *
 * @externs
 */

var exports;

////////////////////////////////////////////////////////////////////////////////
// OVERRIDES TO THE node.externs.js FILE
////////////////////////////////////////////////////////////////////////////////

extern_process.prototype.stderr;


/**
 * @type {function(string):*}
 */
var require = function() {};
