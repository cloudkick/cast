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

var version = require('util/version');
var http = require('http');
var urllib = require('url');
var misc = require('util/misc');
var sprintf = require('extern/sprintf').sprintf;
var sys = require('sys');
var fs = require('fs');
var log = require('util/log');
var uri = require('extern/restler/lib/vendor/uri');
var rest = require('extern/restler/lib/restler');
var version = require('util/version');

exports.client = function(remote)
{
  // TODO: remote lookup
  function remote_lookup(a) {
    return {host: 'localhost', port: 49443};
  }
  var r = remote_lookup(remote);

  // TODO: Allow custom remotes
  var client = http.createClient(r.port, r.host, secure);

  client.headers =  {'host': host, 'user-agent': version.toString()};

  // TOOD: SSL verify fingerprint

  return client;
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

exports.put = function(url, options)
{
  options.headers = options.headers ? options.headers : {};
  options.headers['User-Agent'] = version.toString();
  options.timeout = 3000;
  return rest.put(url, options);
};

exports.put_file = function(source, url, options) {
  var stream = fs.createReadStream(source, {'bufferSize': options.bufferSize ? bufferSize : 1024 * 64});
  options.data_stream = stream;
  /* TODO: refactor into a UI thing in restler */
  if (options.spinner) {
    fs.stat(source, function(err, stats) {
      if (err) {
        throw err;
      }
      var spin = require('util/spinner').percent('Uploading ' + source, stats.size);
      spin.start();
      var l = 0;
      stream.addListener('data', function(chunk) {
        l += chunk.length;
        spin.tick(l);
      });
      stream.addListener('close', function() {
        spin.end();
      });
    });
  }
  return exports.put(url, options);
};

/**
 * Issue a GET or POST request to the specified URL.
 *
 * @param {String} url Target URL.
 * @param {String} method What kind of request to perform (GET / POST / PUT).
 * @param {Boolean} parse_json true to parse the response as JSON.
 * @return {*} Response String if parse_json is false, Object otherwise.
 */
exports.get_response_with_client = function(client, path, method, parse_json, callback) {
  var data_buffer, data;

  if (!misc.in_array(method, ['GET', 'PUT', 'POST'])) {
    return callback(new Error(sprintf('Invalid method: %s', method)));
  }

  var request = client.request(method, path, client.headers);

  request.on('response', function(response) {
    data_buffer = [];
    response.setEncoding('utf-8');

    response.on('error', callback);

    response.on('data', function(chunk) {
      data_buffer.push(chunk);
    });

    response.on('end', function() {
      data = data_buffer.join('');

      if (parse_json && data.length > 0) {
        data = JSON.parse(data);
      }

      callback(null, data);
    });
  });

  request.end();
};


/**
 * Issue a GET or POST request to the specified URL.
 *
 * @param {String} remote name of the remote
 * @param {String} path to append to the remote prefix
 * @param {String} method What kind of request to perform (GET / POST / PUT).
 * @param {Boolean} parse_json true to parse the response as JSON.
 * @return {*} Response String if parse_json is false, Object otherwise.
 */
exports.get_response = function(remote, path, method, parse_json, callback) {
  var client = exports.client(remote);
  return exports.get_response_with_client(client, path, method, parse_json, callback);
};
