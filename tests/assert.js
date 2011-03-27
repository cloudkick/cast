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

/**
 * Custom assert methods.
 */

var assert = require('assert')

var utilHttp = require('util/http');

var port = parseInt((Math.random() * (65500 - 2000) + 2000), 10);

assert.response = function(server, req, res, msg) {
  // Callback as third or fourth arg
  var callback = typeof res === 'function'
      ? res
      : typeof msg === 'function'
          ? msg
          : function(){};

  // Default messate to test title
  if (typeof msg === 'function') msg = null;
  msg = msg || assert.testTitle;
  msg += '. ';

  // Pending responses
  server.__pending = server.__pending || 0;
  server.__pending++;


  server.listen(server.__port = port++, '127.0.0.1');

  process.nextTick(function() {
    // Issue request
    var timer;
    var trailer;
    var method = req.method || 'GET';
    var status = res.status || res.statusCode;
    var data = req.data || req.body;
    var streamer = req.streamer;
    var timeout = req.timeout || 0;
    var headers = req.headers || {};

    for (trailer in req.trailers) {
      if (req.trailers.hasOwnProperty(trailer)) {
        if (headers['Trailer']) {
          headers['Trailer'] += ', ' + trailer;
        }
        else {
          headers['Trailer'] = trailer;
        }
      }
    }

    var remote = { hostname: '127.0.0.1', port: server.__port };
    remote.url = 'http://' + remote.hostname + ':' + remote.port;
    var opts = { path: req.url, method: method, headers: headers };

    utilHttp._baseRequest(remote, opts, function(err, request) {
      if (req.trailers) {
        request.addTrailers(req.trailers);
      }

      // Timeout
      if (timeout) {
        timer = setTimeout(function(){
          --server.__pending || server.close();
          delete req.timeout;
          assert.fail(msg + 'Request timed out after ' + timeout + 'ms.');
        }, timeout);
      }

      if (data) request.write(data);

      request.addListener('response', function(response) {
        response.body = '';
        response.setEncoding('utf8');
        response.addListener('data', function(chunk){ response.body += chunk; });
        response.addListener('end', function(){
          --server.__pending || server.close();
          if (timer) clearTimeout(timer);

          // Assert response body
          if (res.body !== undefined) {
            assert.equal(
              response.body,
              res.body,
              msg + 'Invalid response body.\n'
                  + '    Expected: ' + sys.inspect(res.body) + '\n'
                  + '    Got: ' + sys.inspect(response.body)
            );
          }

          // Assert response status
          if (typeof status === 'number') {
            assert.equal(
              response.statusCode,
              status,
              msg + 'Invalid response status code.\n'
                  + '    Expected: [{' + status + '}\n'
                  + '    Got: {' + response.sttusCode + '}'
            );
          }

          // Assert response headers
          if (res.headers) {
            var keys = Object.keys(res.headers);
            for (var i = 0, len = keys.length; i < len; ++i) {
              var name = keys[i];
              var actual = response.headers[name.toLowerCase()];
              var expected = res.headers[name];
              assert.equal(
                actual,
                expected,
                msg + 'Invalid response header [bold]{' + name + '}.\n'
                    + '    Expected: {' + expected + '}\n'
                    + '    Got: {' + actual + '}'
              );
            }
          }

          // Callback
          callback(response);
        });
      });
      if (streamer) {
        streamer(request);
      } else {
        request.end();
      }
    });
  });
};

var keys = Object.keys(assert);
keys.forEach(function(key) {
  exports[key] = assert[key];
});
