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
var runTestHttpServer = function(ipAddress, port, routes, callback) {
  var _IpAddress = ipAddress || '127.0.0.1';
  var _port = port || 8888;
  var _routes = routes || {};
  var _callback = callback;

  var httpServer = http.createServer(function(request, response) {
    var path = request.url;

    var route;

    if (!_routes.hasOwnProperty(path)) {
      response.writeHead(404, {'Content-Type': 'text-plain'});
      response.end('Not found');

      return;
    }

    route = _routes[path];
    response.writeHead(route.statusCode, {'Content-Type': 'text-plain'});
    response.end(route.body);
  }).listen(_port, _IpAddress, _callback);

  log.info(sprintf('Test HTTP server listening on IP %s port %s', _IpAddress, _port));
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
var runTestTcpServer = function(ipAddress, port, responseDictionary, waitForEnd,
                                   callback) {
  var i, key, value, responseDictionaryKeys, responseDictionaryLength;
  var regexpMatchObjectsLength;
  var _IpAddress = ipAddress || '127.0.0.1';
  var _port = port || 1212;
  var _ResponseDictionary = responseDictionary || {};
  var serverOptions, tcpServer;

  var stringMatchObjects = {};
  var regexpMatchObjects = {};

  responseDictionaryKeys = Object.keys(responseDictionary);
  responseDictionaryLength = responseDictionaryKeys.length;

  for (i = 0; i < responseDictionaryLength; i++) {
    key = responseDictionaryKeys[i];
    value = _ResponseDictionary[key];

    if (value.type === 'string') {
      stringMatchObjects[key] = value.response;
    }
    else if (value.type === 'regexp') {
      regexpMatchObjects[key] = value.response;
    }
  }

  regexpMatchObjectsLength = Object.keys(regexpMatchObjects).length;

  /*
   * @param {String/Function} response Response string or a function which returns
   *                                   a response string.
   * @param {String/Object} matches Matched command string if 'type' is 'string',
   *                                otherwise a regexp match object.
   */
  var getResponseString = function(response, matches) {
    var responseString;

    if (typeof response === 'string') {
      return response;
    }
    else if (typeof response === 'function') {
      responseString = response.call(this, matches);
      return responseString;
    }
  };

  var sendResponse = function(data, stream) {
    var i, responseValue, responseString, regexp, regexpObject, matches;

    // Check for a string match
    if (stringMatchObjects.hasOwnProperty(data)) {
      responseValue = stringMatchObjects[data];
      responseString = getResponseString(responseValue, data);
      stream.write(responseString);
      return;
    }

    // Check for a regex match
    for (regexp in regexpMatchObjects) {
      if (regexpMatchObjects.hasOwnProperty(regexp)) {
        regexpObject = new RegExp(regexp);
        matches = regexpObject.exec(data);

        if (!matches) {
          continue;
        }

        responseValue = regexpMatchObjects[regexp];
        responseString = getResponseString(responseValue, matches);
        stream.write(responseString);
        break;
      }
    }
  };

  var handleConnection = function(stream) {
    var self = this;
    this._streams.push(stream);

    var dataBuffer = [];

    stream.on('data', function(chunk) {
      if (!waitForEnd) {
        var data = chunk.toString();
        sendResponse(data, stream);
      }
      else {
        dataBuffer.push(chunk);
      }
    });

    stream.on('end', function() {
      var inStream = self._streams.indexOf(this);
      var data = dataBuffer.join('');

      if (waitForEnd) {
        sendResponse(data, stream);
      }

      if (inStream !== -1) {
        self._streams.splice(inStream, 1);
      }

      stream.end();
    });
  };

  if (process.version.indexOf('v0.2')) {
      serverOptions = { 'allowHalfOpen': true };
  }
  else {
      serverOptions = null;
  }

  if (serverOptions) {
      tcpServer = net.createServer(serverOptions, handleConnection);
  }
  else {
      tcpServer = net.createServer(handleConnection);
  }

  tcpServer = tcpServer.listen(_port, _IpAddress, function() {
    this._streams = [];
    callback.call(this);
  });

  log.info(sprintf('Test TCP server listening on IP %s port %s', _IpAddress, _port));
};

/**
 * Check if a specified file exists and it's size is > 0 bytes.
 *
 * @param {String} file_path Path to the file.
 *
 * @param {Boolean} true if the file exists, false otherwise.
 */
var fileExists = function(filePath) {
  var stat;

  try {
    stat = fs.statSync(filePath);
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
function fileDelete(filePath) {
  try {
    fs.unlinkSync(filePath);
  }
  catch (error) {
  }
}

var currentOffset = 0;
var startPort = parseInt((Math.random() * (65000 - 2000) + 2000), 10);
function getPort() {
  var port = startPort + currentOffset;
  currentOffset++;

  return port;
}

exports.runTestHttpServer = runTestHttpServer;
exports.runTestTcpServer = runTestTcpServer;
exports.fileExists = fileExists;
exports.fileDelete = fileDelete;
exports.getPort = getPort;
