/**
 * @name node.vm
 * @namespace
 * You can access this module with:
 * <pre>
 *     var vm = require('vm');
 * </pre>
 * JavaScript code can be compiled and run immediately or compiled, saved, and run later.
 */

goog.provide("node.vm");

/**
 * <code>createScript</code> compiles <code>code</code> as if it were loaded from <code>filename</code>,
 * but does not run it. Instead, it returns a <code>vm.Script</code> object representing this compiled code.
 * This script can be run later many times using methods below.
 * The returned script is not bound to any global object.
 * It is bound before each run, just for that run. <code>filename</code> is optional.
 *
 * In case of syntax error in <code>code</code>, <code>createScript</code> prints the syntax error to stderr
 * and throws an exception.
 * @param {string} code
 * @param {string} ctx
 * @param {string} name
 */
node.vm.createScript = function(code, ctx, name) {
  return node.vm.core_.createScript(code, ctx, name);
};

/**
 *
 */
node.vm.createContext = function() {
  return node.vm.core_.createContext();
};

/**
 *
 */
node.vm.runInContext = function() {
  return node.vm.core_.runInContext();
};

/**
 * Similar to <code>vm.runInThisContext</code> but a method of a precompiled <code>Script</code> object.
 * <code>script.runInThisContext</code> runs the code of <code>script</code> and returns the result.
 * Running code does not have access to local scope, but does have access to the <code>global</code> object
 * (v8: in actual context).
 *
 * Example of using <code>script.runInThisContext</code> to compile code once and run it multiple times:
 * <pre>
 *     var vm = require('vm');
 *
 *     globalVar = 0;
 *
 *     var script = vm.createScript('globalVar += 1', 'myfile.vm');
 *
 *     for (var i = 0; i < 1000 ; i += 1) {
 *       script.runInThisContext();
 *     }
 *
 *     console.log(globalVar);
 *
 *     &#47;&#47; 1000
 * </pre>
 */
node.vm.runInThisContext = function() {
  return node.vm.core_.runInThisContext();
};

/**
 * Similar to <code>vm.runInNewContext</code> a method of a precompiled <code>Script</code> object.
 * <code>script.runInNewContext</code> runs the code of <code>script</code> with <code>sandbox</code> as the global object and returns the result.
 * Running code does not have access to local scope. <code>sandbox</code> is optional.
 *
 * Example: compile code that increments a global variable and sets one, then execute this code multiple times.
 * These globals are contained in the sandbox.
 * <pre>
 *     var util = require('util'),
 *         vm = require('vm'),
 *         sandbox = {
 *           animal: 'cat',
 *           count: 2
 *         };
 *
 *     var script = vm.createScript('count += 1; name = "kitty"', 'myfile.vm');
 *
 *     for (var i = 0; i < 10 ; i += 1) {
 *       script.runInNewContext(sandbox);
 *     }
 *
 *     console.log(util.inspect(sandbox));
 *
 *     &#47;&#47; { animal: 'cat', count: 12, name: 'kitty' }
 * </pre>
 * Note that running untrusted code is a tricky business requiring great care.  To prevent accidental
 * global variable leakage, <code>script.runInNewContext</code> is quite useful, but safely running untrusted code
 * requires a separate process.
 */
node.vm.runInNewContext = function() {
  return node.vm.core_.runInNewContext();
};


/**
 * @private
 * @type {*}
 */
node.vm.core_ = require("vm");