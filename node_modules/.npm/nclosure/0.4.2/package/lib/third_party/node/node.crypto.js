/**
 * @name node.crypto
 * @namespace
 * Use <code>require('crypto')</code> to access this module.
 *
 * The crypto module requires OpenSSL to be available on the underlying platform.
 * It offers a way of encapsulating secure credentials to be used as part
 * of a secure HTTPS net or http connection.
 *
 * It also offers a set of wrappers for OpenSSL's hash, hmac, cipher, decipher, sign and verify methods.
 */

goog.provide("node.crypto");

/**
 * Creates a credentials object, with the optional details being a dictionary with keys:
 *
 * * <code>key</code> : a string holding the PEM encoded private key
 * * <code>cert</code> : a string holding the PEM encoded certificate
 * * <code>ca</code> : either a string or list of strings of PEM encoded CA certificates to trust.
 *
 * If no 'ca' details are given, then node.js will use the default publicly trusted list of CAs as given in
 * <http:&#47;&#47;mxr.mozilla.org&#47;mozilla&#47;source&#47;security&#47;nss&#47;lib&#47;ckfw&#47;builtins&#47;certdata.txt>.
 * @param {Object} options
 */
node.crypto.createCredentials = function(options) {
  return node.crypto.core_.createCredentials(options);
};

/**
 * Creates and returns a hash object, a cryptographic hash with the given algorithm
 * which can be used to generate hash digests.
 *
 * <code>algorithm</code> is dependent on the available algorithms supported by the version
 * of OpenSSL on the platform. Examples are <code>'sha1'</code>, <code>'md5'</code>, <code>'sha256'</code>, <code>'sha512'</code>, etc.
 * On recent releases, <code>openssl list-message-digest-algorithms</code> will display the available digest algorithms.
 * @param {string} hash
 */
node.crypto.createHash = function(hash) {
  return node.crypto.core_.createHash(hash);
};

/**
 * Creates and returns a hmac object, a cryptographic hmac with the given algorithm and key.
 *
 * <code>algorithm</code> is dependent on the available algorithms supported by OpenSSL - see createHash above.
 * <code>key</code> is the hmac key to be used.
 * @param {string} hmac
 * @param {string} key
 */
node.crypto.createHmac = function(hmac, key) {
  return node.crypto.core_.createHmac(hmac, key);
};

/**
 * Creates and returns a cipher object, with the given algorithm and key.
 *
 * <code>algorithm</code> is dependent on OpenSSL, examples are <code>'aes192'</code>, etc.
 * On recent releases, <code>openssl list-cipher-algorithms</code> will display the available cipher algorithms.
 * @param {string} cipher
 * @param {string} key
 */
node.crypto.createCipher = function(cipher, key) {
  return node.crypto.core_.createCipher(cipher, key);
};

/**
 * @param {string} cipher
 * @param {string} key
 * @param {string} iv
 */
node.crypto.createCipheriv = function(cipher, key, iv) {
  return node.crypto.core_.createCipheriv(cipher, key, iv);
};

/**
 * Creates and returns a decipher object, with the given algorithm and key.
 * This is the mirror of the cipher object above.
 * @param {string} cipher
 * @param {string} key
 */
node.crypto.createDecipher = function(cipher, key) {
  return node.crypto.core_.createDecipher(cipher, key);
};

/**
 * @param {string} cipher
 * @param {string} key
 * @param {string} iv
 */
node.crypto.createDecipheriv = function(cipher, key, iv) {
  return node.crypto.core_.createDecipheriv(cipher, key, iv);
};

/**
 * Creates and returns a signing object, with the given algorithm.
 * On recent OpenSSL releases, <code>openssl list-public-key-algorithms</code> will display
 * the available signing algorithms. Examples are <code>'RSA-SHA256'</code>.
 * @param {string} algorithm
 */
node.crypto.createSign = function(algorithm) {
  return node.crypto.core_.createSign(algorithm);
};

/**
 * Creates and returns a verification object, with the given algorithm.
 * This is the mirror of the signing object above.
 * @param {string} algorithm
 */
node.crypto.createVerify = function(algorithm) {
  return node.crypto.core_.createVerify(algorithm);
};


/**
 * @private
 * @type {*}
 */
node.crypto.core_ = require("crypto");