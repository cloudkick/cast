/**
 * @name node.http
 * @namespace
 * To use the HTTP server and client one must <code>require('http')</code>.
 *
 * The HTTP interfaces in Node are designed to support many features
 * of the protocol which have been traditionally difficult to use.
 * In particular, large, possibly chunk-encoded, messages. The interface is
 * careful to never buffer entire requests or responses--the
 * user is able to stream data.
 *
 * HTTP message headers are represented by an object like this:
 * <pre>
 *     { 'content-length': '123',
 *       'content-type': 'text&#47;plain',
 *       'connection': 'keep-alive',
 *       'accept': '*&#47;*' }
 * </pre>
 * Keys are lowercased. Values are not modified.
 *
 * In order to support the full spectrum of possible HTTP applications, Node's
 * HTTP API is very low-level. It deals with stream handling and message
 * parsing only. It parses a message into headers and body but it does not
 * parse the actual headers or the body.
 */

goog.provide("node.http");

goog.require("node.http.ClientRequest");
goog.require("node.http.ServerResponse");
goog.require("node.http.Server");

/**
 * @type {string|null}
 */
node.http.parsers = null;

/**
 * @type {string|null}
 */
node.http.STATUS_CODES = null;

/**
 * @param {function(node.http.ClientRequest,node.http.ServerResponse):undefined} requestListener
 * @return {node.http.Server}
 */
node.http.createServer = function(requestListener) {
  return node.http.core_.createServer(requestListener);
};

/**
 * @param {string} host
 * @param {string} port
 */
node.http.getAgent = function(host, port) {
  return node.http.core_.getAgent(host, port);
};

/**
 * @param {Object} options
 * @param {function(Error?,...[*]):undefined=} cb
 */
node.http.request = function(options, cb) {
  return node.http.core_.request(options, cb);
};

/**
 * @param {Object} options
 * @param {function(Error?,...[*]):undefined=} cb
 */
node.http.get = function(options, cb) {
  return node.http.core_.get(options, cb);
};

/**
 * @param {string} port
 * @param {string} host
 */
node.http.createClient = function(port, host) {
  return node.http.core_.createClient(port, host);
};

/**
 * @param {string} url
 * @param {string} encoding_
 * @param {string} headers_
 */
node.http.cat = function(url, encoding_, headers_) {
  return node.http.core_.cat(url, encoding_, headers_);
};


/**
 * @private
 * @type {*}
 */
node.http.core_ = require("http");