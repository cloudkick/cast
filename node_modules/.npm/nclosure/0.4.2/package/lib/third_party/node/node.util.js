/**
 * @name node.util
 * @namespace
 * These functions are in the module <code>'util'</code>. Use <code>require('util')</code> to access
 * them.
 */

goog.provide("node.util");

goog.require("node.stream.Stream");

/**
 *
 */
node.util.print = function() {
  return node.util.core_.print();
};

/**
 *
 */
node.util.puts = function() {
  return node.util.core_.puts();
};

/**
 * A synchronous output function. Will block the process and
 * output <code>string</code> immediately to <code>stderr</code>.
 * <pre>
 *     require('util').debug('message on stderr');
 * </pre>
 * @param {string} x
 */
node.util.debug = function(x) {
  return node.util.core_.debug(x);
};

/**
 * @param {string} x
 */
node.util.error = function(x) {
  return node.util.core_.error(x);
};

/**
 * Return a string representation of <code>object</code>, which is useful for debugging.
 *
 * If <code>showHidden</code> is <code>true</code>, then the object's non-enumerable properties will be
 * shown too.
 *
 * If <code>depth</code> is provided, it tells <code>inspect</code> how many times to recurse while
 * formatting the object. This is useful for inspecting large complicated objects.
 *
 * The default is to only recurse twice.  To make it recurse indefinitely, pass
 * in <code>null</code> for <code>depth</code>.
 *
 * Example of inspecting all properties of the <code>util</code> object:
 * <pre>
 *     var util = require('util');
 *
 *     console.log(util.inspect(util, true, null));
 * </pre>
 * @param {Object} obj
 * @param {string} showHidden
 * @param {number} depth
 * @param {string} colors
 */
node.util.inspect = function(obj, showHidden, depth, colors) {
  return node.util.core_.inspect(obj, showHidden, depth, colors);
};

/**
 *
 */
node.util.p = function() {
  return node.util.core_.p();
};

/**
 * Output with timestamp on <code>stdout</code>.
 * <pre>
 *     require('util').log('Timestmaped message.');
 * </pre>
 * @param {string} msg
 */
node.util.log = function(msg) {
  return node.util.core_.log(msg);
};

/**
 *
 */
node.util.exec = function() {
  return node.util.core_.exec();
};

/**
 * Experimental
 *
 * Read the data from <code>readableStream</code> and send it to the <code>writableStream</code>.
 * When <code>writableStream.write(data)</code> returns <code>false</code> <code>readableStream</code> will be
 * paused until the <code>drain</code> event occurs on the <code>writableStream</code>. <code>callback</code> gets
 * an error as its only argument and is called when <code>writableStream</code> is closed or
 * when an error occurs.
 * @param {node.stream.Stream} readStream
 * @param {node.stream.Stream} writeStream
 * @param {function(Error?,...[*]):undefined=} callback
 */
node.util.pump = function(readStream, writeStream, callback) {
  return node.util.core_.pump(readStream, writeStream, callback);
};

/**
 * Inherit the prototype methods from one
 * <a href="node.https:&#47;&#47;developer.mozilla.org&#47;en&#47;JavaScript&#47;Reference&#47;Global<em>Objects&#47;Object&#47;constructor">constructor</a>
 * into another.  The prototype of <code>constructor</code> will be set to a new
 * object created from <code>superConstructor</code>.
 *
 * As an additional convenience, <code>superConstructor</code> will be accessible
 * through the <code>constructor.super</em></code> property.
 * <pre>
 *     var util = require("util");
 *     var events = require("events");
 *
 *     function MyStream() {
 *         events.EventEmitter.call(this);
 *     }
 *
 *     util.inherits(MyStream, events.EventEmitter);
 *
 *     MyStream.prototype.write = function(data) {
 *         this.emit("data", data);
 *     }
 *
 *     var stream = new MyStream();
 *
 *     console.log(stream instanceof events.EventEmitter); &#47;&#47; true
 *     console.log(MyStream.super_ === events.EventEmitter); &#47;&#47; true
 *
 *     stream.on("data", function(data) {
 *         console.log('Received data: "' + data + '"');
 *     })
 *     stream.write("It works!"); &#47;&#47; Received data: "It works!"
 * @param {Function} ctor
 * @param {Function} superCtor
 */
node.util.inherits = function(ctor, superCtor) {
  return node.util.core_.inherits(ctor, superCtor);
};


/**
 * @private
 * @type {*}
 */
node.util.core_ = require("util");