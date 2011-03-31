
goog.provide("node.vm.Script");

/**
 * @constructor
 */
node.vm.Script = function() {};

/**
 *
 */
node.vm.Script.prototype.createContext = function() {
  return node.vm.Script.core_.createContext();
};

/**
 *
 */
node.vm.Script.prototype.runInContext = function() {
  return node.vm.Script.core_.runInContext();
};

/**
 *
 */
node.vm.Script.prototype.runInThisContext = function() {
  return node.vm.Script.core_.runInThisContext();
};

/**
 *
 */
node.vm.Script.prototype.runInNewContext = function() {
  return node.vm.Script.core_.runInNewContext();
};


/**
 * @private
 * @type {*}
 */
node.vm.Script.core_ = require("vm").Script;