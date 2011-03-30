/**
 * @fileoverview This is only here because goog.js needs this and it does not
 * support the goog.require syntax as goog is not loaded yet.
 *
 * @externs
 */

/** @type {Object} */
var exports;

/** @type {function(string):*} */
var require = function() {};

/** @type {Object} */
var global = {};

/** @type {string} */
var __dirname;

/** @type {string} */
var __filename;

/** @type {Object} */
var console = {
  /** @type {function(string)} */
  error: {},
  /** @type {function(string)} */
  log: {},
  /** @type {function(*)} */
  dir: {}
};

/** @type {Object} */
var process = {
  on: function(event, callback) {},
  binding: {
    Script: {
      runInThisContext: function(content, filename) {},
      runInNewContext: function(content, sandbox, filename) {}
    }
  },
  /** @type {Array.<string>} */
  argv:[]
};

/** @type {Object} */
var module;