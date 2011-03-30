/**
 * @name node.dgram
 * @namespace
 * Datagram sockets are available through <code>require('dgram')</code>.  Datagrams are most commonly
 * handled as IP&#47;UDP messages but they can also be used over Unix domain sockets.
 */

goog.provide("node.dgram");

/**
 * Creates a datagram socket of the specified types.  Valid types are:
 * <code>udp4</code>, <code>udp6</code>, and <code>unix_dgram</code>.
 *
 * Takes an optional callback which is added as a listener for <code>message</code> events.
 * @param {string} type
 * @param {string} listener
 */
node.dgram.createSocket = function(type, listener) {
  return node.dgram.core_.createSocket(type, listener);
};


/**
 * @private
 * @type {*}
 */
node.dgram.core_ = require("dgram");