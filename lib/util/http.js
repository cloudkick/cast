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
var os = require('os');
var querystring = require('querystring');
var crypto = require('crypto');
var fs = require('fs');
var constants = require('constants');

var sprintf = require('sprintf').sprintf;
var async = require('async');

var version = require('util/version');
var dotfiles = require('util/client_dotfiles');
var misc = require('util/misc');
var log = require('util/log');
var version = require('util/version');
var Errorf = require('util/misc').Errorf;
var config = require('util/config');
var hmac = require('security/hmac');
var misc = require('util/misc');
var getopt = require('util/getopt');
var httpConstants = require('http/constants');
var certgen = require('security/certgen');
var flowCtrl = require('util/flow_control');
var agentManagers = require('cast-agent/managers');
var jobs = require('jobs');

var ServerError = misc.ServerError;

var agentApiVersion = null;
var getRemoteCert;

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
  if (conf['secret']) {
    hmac.createHttpHmac(reqOptions.method, reqOptions.path, headers);
  }

  function reqTimeoutHandler(req) {
    var err = new Error('ETIMEDOUT, Operation timed out');
    err.errno = constants.ETIMEDOUT;

    try {
      req.socket.destroy(err);
    }
    catch (e) {}
  }

  function setReqTimeout(req, timeout) {
    if (misc.getOs() === 'freebsd') {
      // @TODO: Remove this when ECONNREFUSED is properly thrown on FreeBSD
      var timeoutId = setTimeout(async.apply(reqTimeoutHandler, req), timeout);
      req.on('response', async.apply(clearTimeout, timeoutId));
      req.on('error', async.apply(clearTimeout, timeoutId));
    }
  }


  // Callback we set later to actually perform HTTPS requests
  function doHttpsRequest(err, certText) {
    if (err) {
      callback(err);
      return;
    }

    reqOptions.cert = certText;

    try {
      var req = https.request(reqOptions);
      setReqTimeout(req, 4000);
      callback(null, req);
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
      var req = http.request(reqOptions);
      setReqTimeout(req, 4000);
      callback(null, req);
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
  var clientCert = fs.readFileSync(dotfiles.getClientCertPath());

  function acceptBodyString(msg, callback) {
    var body = '';
    msg.setEncoding('utf8');

    msg.on('data', function onData(chunk) {
      body += chunk;
    });

    msg.on('end', function() {
      callback(body);
    });
  }

  function uploadCSR(csrBuf, certOpts, callback) {
    var reqOpts = {
      path: sprintf('/1.0/ca/%s/', certOpts.hostname),
      method: 'PUT',
      cert: clientCert
    };

    _baseRequest(remote, reqOpts, function(err, req) {
      if (err) {
        callback(err);
        return;
      }

      req.on('error', callback);
      req.on('response', function(res) {

        acceptBodyString(res, function(body) {
          var reqStatus;

          try {
            reqStatus = JSON.parse(body);
          } catch (e) {
            callback(new Error('Invalid response from remote\'s CA'));
            return;
          }

          if (res.statusCode !== 200) {
            callback(new Error(reqStatus.message));
          } else {
            callback();
          }
        });
      });

      req.end(csrBuf);
    });
  }

  function requestCert(csrBuf, certOpts, callback) {
    var reqOpts = {
      path: sprintf('/1.0/ca/%s/', certOpts.hostname),
      method: 'GET',
      cert: fs.readFileSync(dotfiles.getClientCertPath())
    };

    _baseRequest(remote, reqOpts, function(err, req) {
      if (err) {
        callback(err);
        return;
      }

      req.on('error', callback);
      req.on('response', function(res) {
        res.setEncoding('utf8');
        acceptBodyString(res, function(body) {
          var reqStatus;

          try {
            reqStatus = JSON.parse(body);
          } catch (e) {
            callback(new Error('Invalid response from remote\'s CA'));
            return;
          }

          if (res.statusCode === 404) {
            uploadCSR(csrBuf, certOpts, callback);
          } else if (res.statusCode !== 200) {
            callback(new Error(reqStatus.message));
          } else if (!reqStatus.cert) {
            callback(new Error('Request not yet signed'));
          } else {
            callback(null, reqStatus.cert);
          }
        });
      });

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
    'Content-Type': type || 'text/plain'
  };
  headers = misc.merge(httpConstants.BASE_HEADERS, headers);

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
  var conf = config.get();
  var indent = conf['pretty_json'] ? 4 : undefined;
  returnText(res, code, 'application/json', JSON.stringify(data, null, indent));
}

/**
 * Return a JSON formatted error with a response code and an optional message.
 *
 * @param {http.ServerResponse} res The HTTP Response to write the error to.
 * @param {Error} err The Error object to return information from.
 * @param {Integer} code The (optional) HTTP response code to use.
 */
function returnError(res, err, code) {
  code = code || err.responseCode || 500;

  var options = getopt.getOptions();
  var response = {
    code: code,
    message: err.message
  };

  if (options.debug === true) {
    // Some errors have worthless stack traces, so we try to replace them.
    if (!err.stack || err.stack.indexOf('\n') === -1) {
      err = new Error(err.message);
    }
    response.err = err;
  }

  returnJson(res, code, response);
}

/**
 * Serialize an object that Swiz knows about to a response. Only use this in
 * the agent.
 * @param {http.ServerResponse} res The HTTP Response to which to write.
 * @param {Object} obj The object to serialize.
 */
function returnSwiz(res, obj) {
  var serializer = agentManagers.getSerializer();
  serializer.buildObject(obj, function(err, frozenObj) {
    if (err) {
      returnError(res, err);
    } else {
      returnText(res, 200, 'application/json',
                  serializer.serializeJson(frozenObj));
    }
  });
}

/**
 * Construct an http handler that wraps a specified function call.
 * @param {Function} fn The function to be wrapped.
 * @param {Array} paramNames Names of req params that should be passed to fn.
 */
function wrapCall(fn, paramNames) {
  paramNames = paramNames || [];

  return function wrapped(req, res)  {
    var args = paramNames.map(function(name) {
      return req.params[name];
    });

    args.push(function(err, data) {
      if (err) {
        returnError(res, err);
      } else {
        returnJson(res, 200, data);
      }
    });

    fn.apply(null, args);
  };
}

/**
 * Return a job once it emits a 'ready' event, or 404 if it returns an error.
 * @param {http.ServerResponse} res The HTTP Response to which to write the job.
 * @param {jobs.Job} job The Job to return.
 */
function returnReadyJob(res, job) {
  // This is a horrible hack for jslint
  var onReady, onError;

  onReady = function() {
    job.removeListener('error', onError);
    returnSwiz(res, job);
  };

  onError = function(err) {
    job.removeListener('ready', onReady);
    returnError(res, err);
  };

  job.once('ready', onReady);
  job.once('error', onError);
}

/**
 * Return a job once it emits a 'success' or 'error' event.
 * @param {http.ServerResponse} res The HTTP Response to which to write the job.
 * @param {jobs.Job} job The Job to return.
 */
function returnCompletedJob(res, job) {
  function onEither() {
    job.removeListener('success', onEither);
    job.removeListener('error', onEither);
    returnSwiz(res, job);
  }

  if (job.status === 'completed' || job.status === 'error') {
    returnSwiz(res, job);
  } else {
    job.on('success', onEither);
    job.on('error', onEither);
  }
}

/**
 * Issue an HTTP request to the specified URL.
 *
 * @param {String} remote name of the remote.
 * @param {String} path to append to the remote prefix.
 * @param {String} method What kind of request to perform (GET / POST / PUT) /
 *                                                         DELETE).
 * @param {?String} body Optional body to send with the request.
 * @param {Boolean} parseJson true to parse the response as JSON.
 * @return {*} Response String if parseJson is false, Object otherwise.
 */
function getResponse(remote, path, method, body, parseJson, callback) {
  if (!misc.inArray(method, ['GET', 'PUT', 'POST', 'DELETE'])) {
    callback(new Errorf('Invalid method: %s', method));
    return;
  }

  var opts = {
    path: path,
    method: method
  };

  if (body) {
    opts.headers = {
      'content-type': 'application/x-www-form-urlencoded',
      'content-length': body.length
    };
  }

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
          try {
            data = JSON.parse(data);
          }
          catch (err) {
            callback(err);
            return;
          }
        }

        resultObject.headers = response.headers;
        resultObject.statusCode = response.statusCode;
        resultObject.body = data;
        callback(null, resultObject);
      });
    });

    request.end(body);
  });
}

/**
 * Issue an HTTP request to the specified URL and preppend API version
 * before the path name (wrapper around getResponse function).
 *
 * @param {String} path to append to the remote prefix.
 * @param {String} method What kind of request to perform (GET / POST / PUT /
 *                        DELETE).
 * @param {?String} body Optional body to send with the request.
 * @param {Object} options Options object with the following keys:
 * {String} remote name of the remote to use.
 * {String} apiVersion API version.
 * {Boolean} parseJson true to parse the response as JSON.
 * {Array} expectedStatusCodes Optional expected status codes. If the
 * @param {Function} callback Callback which is called with (err, response).
 */
function getApiResponse(path, method, body, options, callback) {
  var remote, apiVersion, parseJson, expectedStatusCodes;

  if (typeof body === 'object' && typeof options === 'function') {
    callback = options;
    options = body;
    body = null;
  }

  options = options || {};
  options.parseJson = options.parseJson || false;
  options.expectedStatusCodes = options.expectedStatusCodes || null;

  remote = options.remote;
  apiVersion = options.apiVersion;
  parseJson = options.parseJson;
  expectedStatusCodes = options.expectedStatusCodes;

  if (!apiVersion) {
    callback(new Error('Missing value for the "options.apiVersion" argument'));
    return;
  }

  if (path.charAt(0) !== '/') {
    path = sprintf('/%s', path);
  }

  path = sprintf('/%s%s', apiVersion, path);

  function gotResponse(err, response) {
    if (!err && (response && response.hasOwnProperty('headers') &&
        response.headers[httpConstants.API_VERSION_HEADER])) {
      agentApiVersion = response.headers[httpConstants.API_VERSION_HEADER];
      if ((response.statusCode === 404) && (apiVersion !== agentApiVersion)) {
        err = new Errorf('Agent does not support API version %s', apiVersion);
      }
    }

    if (err) {
      callback(err);
    }
    else {
      if (expectedStatusCodes && expectedStatusCodes.indexOf(response.statusCode) === -1) {
        if (parseJson && response.body.message) {
          err = new ServerError(response.body.message);
        }
        else {
          err = new ServerError('Unexpected status code: %s', response.statusCode);
        }

        if (response.body.hasOwnProperty('err') && response.body.err.stack) {
          err.stack = response.body.err.stack;
        }
      }
      else {
        err = null;
      }

      callback(err, response);
    }
  }

  getResponse(remote, path, method, body, parseJson, gotResponse);
  return;
}


/**
 * Perform the specified task, and wait for the remote job to complete.
 * Upon (successful) completion pass back the 'result' from the job.
 * @param {String} remoteName The name of the remote to use.
 * @param {String} path The remote path to operate on.
 * @param {String} method The method to perform on the path.
 * @param {String} body An (optional) body to use with the request.
 * @param {Function} callback A callback fired with (err, result).
 */
function executeRemoteJob(remoteName, path, method, body, callback) {
  if (!callback) {
    callback = body;
    body = '';
  }

  var result = null;
  var options = {
    remote: remoteName,
    apiVersion: '1.0',
    expectedStatusCodes: [200],
    parseJson: true
  };

  function submitJob(callback) {
    getApiResponse(path, method, body, options, function(err, response) {
      if (err) {
        callback(err);
      } else {
        callback(null, response.body);
      }
    });
  }

  function awaitCompletion(job, callback) {
    var jobPath = sprintf('/jobs/%s/wait/', job.id);
    getApiResponse(jobPath, 'GET', options, function(err, response) {
      if (err) {
        callback(err);
      } else {
        callback(null, response.body);
      }
    });
  }

  function store(job, callback) {
    var err;

    if (!job || !job.result || !job.result.type) {
      callback(new ServerError('Unexpected response'));
    } else if (job.result.type === 'error') {
      err = new ServerError(job.result.data.message);
      if (job.result.data.stack) {
        err.stack = job.result.data.stack;
      }
      callback(err);
    } else {
      result = job.result;
      callback();
    }
  }

  function doCallback(err) {
    if (err) {
      callback(err);
    } else {
      callback(null, result.data);
    }
  }

  async.waterfall([submitJob, awaitCompletion, store], doCallback);
}


exports.getHttpsAgent = getHttpsAgent;
exports._baseRequest = _baseRequest;
exports.getRemoteCert = getRemoteCert;
exports.buildRequest = buildRequest;
exports.getServerCertInfo = getServerCertInfo;
exports.returnText = returnText;
exports.returnJson = returnJson;
exports.returnError = returnError;
exports.returnSwiz = returnSwiz;
exports.wrapCall = wrapCall;
exports.returnReadyJob = returnReadyJob;
exports.returnCompletedJob = returnCompletedJob;
exports.getResponse = getResponse;
exports.getApiResponse = getApiResponse;
exports.executeRemoteJob = executeRemoteJob;
