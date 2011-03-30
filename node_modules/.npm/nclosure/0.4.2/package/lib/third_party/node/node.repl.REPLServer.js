
goog.provide('node.repl.REPLServer');



/**
 * @constructor
 */
node.repl.REPLServer = function() {};


/**
 * @private
 * @type {*}
 */
node.repl.REPLServer.core_ = require('repl').REPLServer;
