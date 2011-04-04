/*
 * Licensed to Cloudkick, Inc ('Cloudkick') under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * Cloudkick licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var http = require('http');
var https = require('https');
var tls = require('tls');
var url = require('url');
var querystring = require('querystring');
var crypto = require('crypto');
var fs = require('fs');

var sprintf = require('sprintf').sprintf;

var version = require('util/version');
var dotfiles = require('util/client_dotfiles');
var misc = require('util/misc');
var log = require('util/log');
var version = require('util/version');
var Errorf = require('util/misc').Errorf;
var config = require('util/config');
var hmac = require('security/hmac');
var misc = require('util/misc');
var constants = require('services/http/constants');

var agentApiVersion = null;
var getRemoteCert;

/**
 * Header indicating cast API version
 */
var API_VERSION_HEADER = 'x-cast-api-version';

function getHttpsAgent(options, fingerprint) {
  var agent = https.getAgent(options);

  if (agent._verifiesFingerprint) {
    return agent;
  }

  var prevGetFn = agent._getConnection;

  agent._getConnection = function(host, port, callback) {
    var s = prevGetFn.call(agent, host, port, function() {
      var cert = s.getPeerCertificate();
      if (!cert) {
        s.emit('error', new Error('Unable to fetch certificate information'));
        return;
      }

      if (cert.fingerprint !== fingerprint) {
        s.emit('error', new Error('Remote fingerprint mismatch'));
        return;
      }

      callback();
      return;
    });
    return s;
  };
  agent._verifiesFingerprint = true;
  return agent;
}

function _baseRequest(remote, options, callback) {
  var conf = config.get();
  var reqFn;

  // Construct the headers object
  var headers = options.headers || {};

  headers = misc.merge(headers, {
    'host': remote.hostname,
    'user-agent': version.toString()
  });

  // Construct the request options
  var reqOptions = {
    'host': remote.hostname,
    'port': remote.port,
    'path': options.path,
    'method': options.method || 'GET',
    'headers': headers
  };

  // Set the HMAC headers
  hmac.createHttpHmac(reqOptions.method, reqOptions.path, headers);

  // Callback we set later to actually perform HTTPS requests
  function doHttpsRequest(err, certText) {
    if (err) {
      callback(err);
      return;
    }

    reqOptions.cert = certText;

    try {
      callback(null, https.request(reqOptions));
    } catch (e) {
      callback(e);
    }
  }

  // Gather all sorts of extra data for HTTPS requests
  if (url.parse(remote.url).protocol === 'https:') {
    if (!conf['ssl_enabled']) {
      callback(new Error('Remote requires SSL support be enabled'));
      return;
    }
    if (!remote.fingerprint) {
      callback(new Error('SSL remote specifies no fingerprint'));
      return;
    }

    // Monkey-patch fingerprint verification onto the https agent
    reqOptions.agent = getHttpsAgent(reqOptions, remote.fingerprint);

    // Set the client key
    reqOptions.key = fs.readFileSync(dotfiles.getClientKeyPath());

    // Either use the provided certificate, or get one for this remote
    if (options.cert) {
      doHttpsRequest(null, options.cert);
    } else {
      getRemoteCert(remote, doHttpsRequest);
    }
  }

  // Perform HTTP requests
  else {
    try {
      callback(null, http.request(reqOptions));
    } catch (e) {
      callback(e);
    }
  }
}


/**
 * Get a certificate for the provided remote (object).
 *
 * Control hops around quite a bit here, so it deserves some explanation. We
 * call dotfiles.loadRemoteCert() which will attempt to load the certificate
 * from disk and pass it back to us directly. If the certificate is not
 * available on disk, it will instead load the corresponding CSR, then call the
 * requestCertificate() function that we provide. This will in turn provide the
 * CA on the remote with the CSR and request the certificate. We pass back
 * whatever we get to the callback provided to requestCert(), which causes
 * (code in) dotfiles.loadRemoteCert() to save the certificate and pass it back
 * through the normal callback chain.
 *
 * @param {Object} remote The remote object to retrieve the certificate for.
 * @param {Function} callback A callback fired with (err, certBuf).
 */
function getRemoteCert(remote, callback) {

  // Request a certificate from the remote using the provided CSR
  function requestCert(csrBuf, certOpts, callback) {

    // For this request, use the client's "default" certificate
    var reqOpts = {
      path: sprintf('/1.0/ca/%s/', certOpts.hostname),
      method: 'PUT',
      cert: fs.readFileSync(dotfiles.getClientCertPath())
    };

    _baseRequest(remote, reqOpts, function(err, req) {
      if (err) {
        callback(err);
        return;
      }

      req.on('error', callback);
      req.on('response', function(res) {
        var data = [];

        res.setEncoding('utf8');
        res.on('data', function(chunk) {
          data.push(chunk);
        });

        res.on('end', function() {
          var body = data.join('');
          var reqStatus;
          try {
            reqStatus = JSON.parse(body);
          } catch (e) {
            callback(new Error('Invalid response from remote\'s CA'));
          }

          if (res.statusCode === 200 || res.statusCode === 202) {
            callback(null, reqStatus.cert);
          } else {
            callback(new Error(reqStatus.message));
          }
        });
      });

      req.write(csrBuf);
      req.end();
    });
  }

  dotfiles.loadRemoteCert(remote, requestCert, callback);
}


/**
 * Get a request for the given remote, falling back to the default remote
 * if the given remote name evaluates to false. The request provided to the
 * callback will have already had its headers sent, but will be still open
 * for ongoing body transmission.
 *
 * @param {String} remoteName The name of the remote to use.
 * @param {Object} options An options object containing 'path' and optionally
 *                         'method' and 'headers'. If no method is specified
 *                         GET will be used.
 * @param {Function} callback A callback called with (err, request).
 */
function buildRequest(remoteName, options, callback) {
  dotfiles.getRemote(remoteName, function(err, remote) {
    if (err) {
      callback(err);
      return;
    }

    _baseRequest(remote, options, callback);
  });
}

/**
 * Connect to the server at the specified https URL (port defaults to 443) get
 * its certificate, then disconnect. The certificate (in the undocumented for
 * that node returns it in, see lib/tls.js) is passed back via the callback.
 * @param {String} remoteUrl The URL to connect to. Protocol must be 'https'.
 * @param {Function} callback A callback fired with (err, cert).
 */
function getServerCertInfo(remoteUrl, callback) {
  var conf = config.get();
  var urlObj = url.parse(remoteUrl);

  if (urlObj.protocol !== 'https:') {
    callback(new Error('Protocol must be https'));
    return;
  }

  if (!conf['ssl_enabled']) {
    callback(new Error('Remote requires SSL support be enabled'));
    return;
  }

  var hostname = urlObj.hostname;
  var port = urlObj.port || '443';

  var opts;
  try {
    opts = {
      key: fs.readFileSync(dotfiles.getClientKeyPath()),
      cert: fs.readFileSync(dotfiles.getClientCertPath())
    };
  } catch (e) {
    if (e.code === 'EBADF') {
      callback(new Errorf('Unable to read \'%s\'', e.path));
    } else {
      callback(e);
    }
    return;
  }

  // This TLS API is completely different from the 'net' one
  var conn = tls.connect(port, hostname, opts, function() {
    var peerCert = conn.getPeerCertificate();
    conn.destroy();

    if (!peerCert) {
      callback(new Error('Unable to fetch certificate information'));
      return;
    }
    else {
      callback(null, peerCert);
      return;
    }
  });

  conn.on('error', function(err) {
    callback(err);
    return;
  });
}

/**
 * Write text to an HTTP response body.
 * @param {http.ServerResponse} res The HTTP response to which to write the text.
 * @param {Number} code The HTTP response code to use.
 * @param {String} type The content-type to use.
 * @param {String} data The data to write to the response body.
 */
function returnText(res, code, type, data) {
  var headers = {
    'Content-Type': type
  };
  headers = misc.merge(constants.BASE_HEADERS, headers);

  res.writeHead(code, headers);
  res.end(data);
}

/**
 * Write JSON to an HTTP response.
 *
 * @param {http.ServerResponse} res The HTTP Response to which to write the data.
 * @param {Integer} code  The HTTP response code to use.
 * @param {Object} data The data to write to the response.
 */
function returnJson(res, code, data) {
  returnText(res, code, 'application/json', JSON.stringify(data));
}

/**
 * Return a JSON formatted error with a response code an an optinoal message.
 *
 * @param {http.ServerResponse} res The HTTP Response to which to write the
 *                                    error.
 * @param {Integer} code  The HTTP response code to use.
 * @param {String} message  An optional error message.
 */
function returnError(res, code, message) {
  var response = {'code': code};
  if (message !== undefined) {
    response.message = message;
  }
  returnJson(res, code, response);
}


/**
 * Get the body of an incoming HTTP request as a string. If maxBytes is
 * exceeded the callback will fire with both an error and the portion of the
 * body received prior to exceeding maxBytes (ie, if maxBytes were 100, 80 had
 * been received, and another 40 came in over the wire, only the original 80
 * bytes would be passed to the callback).
 * @param {http.ServerRequest} req The HTTP server request.
 * @param {Number} maxBytes The maximum number of bytes to accept.
 * @param {Function} callback A callback fired with (err, body).
 */
function acceptBodyString(req, maxBytes, callback) {
  var bytes = 0;
  var body = '';
  req.setEncoding('utf8');

  function onData(chunk) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > maxBytes) {
      req.removeListener('data', onData);
      callback(new Errorf('Body length exceeded %d bytes', maxBytes), body);
    } else {
      body += chunk;
    }
  }

  req.on('data', onData);

  req.on('end', function() {
    callback(null, body);
  });
}

/**
 * Extract querystring parameters from an incoming HTTP request, and make sure
 * that all required parameters are provided.
 * @param {Array} requiredParms A list of required parameters.
 * @param {htt.ServerRequest} req The HTTP request.
 * @param {Function} callback A callback fired with (err, params).
 */
function getParams(requiredParams, req, callback) {
  acceptBodyString(req, 4096, function(err, body) {
    if (err) {
      callback(err);
      return;
    }

    try {
      var params = querystring.parse(body.join(''));
      var missingParams = requiredParams.filter(function(param) {
        return (!params || !params[param]);
      });

      if (missingParams.length > 0) {
        callback(new Error('Missing required parameters: ' + missingParams.join(', ')));
      } else {
        callback(null, params);
      }
    } catch (e) {
      callback(new Error('Error parsing body'));
    }
  });
}

/**
 * Issue a GET or POST request to the specified URL.
 *
 * @param {String} remote name of the remote.
 * @param {String} path to append to the remote prefix.
 * @param {String} method What kind of request to perform (GET / POST / PUT).
 * @param {Boolean} parseJson true to parse the response as JSON.
 * @return {*} Response String if parseJson is false, Object otherwise.
 */
function getResponse(remote, path, method, parseJson, callback) {
  if (!misc.inArray(method, ['GET', 'PUT', 'POST', 'DELETE'])) {
    callback(new Errorf('Invalid method: %s', method));
    return;
  }

  var opts = {
    path: path,
    method: method
  };

  buildRequest(remote, opts, function(err, request) {
    var dataBuffer, data, resultObject;

    if (err) {
      callback(err);
      return;
    }

    resultObject = {'headers': null, 'status_code': null, 'body': null};

    request.on('error', callback);

    request.on('response', function(response) {
      dataBuffer = [];
      response.setEncoding('utf8');

      response.on('error', callback);

      response.on('data', function(chunk) {
        dataBuffer.push(chunk);
      });

      response.on('end', function() {
        data = dataBuffer.join('');
        if (parseJson && data.length > 0) {
          data = JSON.parse(data);
        }
        resultObject.headers = response.headers;
        resultObject.statusCode = response.statusCode;
        resultObject.body = data;
        callback(null, resultObject);
      });
    });

    request.end();
  });
}

/**
 * Issue a GET or POST request to the specified URL and preppend API version
 * before the path name (wrapper around getResponse function).
 *
 * @param {String} remote name of the remote.
 * @param {String} apiVersion API version.
 * @param {String} path to append to the remote prefix.
 * @param {String} method What kind of request to perform (GET / POST / PUT).
 * @param {Boolean} parseJson true to parse the response as JSON.
 * @return {*} Response String if parseJson is false, Object otherwise.
 */
function getApiResponse(remote, apiVersion, path, method, parseJson,
                                    callback) {
  if (!apiVersion) {
    throw new Error('Missing value for the "api_version" argument');
  }

  path = sprintf('/%s%s', apiVersion, path);

  function gotResponse(err, response) {
    if (!err && (response && response.hasOwnProperty('headers') &&
        response.headers[API_VERSION_HEADER])) {
      agentApiVersion = response.headers[API_VERSION_HEADER];
      if ((response.statusCode === 404) && (apiVersion !== agentApiVersion)) {
        err = new Errorf('Agent does not support API version %s', apiVersion);
      }
    }

    callback(err, response);
  }

  return getResponse(remote, path, method, parseJson, gotResponse);
}

/*
Copyright (c) 2010 Tim Caswell <tim@creationix.com>

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

 Logify function is from node-router.js:
  <http://github.com/creationix/node-router/blob/master/lib/node-router.js>
*/
// Modifies req and res to call logger with a log line on each res.end
// Think of it as "middleware"
function logify(req, res, logger) {
  if (req.alreadyHaveLogify) {
    return;
  }
  req.alreadyHaveLogify = true;
  var end = res.end;
  res.end = function() {
    // Common Log Format (mostly)
    logger((req.socket && req.socket.remoteAddress) + ' - - [' + (new Date()).toUTCString() + ']' +
     ' \"' + req.method + ' ' + req.url +
     ' HTTP/' + req.httpVersionMajor + '.' + req.httpVersionMinor + '\" ' +
     res.statusCode + ' - \"' +
     (req.headers.referer || '') + '\" \"' + (req.headers['user-agent'] ? req.headers['user-agent'].split(' ')[0] : '') + '\"');
    return end.apply(this, arguments);
  };

  var writeHead = res.writeHead;
  res.writeHead = function(code) {
    res.statusCode = code;
    return writeHead.apply(this, arguments);
  };
}

function server(func) {
  // TODO: Make this async?
  var conf = config.get();
  var sslOpts;

  function authed(req, res) {
    logify(req, res, log.debug);

    // TODO: Find a better way to do this
    var isCSRUpload = req.method === 'PUT' && req.url.match('^/1.0/ca/(.+)/$');
    var socket = conf['ssl_enabled'] ?
        req.client.pair.cleartext.socket : req.socket;
    var clientIP = socket.remoteAddress;
    var ct;

    if (conf['ssl_enabled']) {
      ct = req.client.pair.cleartext;

      if (isCSRUpload) {
        // CSR uploads are allowed through with an invalid certificate
        log.info(sprintf('Received CSR request from %s', clientIP));
      } else if (conf['verify_client_cert'] && !ct.authorized) {
        // Other requests may not proceed with an invalid certificate
        log.info(sprintf('Invalid certificate from %s', clientIP));

        if (conf['warn_unauthorized']) {
          // Be nice, tell the client what went wrong
          returnJson(res, 401, {
            'message': 'Certificate verification error: ' + ct.authorizationError
          });
        } else {
          // Silent rejection
          req.destroy();
        }

        return;
      }
    }

    if (!hmac.validateHttpHmac(req.method, req.url, req.headers)) {
      // Verify request HMAC
      log.info(sprintf('Invalid HMAC from %s', ct.socket.remoteAddress));
      returnJson(res, 401, {
        'message': 'HMAC verification failed.'
      });
      return;
    }

    return func(req, res);
  }

  if (conf['ssl_enabled']) {
    sslOpts = {
      key: fs.readFileSync(conf['ssl_key']),
      cert: fs.readFileSync(conf['ssl_cert']),
      ca: fs.readFileSync(conf['ssl_ca_cert']),
      requestCert: true,
      rejectUnauthorized: false
    };
    return https.createServer(sslOpts, authed);
  } else {
    return http.createServer(authed);
  }
}

exports.getHttpsAgent = getHttpsAgent;
exports._baseRequest = _baseRequest;
exports.getRemoteCert = getRemoteCert;
exports.buildRequest = buildRequest;
exports.getServerCertInfo = getServerCertInfo;
exports.returnText = returnText;
exports.returnJson = returnJson;
exports.returnError = returnError;
exports.acceptBodyString = acceptBodyString;
exports.getParams = getParams;
exports.getResponse = getResponse;
exports.getApiResponse = getApiResponse;
exports.logify = logify;
exports.server = server;
