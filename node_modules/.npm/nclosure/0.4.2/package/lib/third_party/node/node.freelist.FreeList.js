
goog.provide("node.freelist.FreeList");

/**
 * @constructor
 */
node.freelist.FreeList = function() {};


/**
 * @private
 * @type {*}
 */
node.freelist.FreeList.core_ = require("freelist").FreeList;