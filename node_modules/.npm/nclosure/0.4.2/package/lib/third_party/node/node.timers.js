/**
 * @name node.timers
 * @namespace
 */

goog.provide("node.timers");

/**
 * @param {string} item
 */
node.timers.unenroll = function(item) {
  return node.timers.core_.unenroll(item);
};

/**
 * @param {string} item
 * @param {string} msecs
 */
node.timers.enroll = function(item, msecs) {
  return node.timers.core_.enroll(item, msecs);
};

/**
 * @param {string} item
 */
node.timers.active = function(item) {
  return node.timers.core_.active(item);
};

/**
 * To schedule execution of <code>callback</code> after <code>delay</code> milliseconds. Returns a
 * <code>timeoutId</code> for possible use with <code>clearTimeout()</code>. Optionally, you can
 * also pass arguments to the callback.
 * @param {function(Error?,...[*]):undefined=} callback
 * @param {string} after
 */
node.timers.setTimeout = function(callback, after) {
  return node.timers.core_.setTimeout(callback, after);
};

/**
 * Prevents a timeout from triggering.
 * @param {string} timer
 */
node.timers.clearTimeout = function(timer) {
  return node.timers.core_.clearTimeout(timer);
};

/**
 * To schedule the repeated execution of <code>callback</code> every <code>delay</code> milliseconds.
 * Returns a <code>intervalId</code> for possible use with <code>clearInterval()</code>. Optionally,
 * you can also pass arguments to the callback.
 * @param {function(Error?,...[*]):undefined=} callback
 * @param {string} repeat
 */
node.timers.setInterval = function(callback, repeat) {
  return node.timers.core_.setInterval(callback, repeat);
};

/**
 * Stops a interval from triggering.
 * @param {string} timer
 */
node.timers.clearInterval = function(timer) {
  return node.timers.core_.clearInterval(timer);
};


/**
 * @private
 * @type {*}
 */
node.timers.core_ = require("timers");