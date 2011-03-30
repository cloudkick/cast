/**
 * @name node.url
 * @namespace
 * This module has utilities for URL resolution and parsing.
 * Call <code>require('url')</code> to use it.
 *
 * Parsed URL objects have some or all of the following fields, depending on
 * whether or not they exist in the URL string. Any parts that are not in the URL
 * string will not be in the parsed object. Examples are shown for the URL
 *
 * <code>'http:&#47;&#47;user:pass@host.com:8080&#47;p&#47;a&#47;t&#47;h?query=string#hash'</code>
 *
 * * <code>href</code>: The full URL that was originally parsed.
 *
 *   Example: <code>'http:&#47;&#47;user:pass@host.com:8080&#47;p&#47;a&#47;t&#47;h?query=string#hash'</code>
 * * <code>protocol</code>: The request protocol.
 *
 *   Example: <code>'http:'</code>
 * * <code>host</code>: The full host portion of the URL, including port and authentication information.
 *
 *   Example: <code>'user:pass@host.com:8080'</code>
 * * <code>auth</code>: The authentication information portion of a URL.
 *
 *   Example: <code>'user:pass'</code>
 * * <code>hostname</code>: Just the hostname portion of the host.
 *
 *   Example: <code>'host.com'</code>
 * * <code>port</code>: The port number portion of the host.
 *
 *   Example: <code>'8080'</code>
 * * <code>pathname</code>: The path section of the URL, that comes after the host and before the query, including the initial slash if present.
 *
 *   Example: <code>'&#47;p&#47;a&#47;t&#47;h'</code>
 * * <code>search</code>: The 'query string' portion of the URL, including the leading question mark.
 *
 *   Example: <code>'?query=string'</code>
 * * <code>query</code>: Either the 'params' portion of the query string, or a querystring-parsed object.
 *
 *   Example: <code>'query=string'</code> or <code>{'query':'string'}</code>
 * * <code>hash</code>: The 'fragment' portion of the URL including the pound-sign.
 *
 *   Example: <code>'#hash'</code>
 *
 * The following methods are provided by the URL module:
 */

goog.provide("node.url");

/**
 * Take a URL string, and return an object.  Pass <code>true</code> as the second argument to also parse
 * the query string using the <code>querystring</code> module.
 * @param {string} url
 * @param {string} parseQueryString
 * @param {string} slashesDenoteHost
 */
node.url.parse = function(url, parseQueryString, slashesDenoteHost) {
  return node.url.core_.parse(url, parseQueryString, slashesDenoteHost);
};

/**
 * Take a base URL, and a href URL, and resolve them as a browser would for an anchor tag.
 * @param {string} source
 * @param {string} relative
 */
node.url.resolve = function(source, relative) {
  return node.url.core_.resolve(source, relative);
};

/**
 * @param {string} source
 * @param {string} relative
 */
node.url.resolveObject = function(source, relative) {
  return node.url.core_.resolveObject(source, relative);
};

/**
 * Take a parsed URL object, and return a formatted URL string.
 * @param {Object} obj
 */
node.url.format = function(obj) {
  return node.url.core_.format(obj);
};


/**
 * @private
 * @type {*}
 */
node.url.core_ = require("url");