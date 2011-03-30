/**
 * @name node.dns
 * @namespace
 * Use <code>require('dns')</code> to access this module.
 *
 * Here is an example which resolves <code>'www.google.com'</code> then reverse
 * resolves the IP addresses which are returned.
 * <pre>
 *     var dns = require('dns');
 *
 *     dns.resolve4('www.google.com', function (err, addresses) {
 *       if (err) throw err;
 *
 *       console.log('addresses: ' + JSON.stringify(addresses));
 *
 *       addresses.forEach(function (a) {
 *         dns.reverse(a, function (err, domains) {
 *           if (err) {
 *             console.log('reverse for ' + a + ' failed: ' +
 *               err.message);
 *           } else {
 *             console.log('reverse for ' + a + ': ' +
 *               JSON.stringify(domains));
 *           }
 *         });
 *       });
 *     });
 * </pre>
 */

goog.provide("node.dns");

/**
 * @type {string|null}
 */
node.dns.NODATA = null;

/**
 * @type {string|null}
 */
node.dns.FORMERR = null;

/**
 * @type {string|null}
 */
node.dns.BADRESP = null;

/**
 * @type {string|null}
 */
node.dns.NOTFOUND = null;

/**
 * @type {string|null}
 */
node.dns.BADNAME = null;

/**
 * @type {string|null}
 */
node.dns.TIMEOUT = null;

/**
 * @type {string|null}
 */
node.dns.CONNREFUSED = null;

/**
 * @type {string|null}
 */
node.dns.NOMEM = null;

/**
 * @type {string|null}
 */
node.dns.DESTRUCTION = null;

/**
 * @type {string|null}
 */
node.dns.NOTIMP = null;

/**
 * @type {string|null}
 */
node.dns.EREFUSED = null;

/**
 * @type {string|null}
 */
node.dns.SERVFAIL = null;

/**
 * Resolves a domain (e.g. <code>'google.com'</code>) into an array of the record types
 * specified by rrtype. Valid rrtypes are <code>A</code> (IPV4 addresses), <code>AAAA</code> (IPV6
 * addresses), <code>MX</code> (mail exchange records), <code>TXT</code> (text records), <code>SRV</code> (SRV
 * records), and <code>PTR</code> (used for reverse IP lookups).
 *
 * The callback has arguments <code>(err, addresses)</code>.  The type of each item
 * in <code>addresses</code> is determined by the record type, and described in the
 * documentation for the corresponding lookup methods below.
 *
 * On error, <code>err</code> would be an instanceof <code>Error</code> object, where <code>err.errno</code> is
 * one of the error codes listed below and <code>err.message</code> is a string describing
 * the error in English.
 * @param {string} domain
 * @param {string} type_
 * @param {string} callback_
 */
node.dns.resolve = function(domain, type_, callback_) {
  return node.dns.core_.resolve(domain, type_, callback_);
};

/**
 * @param {string} domain
 * @param {string} family
 * @param {function(Error?,...[*]):undefined=} callback
 */
node.dns.getHostByName = function(domain, family, callback) {
  return node.dns.core_.getHostByName(domain, family, callback);
};

/**
 * @param {string} address
 * @param {string} family
 * @param {function(Error?,...[*]):undefined=} callback
 */
node.dns.getHostByAddr = function(address, family, callback) {
  return node.dns.core_.getHostByAddr(address, family, callback);
};

/**
 * Resolves a domain (e.g. <code>'google.com'</code>) into the first found A (IPv4) or
 * AAAA (IPv6) record.
 *
 * The callback has arguments <code>(err, address, family)</code>.  The <code>address</code> argument
 * is a string representation of a IP v4 or v6 address. The <code>family</code> argument
 * is either the integer 4 or 6 and denotes the family of <code>address</code> (not
 * neccessarily the value initially passed to <code>lookup</code>).
 * @param {string} domain
 * @param {string} family
 * @param {function(Error?,...[*]):undefined=} callback
 */
node.dns.lookup = function(domain, family, callback) {
  return node.dns.core_.lookup(domain, family, callback);
};

/**
 * The same as <code>dns.resolve()</code>, but only for IPv4 queries (<code>A</code> records).
 * <code>addresses</code> is an array of IPv4 addresses (e.g.
 * <code>['74.125.79.104', '74.125.79.105', '74.125.79.106']</code>).
 * @param {string} domain
 * @param {function(Error?,...[*]):undefined=} callback
 */
node.dns.resolve4 = function(domain, callback) {
  return node.dns.core_.resolve4(domain, callback);
};

/**
 * The same as <code>dns.resolve4()</code> except for IPv6 queries (an <code>AAAA</code> query).
 * @param {string} domain
 * @param {function(Error?,...[*]):undefined=} callback
 */
node.dns.resolve6 = function(domain, callback) {
  return node.dns.core_.resolve6(domain, callback);
};

/**
 * The same as <code>dns.resolve()</code>, but only for mail exchange queries (<code>MX</code> records).
 *
 * <code>addresses</code> is an array of MX records, each with a priority and an exchange
 * attribute (e.g. <code>[{'priority': 10, 'exchange': 'mx.example.com'},...]</code>).
 * @param {string} domain
 * @param {function(Error?,...[*]):undefined=} callback
 */
node.dns.resolveMx = function(domain, callback) {
  return node.dns.core_.resolveMx(domain, callback);
};

/**
 * The same as <code>dns.resolve()</code>, but only for text queries (<code>TXT</code> records).
 * <code>addresses</code> is an array of the text records available for <code>domain</code> (e.g.,
 * <code>['v=spf1 ip4:0.0.0.0 ~all']</code>).
 * @param {string} domain
 * @param {function(Error?,...[*]):undefined=} callback
 */
node.dns.resolveTxt = function(domain, callback) {
  return node.dns.core_.resolveTxt(domain, callback);
};

/**
 * The same as <code>dns.resolve()</code>, but only for service records (<code>SRV</code> records).
 * <code>addresses</code> is an array of the SRV records available for <code>domain</code>. Properties
 * of SRV records are priority, weight, port, and name (e.g.,
 * <code>[{'priority': 10, {'weight': 5, 'port': 21223, 'name': 'service.example.com'}, ...]</code>).
 * @param {string} domain
 * @param {function(Error?,...[*]):undefined=} callback
 */
node.dns.resolveSrv = function(domain, callback) {
  return node.dns.core_.resolveSrv(domain, callback);
};

/**
 * Reverse resolves an ip address to an array of domain names.
 *
 * The callback has arguments <code>(err, domains)</code>.
 *
 * If there an an error, <code>err</code> will be non-null and an instanceof the Error
 * object.
 *
 * Each DNS query can return an error code.
 *
 * - <code>dns.TEMPFAIL</code>: timeout, SERVFAIL or similar.
 * - <code>dns.PROTOCOL</code>: got garbled reply.
 * - <code>dns.NXDOMAIN</code>: domain does not exists.
 * - <code>dns.NODATA</code>: domain exists but no data of reqd type.
 * - <code>dns.NOMEM</code>: out of memory while processing.
 * - <code>dns.BADQUERY</code>: the query is malformed.
 * @param {string} domain
 * @param {function(Error?,...[*]):undefined=} callback
 */
node.dns.reverse = function(domain, callback) {
  return node.dns.core_.reverse(domain, callback);
};

/**
 * @param {string} domain
 * @param {function(Error?,...[*]):undefined=} callback
 */
node.dns.resolveNs = function(domain, callback) {
  return node.dns.core_.resolveNs(domain, callback);
};

/**
 * @param {string} domain
 * @param {function(Error?,...[*]):undefined=} callback
 */
node.dns.resolveCname = function(domain, callback) {
  return node.dns.core_.resolveCname(domain, callback);
};


/**
 * @private
 * @type {*}
 */
node.dns.core_ = require("dns");