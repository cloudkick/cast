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

var path = require('path');

var root = path.dirname(__filename);
require.paths.unshift(path.join(root, '../'));

var sprintf = require('extern/sprintf').sprintf;

var assert = require('assert');

var http = require('services/http');

// test route function
(function() {
  var i, expected_routes, expected_routes_len;
  var api_version, version_routes, version_routes_len;
  var func = function() {}

  var routes = [
    ['PUT /foo/bar/$', '1.0', func],
    ['POST /foobar/$', '2.0', func],
    ['GET /foobar/$', '1.1', func],
    ['HEAD /foobar/$', '1.2', func],
    ['DELETE /foobar/$', '2.0', func]
  ]
  var expected_result = {
    '1.0': [ ['PUT /foo/bar/$', func] ],
    '1.1': [ ['GET /foobar/$', func] ],
    '1.2': [ ['HEAD /foobar/$', func] ],
    '2.0': [ ['POST /foobar/$', func], ['DELETE /foobar/$', func] ]
  }

  clutch_routes = http.route(routes);

  assert.equal(Object.keys(clutch_routes).length, 4);

  for (api_version in clutch_routes) {
    assert.ok(expected_result.hasOwnProperty(api_version));

    version_routes = clutch_routes[api_version];
    version_routes_len = version_routes.length;
    expected_routes = expected_result[api_version];
    expected_routes_len = expected_routes.length

    assert.equal(version_routes_len, expected_routes_len);

    for (i = 0; i < version_routes_len; i++) {
      version_route_args = version_routes[i];
      expected_routes_args = expected_routes[i];

      assert.equal(version_route_args[0], expected_routes_args[0]);
      assert.equal(version_route_args[1], expected_routes_args[1]);
    }
  }
})();

// test URL routing
(function() {
  var n = 0;
  var latest_version = '2.0';

  assert.response(http._serverOnly('data/http_services/', [ 'test-service' ]), {
    url: '/1.0/test-service/',
    method: 'GET'
  },

  function(res) {
    n++;
    assert.equal(res.statusCode, 200);
    var data = JSON.parse(res.body);
    console.log(data)
    assert.equal(data.text, 'test 1.0');
  });

  assert.response(http._serverOnly('data/http_services/', [ 'test-service' ]), {
    url: '/2.0/test-service/',
    method: 'GET'
  },

  function(res) {
    n++;
    assert.equal(res.statusCode, 202);
    var data = JSON.parse(res.body);
    assert.equal(data.text, 'test 2.0');
  });

  assert.response(http._serverOnly('data/http_services/', [ 'test-service' ]), {
    url: '/5.5/test-service/',
    method: 'GET'
  },

  function(res) {
    n++;
    assert.equal(res.statusCode, 404);
  });

  assert.response(http._serverOnly('data/http_services/', [ 'test-service' ],
                                   latest_version), {
    url: '/test-service/',
    method: 'GET'
  },

  function(res) {
    n++;
    assert.equal(res.statusCode, 202);
    var data = JSON.parse(res.body);
    console.log(data)
    assert.equal(data.text, sprintf('test %s', latest_version));
  });

  process.on('exit', function() {
    assert.equal(n, 4, 'Callbacks called');
  });
})();
