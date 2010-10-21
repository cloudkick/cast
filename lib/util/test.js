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
var net = require('net');
var fs = require('fs');

var sprintf = require('extern/sprintf').sprintf;
var log = require('util/log');

/**
 * Run a HTTP server which is used for testing purposes.
 *
 * @param {String} ip_address IP address on which to listen.
 * @param {Integer} port  Port on which to listen.
 * @param {Object} routes Routes for the server. For example:.
 *
 * { '/test': {'status_code': 200, 'body': 'Some content'},
 *   '/test2': {'status_code': 302, 'body': 'Test response'}
 * }
 *
 * @param {Function} callback Callback which is called when the server has been bound to the port.
 */
var run_test_http_server = function(ip_address, port, routes, callback) {
  var _ip_address = ip_address || '127.0.0.1';
  var _port = port || 8888;
  var _routes = routes || {};
  var _callback = callback;

  var http_server = http.createServer(function(request, response) {
    var path = request.url;

    var route;

    if (!_routes.hasOwnProperty(path)) {
      response.writeHead(404, {'Content-Type': 'text-plain'});
      response.end('Not found');

      return;
    }

    route = _routes[path];
    response.writeHead(route.status_code, {'Content-Type': 'text-plain'});
    response.end(route.body);
  }).listen(_port, _ip_address, _callback);

  log.info(sprintf('Test HTTP server listening on IP %s port %s', _ip_address, _port));
};

/**
 * Run a TCP server which is used for testing purposes.
 *
 * @param {String} ip_address IP address on which to listen.
 * @param {Integer} port  Port on which to listen.
 * @param {Object} response_dictionary List of "commands" and corresponding responses. For example:.
 *
 * { 'hello': 'Hello World\nTesting server',
 *   'status' 'Running, uptime: 1 day 3 hours 44 minutes\n'
 * }
 *
 * @param {Function} callback Callback which is called when the server has been bound to the port.
 */
var run_test_tcp_server = function(ip_address, port, response_dictionary, callback) {
  var _ip_address = ip_address || '127.0.0.1';
  var _port = port || 1212;
  var _response_dictionar = response_dictionary || {};
  var _callback = callback;

  var tcp_server = net.createServer(function(stream) {
    var data_buffer = [];

    stream.on('data', function(chunk) {
      data_buffer.push(chunk);
    });

    stream.on('end', function() {
      var data = data_buffer.join('');

      if (response_dictionary.hasOwnProperty(data)) {
        stream.end(response_dictionary[data]);
      }

      stream.end();
    });

  }).listen(_port, _ip_address, _callback);

  log.info(sprintf('Test TCP server listening on IP %s port %s', _ip_address, _port));
};

/**
 * Check if a specified file exists and it's size is > 0 bytes.
 *
 * @param {String} file_path Path to the file.
 *
 * @param {Boolean} true if the file exists, false otherwise.
 */
var file_exists = function(file_path) {
  try {
    stat = fs.statSync(file_path);
  }
  catch (exception) {
    return false;
  }

  return stat.size > 0;
};

/**
 * Delete a file if it exists.
 *
 * @param {String} file_path Path to the file.
 *
 * @param {Boolean} true if the file exists, false otherwise.
 */
function file_delete(file_path) {
  try {
    fs.unlinkSync(file_path);
  }
  catch (error) {
  }
}

var current_offset = 0;
var start_port = parseInt((Math.random() * (65000 - 2000) + 2000), 10);
function get_port() {
  var port = start_port + current_offset;
  current_offset++;

  return port;
}

exports.run_test_http_server = run_test_http_server;
exports.run_test_tcp_server = run_test_tcp_server;
exports.file_exists = file_exists;
exports.file_delete = file_delete;
exports.get_port = get_port;
