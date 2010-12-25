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
 * { 'hello': { 'type': 'string', 'response': 'Hello World\nTesting server' },
 *   'status \\d+' { 'type': 'regexp', 'response': 'Running, uptime: 1 day 3 hours 44 minutes\n',
 *   'keys ([a-z]+)': { 'type': 'regexp', 'response': function(matches) { return 11; }}
 * }
 *
 * Response value can be a function which is passed a regexp match object if 'type' is
 * regexp, otherwise it is passed a matched command (string).
 *
 * @param {boolean} wait_for_end When true, the response will be sent after the
 *                               other end sends a FIN packet, otherwise a request
 *                               is parsed and a response is sent as soon as a new line
 *                               is received (acts like a line oriented protocol).
 * @param {Function} callback Callback which is called when the server has been bound to the port.
 */
var run_test_tcp_server = function(ip_address, port, response_dictionary, wait_for_end,
                                   callback) {
  var i, key, value, response_dictionary_keys, response_dictionary_length;
  var regexp_match_objects_length;
  var _ip_address = ip_address || '127.0.0.1';
  var _port = port || 1212;
  var _response_dictionary = response_dictionary || {};

  var string_match_objects = {};
  var regexp_match_objects = {};

  response_dictionary_keys = Object.keys(response_dictionary);
  response_dictionary_length = response_dictionary_keys.length;

  for (i = 0; i < response_dictionary_length; i++) {
    key = response_dictionary_keys[i];
    value = _response_dictionary[key];

    if (value.type === 'string') {
      string_match_objects[key] = value.response;
    }
    else if (value.type === 'regexp') {
      regexp_match_objects[key] = value.response;
    }
  }

  regexp_match_objects_length = Object.keys(regexp_match_objects).length;

  /*
   * @param {String/Function} response Response string or a function which returns
   *                                   a response string.
   * @param {String/Object} matches Matched command string if 'type' is 'string',
   *                                otherwise a regexp match object.
   */
  var get_response_string = function(response, matches) {
    var response_string;

    if (typeof response === 'string') {
      return response;
    }
    else if (typeof response === 'function') {
      response_string = response.call(this, matches);
      return response_string;
    }
  };

  var send_response = function(data, stream) {
    var i, response_value, response_string, regexp, regexp_object, matches;

    // Check for a string match
    if (string_match_objects.hasOwnProperty(data)) {
      response_value = string_match_objects[data];
      response_string = get_response_string(response_value, data);
      stream.write(response_string);
      return;
    }

    // Check for a regex match
    for (var regexp in regexp_match_objects) {
      if (!regexp_match_objects.hasOwnProperty(regexp)) {
        continue;
      }

      regexp_object = new RegExp(regexp);
      matches = regexp_object.exec(data);

      if (!matches) {
        continue;
      }

      response_value = regexp_match_objects[regexp];
      response_string = get_response_string(response_value, matches);
      stream.write(response_string);
      break;
    }
  };

  var tcp_server = net.createServer({ 'allowHalfOpen': true }, function(stream) {
    var data_buffer = [];

    stream.on('data', function(chunk) {
      if (!wait_for_end) {
        var data = chunk.toString();
        send_response(data, stream);
      }
      else {
        data_buffer.push(chunk);
      }
    });

    stream.on('end', function() {
      var data = data_buffer.join('');

      if (wait_for_end) {
        send_response(data, stream);
      }

      stream.end();
    });

  }).listen(_port, _ip_address, callback);

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
  var stat;

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
