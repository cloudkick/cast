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

var sprintf = require('extern/sprintf').sprintf;

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

exports._baseRequest = function(remote, options, callback) {
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
    reqFn = https.request;
  }
  else {
    reqFn = http.request;
  }

  try {
    callback(null, reqFn(reqOptions));
    return;
  }
  catch (e) {
    callback(e);
    return;
  }
};

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
exports.buildRequest = function(remoteName, options, callback) {
  dotfiles.getRemote(remoteName, function(err, remote) {
    if (err) {
      callback(err);
      return;
    }

    exports._baseRequest(remote, options, callback);
  });
};

exports.getServerCertInfo = function(remoteUrl, callback) {
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
};

/**
 * Write JSON to an HTTP response.
 *
 * @param {http.ServerResponse} res The HTTP Response to which to write the data.
 * @param {Integer} code  The HTTP response code to use.
 * @param {Object} data The data to write to the response.
 */
exports.returnJson = function(res, code, data) {
  var headers = { 'Content-Type': 'application/json' };
  headers = misc.merge(constants.BASE_HEADERS, headers);

  res.writeHead(code, headers);
  res.end(JSON.stringify(data));
};

/**
 * Return a JSON formatted error with a response code an an optinoal message.
 *
 * @param {http.ServerResponse} res The HTTP Response to which to write the
 *                                    error.
 * @param {Integer} code  The HTTP response code to use.
 * @param {String} message  An optional error message.
 */
exports.returnError = function(res, code, message) {
  var response = {'code': code};
  if (message !== undefined) {
    response.message = message;
  }
  exports.returnJson(res, code, response);
};


exports.getParams = function(requiredParams, req, callback) {
  var body = [];
  req.on('data', function(chunk) {
    body.push(chunk);
  });

  req.on('end', function() {
    try {
      var params = querystring.parse(body.join(''));
      var missingParams = requiredParams.filter(function(param) {
        if (!params || !params[param]) {
          return true;
        }
        else {
          return false;
        }
      });

      if (missingParams.length > 0) {
        callback(new Error('Missing required parameters: ' + missingParams.join(', ')));
        return;
      }
      else {
        callback(null, params);
        return;
      }
    }
    catch (e) {
      callback(new Error('Error parsing body'));
      return;
    }
  });
};

/**
 * Issue a GET or POST request to the specified URL.
 *
 * @param {String} remote name of the remote.
 * @param {String} path to append to the remote prefix.
 * @param {String} method What kind of request to perform (GET / POST / PUT).
 * @param {Boolean} parseJson true to parse the response as JSON.
 * @return {*} Response String if parseJson is false, Object otherwise.
 */
exports.getResponse = function(remote, path, method, parseJson, callback) {
  if (!misc.inArray(method, ['GET', 'PUT', 'POST', 'DELETE'])) {
    callback(new Errorf('Invalid method: %s', method));
    return;
  }

  var opts = {
    path: path,
    method: method
  };

  exports.buildRequest(remote, opts, function(err, request) {
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
};

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
exports.getApiResponse = function(remote, apiVersion, path, method, parseJson,
                                    callback) {
  if (!apiVersion) {
    throw new Error('Missing value for the "api_version" argument');
  }

  path = sprintf('/%s%s', apiVersion, path);

  var getResponse = function(err, response) {
    agentApiVersion = response.headers['x-cast-api-version'];

    if (!err && response && agentApiVersion) {
      if ((response.statusCode === 404) && (apiVersion !== agentApiVersion)) {
        err = new Errorf('Agent does not support API version %s', apiVersion);
      }
    }

    callback(err, response);
  };

  return exports.getResponse(remote, path, method, parseJson, getResponse);
};

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

exports.server = function(func) {
  // TODO: Make this async?
  var conf = config.get();
  var sslOpts;

  var authed = function(req, res) {
    logify(req, res, log.debug);
    var hmacResult = hmac.validateHttpHmac(req.method, req.url, req.headers);
    if (!hmacResult) {
      exports.returnJson(res, 401, {'message': 'Authentication failed.'});
      return;
    }
    return func(req, res);
  };

  if (conf['ssl_enabled']) {
    sslOpts = {
      key: fs.readFileSync(conf['ssl_key']),
      cert: fs.readFileSync(conf['ssl_cert'])
    };
    return https.createServer(sslOpts, authed);
  }
  else {
    return http.createServer(authed);
  }
};
