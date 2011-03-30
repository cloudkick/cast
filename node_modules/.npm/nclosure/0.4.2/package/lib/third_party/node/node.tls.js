/**
 * @name node.tls
 * @namespace
 * Use <code>require('tls')</code> to access this module.
 *
 * The <code>tls</code> module uses OpenSSL to provide Transport Layer Security and&#47;or
 * Secure Socket Layer: encrypted stream communication.
 *
 * TLS&#47;SSL is a public&#47;private key infrastructure. Each client and each
 * server must have a private key. A private key is created like this
 * <pre>
 *     openssl genrsa -out ryans-key.pem 1024
 * </pre>
 * All severs and some clients need to have a certificate. Certificates are public
 * keys signed by a Certificate Authority or self-signed. The first step to
 * getting a certificate is to create a "Certificate Signing Request" (CSR)
 * file. This is done with:
 * <pre>
 *     openssl req -new -key ryans-key.pem -out ryans-csr.pem
 * </pre>
 * To create a self-signed certificate with the CSR, do this:
 * <pre>
 *     openssl x509 -req -in ryans-csr.pem -signkey ryans-key.pem -out ryans-cert.pem
 * </pre>
 * Alternatively you can send the CSR to a Certificate Authority for signing.
 *
 * (TODO: docs on creating a CA, for now interested users should just look at
 * <code>test&#47;fixtures&#47;keys&#47;Makefile</code> in the Node source code)
 */

goog.provide("node.tls");

/**
 * @param {string} credentials
 * @param {boolean} isServer
 * @param {string} requestCert
 * @param {string} rejectUnauthorized
 */
node.tls.createSecurePair = function(credentials, isServer, requestCert, rejectUnauthorized) {
  return node.tls.core_.createSecurePair(credentials, isServer, requestCert, rejectUnauthorized);
};

/**
 * @param {Object} options
 * @param {string} listener
 */
node.tls.createServer = function(options, listener) {
  return node.tls.core_.createServer(options, listener);
};

/**
 * Creates a new client connection to the given <code>port</code> and <code>host</code>. (If <code>host</code>
 * defaults to <code>localhost</code>.) <code>options</code> should be an object which specifies
 *
 *   - <code>key</code>: A string or <code>Buffer</code> containing the private key of the server in
 *     PEM format. (Required)
 *
 *   - <code>cert</code>: A string or <code>Buffer</code> containing the certificate key of the server in
 *     PEM format.
 *
 *   - <code>ca</code>: An array of strings or <code>Buffer</code>s of trusted certificates. If this is
 *     omitted several well known "root" CAs will be used, like VeriSign.
 *     These are used to authorize connections.
 *
 * <code>tls.connect()</code> returns a cleartext <code>CryptoStream</code> object.
 *
 * After the TLS&#47;SSL handshake the <code>callback</code> is called. The <code>callback</code> will be
 * called no matter if the server's certificate was authorized or not. It is up
 * to the user to test <code>s.authorized</code> to see if the server certificate was
 * signed by one of the specified CAs. If <code>s.authorized === false</code> then the error
 * can be found in <code>s.authorizationError</code>.
 * @param {string} port
 * @param {Object} options
 * @param {function(Error?,...[*]):undefined=} cb
 */
node.tls.connect = function(port, options, cb) {
  return node.tls.core_.connect(port, options, cb);
};


/**
 * @private
 * @type {*}
 */
node.tls.core_ = require("tls");