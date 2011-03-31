
goog.provide("node.assert.AssertionError");

/**
 * @constructor
 */
node.assert.AssertionError = function() {};

/**
 * @type {string|null}
 */
node.assert.AssertionError.prototype.name = null;

/**
 * @type {string|null}
 */
node.assert.AssertionError.prototype.message = null;


/**
 * @private
 * @type {*}
 */
node.assert.AssertionError.core_ = require("assert").AssertionError;