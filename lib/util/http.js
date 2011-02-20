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

var url = require('url');
var querystring = require('querystring');

var version = require('util/version');
var dotfiles = require('util/client_dotfiles');
var http = require('http');
var https = require('https');
var misc = require('util/misc');
var fs = require('fs');
var log = require('util/log');
var version = require('util/version');
var crypto = require('crypto');
var Errorf = require('util/misc').Errorf;
var config = require('util/config');
var hmac = require('security/hmac');

exports._base_request = function(remote, options, callback) {
  var conf = config.get();

  // Construct the headers object
  var headers = options.headers || {};

  headers = misc.merge(headers, {
    'host': remote.hostname,
    'user-agent': version.toString()
  });

  // Construct the request options
  var req_options = {
    'host': remote.hostname,
    'port': remote.port,
    'path': options.path,
    'method': options.method || 'GET',
    'headers': headers
  };

  // Set the HMAC headers
  hmac.create_http_hmac(req_options.method, req_options.path, headers);

  if (conf.ssl_enabled) {
    throw new Error('SSL Support Not Implemented Yet');
    // TODO: Finish this
    // TOOD: SSL verify fingerprint
    //var sslcontext = crypto.createCredentials({method: 'TLSv1_client_method'});
    //sslcontext.context.setCiphers(conf.ssl_ciphers);
    //client = http.createClient(port, host, true, sslcontext);
  }
  else {
    try {
      return callback(null, http.request(req_options));
    }
    catch (e) {
      return callback(e);
    }
  }
};

/**
 * Get a request for the given remote, falling back to the default remote
 * if the given remote name evaluates to false. The request provided to the
 * callback will have already had its headers sent, but will be still open
 * for ongoing body transmission.
 *
 * @param {String} remote_name The name of the remote to use
 * @param {Object} options An options object containing 'path' and optionally
 *                         'method' and 'headers'. If no method is specified
 *                         GET will be used.
 * @param {Function} callback A callback called with (err, request)
 */
exports.build_request = function(remote_name, options, callback) {
  dotfiles.get_remote(remote_name, function(err, remote) {
    if (err) {
      return callback(err);
    }

    exports._base_request(remote, options, callback);
  });
};

exports.get_server_ssl_cert_info = function(remote_url, callback) {
  var conf = config.get();
  var callback_called = false;
  var url_object = url.parse(remote_url);

  if (url_object.protocol !== 'https:') {
    callback(new Error('Protocol must be https'));
    return;
  }

  var port = url_object.port || '443';
  var hostname = url_object.hostname;

  var sslcontext = crypto.createCredentials({method: 'TLSv1_client_method'});
  sslcontext.context.setCiphers(conf.ssl_ciphers);

  var client = http.createClient(port, hostname, true, sslcontext);
  var request = client.request('HEAD', '/');

  request.on('response', function(response) {
    var peer_cert = client.getPeerCertificate();

    if (!peer_cert) {
      callback(new Error('Unable to fetch certificate information'));
      return;
    }

    if (callback_called) {
        return;
    }

    callback(null, peer_cert);
    callback_called = true;
  });

  function on_error(err) {
    if (callback_called) {
      return;
    }

    callback(err);
    callback_called = true;
  }

  client.on('error', on_error);
  request.on('error', on_error);

  request.end();
};

/**
 * Write JSON to an HTTP response.
 *
 * @param {http.ServerResponse} res The HTTP Response to which to write the data.
 * @param {Integer} code  The HTTP response code to use.
 * @param {Object} data The data to write to the response.
 */
exports.return_json = function(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
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
exports.return_error = function(res, code, message) {
  var response = {'code': code};
  if (message !== undefined) {
    response.message = message;
  }
  exports.return_json(res, code, response);
};


exports.get_params = function(required_params, req, callback) {
  var body = [];
  req.on('data', function(chunk) {
    body.push(chunk);
  });

  req.on('end', function() {
    try {
      var params = querystring.parse(body.join(''));
      var missing_params = required_params.filter(function(param) {
        if (!params || !params[param]) {
          return true;
        }
        else {
          return false;
        }
      });

      if (missing_params.length > 0) {
        return callback(new Error('Missing required parameters: ' + missing_params.join(', ')));
      }
      else {
        return callback(null, params);
      }
    }
    catch (e) {
      return callback(new Error('Error parsing body'));
    }
  });
};

/**
 * Issue a GET or POST request to the specified URL.
 *
 * @param {String} remote name of the remote.
 * @param {String} path to append to the remote prefix.
 * @param {String} method What kind of request to perform (GET / POST / PUT).
 * @param {Boolean} parse_json true to parse the response as JSON.
 * @return {*} Response String if parse_json is false, Object otherwise.
 */
exports.get_response = function(remote, path, method, parse_json, callback) {
  if (!misc.in_array(method, ['GET', 'PUT', 'POST', 'DELETE'])) {
    return callback(new Errorf('Invalid method: %s', method));
  }

  var opts = {
    path: path,
    method: method
  };

  exports.build_request(remote, opts, function(err, request) {
    var data_buffer, data, result_object;

    if (err) {
      return callback(err);
    }

    result_object = {'headers': null, 'status_code': null, 'body': null};

    request.on('error', callback);

    request.on('response', function(response) {
      data_buffer = [];
      response.setEncoding('utf8');

      response.on('error', callback);

      response.on('data', function(chunk) {
        data_buffer.push(chunk);
      });

      response.on('end', function() {
        data = data_buffer.join('');
        if (parse_json && data.length > 0) {
          data = JSON.parse(data);
        }
        result_object.headers = response.headers;
        result_object.status_code = response.statusCode;
        result_object.body = data;
        callback(null, result_object);
      });
    });

    request.end();
  });
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
  if (req.already_have_logify) {
    return;
  }
  req.already_have_logify = true;
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
  var ssl_opts;

  var authed = function(req, res) {
    logify(req, res, log.debug);
    var hmac_result = hmac.validate_http_hmac(req.method, req.url, req.headers);
    if (!hmac_result) {
      exports.return_json(res, 401, {'message': 'Authentication failed.'});
      return;
    }
    return func(req, res);
  };

  if (conf.ssl_enabled) {
    ssl_opts = {
      key: fs.readFileSync(conf.ssl_key),
      cert: fs.readFileSync(conf.ssl_cert)
    };
    return https.createServer(ssl_opts, authed);
  }
  else {
    return http.createServer(authed);
  }
};
