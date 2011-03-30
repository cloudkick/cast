/**
 * @name node.console
 * @namespace
 */

goog.provide("node.console");

/**
 *
 */
node.console.log = function() {
  return node.console.core_.log();
};

/**
 *
 */
node.console.info = function() {
  return node.console.core_.info();
};

/**
 *
 */
node.console.warn = function() {
  return node.console.core_.warn();
};

/**
 *
 */
node.console.error = function() {
  return node.console.core_.error();
};

/**
 * @param {string} object
 */
node.console.dir = function(object) {
  return node.console.core_.dir(object);
};

/**
 * @param {string} label
 */
node.console.time = function(label) {
  return node.console.core_.time(label);
};

/**
 * @param {string} label
 */
node.console.timeEnd = function(label) {
  return node.console.core_.timeEnd(label);
};

/**
 * @param {string} label
 */
node.console.trace = function(label) {
  return node.console.core_.trace(label);
};

/**
 * @param {string} expression
 */
node.console.assert = function(expression) {
  return node.console.core_.assert(expression);
};


/**
 * @private
 * @type {*}
 */
node.console.core_ = require("console");