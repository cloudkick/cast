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

var sprintf = require('sprintf').sprintf;

var httpService = require('services/http');
var log = require('util/log');

/**
 * Get and start a test server.
 *
 * @param {Number} port Port on which the test server will listen.
 * @param {String} ip IP on which the test server will listen. Defaults to
 *                    127.0.0.1.
 * @param {Function} callback Callback which is called when the server is bound
 * with the server instance as the first argument.
 */
function getTestHttpServer(port, ip, callback) {
  ip = ip || '127.0.0.1';

  var server = httpService.getAndConfigureServer();
  server.listen(port, ip, function onBound() {
    callback(server);
  });
}

/**
 * Run a HTTP server which is used for testing purposes.
 *
 * @param {String} ipAddress IP address on which to listen.
 * @param {Integer} port  Port on which to listen.
 * @param {Object} routes Routes for the server. For example:.
 *
 * { '/test': {'statusCode': 200, 'body': 'Some content'},
 *   '/test2': {'statusCode': 302, 'body': 'Test res'}
 * }
 *
 * @param {Function} callback Callback which is called when the server has been bound to the port.
 */
function runTestHttpServer(ipAddress, port, routes, callback) {
  ipAddress = ipAddress || '127.0.0.1';
  port = port || 8888;
  routes = routes || {};

  var httpServer = http.createServer(function handleConnection(req, res) {
    var route;
    var path = req.url;

    if (!routes.hasOwnProperty(path)) {
      res.writeHead(404, {'Content-Type': 'text-plain'});
      res.end('Not found');

      return;
    }

    route = routes[path];
    res.writeHead(route.statusCode, {'Content-Type': 'text-plain'});
    res.end(route.body);
  }).listen(port, ipAddress, callback);

  log.info(sprintf('Test HTTP server listening on IP %s port %s', ipAddress,
                   port));
}

/**
 * Run a TCP server which is used for testing purposes.
 *
 * @param {String} ipAddress IP address on which to listen.
 * @param {Integer} port  Port on which to listen.
 * @param {Object} responseDictionary List of "commands" and corresponding responses. For example:.
 *
 * { 'hello': { 'type': 'string', 'response': 'Hello World\nTesting server' },
 *   'status \\d+' { 'type': 'regexp', 'response': 'Running, uptime: 1 day 3 hours 44 minutes\n',
 *   'keys ([a-z]+)': { 'type': 'regexp', 'response': function(matches) { return 11; }}
 * }
 *
 * Response value can be a function which is passed a regexp match object if 'type' is
 * regexp, otherwise it is passed a matched command (string).
 *
 * @param {boolean} waitForEnd When true, the response will be sent after the
 *                               other end sends a FIN packet, otherwise a request
 *                               is parsed and a response is sent as soon as a new line
 *                               is received (acts like a line oriented protocol).
 * @param {Function} callback Callback which is called when the server has been bound to the port.
 */
function runTestTcpServer(ipAddress, port, responseDictionary, waitForEnd,
                                   callback) {
  var i, key, value, responseDictionaryKeys, responseDictionaryLength;
  var regexpMatchObjectsLength;
  var _ipAddress = ipAddress || '127.0.0.1';
  var _port = port || 1212;
  var _responseDictionary = responseDictionary || {};
  var serverOptions, tcpServer;

  var stringMatchObjects = {};
  var regexpMatchObjects = {};

  responseDictionaryKeys = Object.keys(responseDictionary);
  responseDictionaryLength = responseDictionaryKeys.length;

  for (i = 0; i < responseDictionaryLength; i++) {
    key = responseDictionaryKeys[i];
    value = _responseDictionary[key];

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
  function getResponseString(response, matches) {
    var responseString;

    if (typeof response === 'string') {
      return response;
    }
    else if (typeof response === 'function') {
      responseString = response.call(this, matches);
      return responseString;
    }
  }

  function sendResponse(data, stream) {
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
  }

  function handleConnection(stream) {
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
  }

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

  tcpServer = tcpServer.listen(_port, _ipAddress, function() {
    this._streams = [];
    callback.call(this);
  });

  log.info(sprintf('Test TCP server listening on IP %s port %s', _ipAddress, _port));
}

/**
 * Check if a specified file exists and it's size is > 0 bytes.
 *
 * @param {String} filePath Path to the file.
 * @return {Boolean} True if the file exists, false otherwise.
 */
function fileExists(filePath) {
  var stat;

  try {
    stat = fs.statSync(filePath);
  }
  catch (exception) {
    return false;
  }

  return stat.size > 0;
}

/**
 * __Synchronously__ delete a file if it exists.
 *
 * @param {String} filePath Path to the file.
 */
function fileDelete(filePath) {
  try {
    fs.unlinkSync(filePath);
  }
  catch (error) {
  }
}

/**
 * Emulates a "touch" which is not available in node < 0.5
 *
 * @param {String} filePath path where the file is created
 * @param {Function} callback Callback fired with (err)
 */
function fileCreate(filePath, callback) {
  fs.writeFile(filePath, '', 'utf8', callback);
}

var currentOffset = 0;
var startPort = parseInt((Math.random() * (65000 - 2000) + 2000), 10);
function getPort() {
  var port = startPort + currentOffset;
  currentOffset++;

  return port;
}

/**
 * Return an object which is used for performing an http request.
 *
 * @param {String} url Which url to hit.
 * @param {String} method HTTP method.
 * @return {Object} Object which is used to perform an http request.
 */
function getReqObject(url, method, apiVersion) {
  url = (url.charAt(0) !== '/') ? sprintf('/%s', url) : url;
  url = apiVersion ? sprintf('/%s%s', apiVersion, url) : url;

  var req = {
    url: url,
    method: method || 'GET'
  };

  return req;
}

exports.getTestHttpServer = getTestHttpServer;
exports.runTestHttpServer = runTestHttpServer;
exports.runTestTcpServer = runTestTcpServer;
exports.fileExists = fileExists;
exports.fileDelete = fileDelete;
exports.fileCreate = fileCreate;
exports.getPort = getPort;
exports.getReqObject = getReqObject;
