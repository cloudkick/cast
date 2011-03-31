/**
 * @name node.net
 * @namespace
 * The <code>net</code> module provides you with an asynchronous network wrapper. It contains
 * methods for creating both servers and clients (called streams). You can include
 * this module with <code>require("net");</code>
 */

goog.provide("node.net");

/**
 * #### net.isIP(input)
 *
 * Tests if input is an IP address. Returns 0 for invalid strings,
 * returns 4 for IP version 4 addresses, and returns 6 for IP version 6 addresses.
 *
 *
 * #### net.isIPv4(input)
 *
 * Returns true if input is a version 4 IP address, otherwise returns false.
 *
 *
 * #### net.isIPv6(input)
 *
 * Returns true if input is a version 6 IP address, otherwise returns false.
 */
node.net.isIP = function() {
  return node.net.core_.isIP();
};

/**
 * @param {string} input
 */
node.net.isIPv4 = function(input) {
  return node.net.core_.isIPv4(input);
};

/**
 * @param {string} input
 */
node.net.isIPv6 = function(input) {
  return node.net.core_.isIPv6(input);
};

/**
 * Construct a new socket object and opens a socket to the given location. When
 * the socket is established the <code>'connect'</code> event will be emitted.
 *
 * The arguments for this method change the type of connection:
 *
 * * <code>net.createConnection(port, [host])</code>
 *
 *   Creates a TCP connection to <code>port</code> on <code>host</code>. If <code>host</code> is omitted, <code>localhost</code>
 *   will be assumed.
 *
 * * <code>net.createConnection(path)</code>
 *
 *   Creates unix socket connection to <code>path</code>
 *
 * ---
 * @param {string} port
 * @param {string} host
 */
node.net.createConnection = function(port, host) {
  return node.net.core_.createConnection(port, host);
};

/**
 * Creates a new TCP server. The <code>connectionListener</code> argument is
 * automatically set as a listener for the <code>'connection'</code> event.
 */
node.net.createServer = function() {
  return node.net.core_.createServer();
};


/**
 * @private
 * @type {*}
 */
node.net.core_ = require("net");