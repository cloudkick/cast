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

var sprintf = require('sprintf').sprintf;

var http = require('services/http');

exports['test_url_routing'] = function(test, assert) {
  var latestVersion = '2.0';

  assert.response(http._serverOnly('data/http_services/', [ 'test-service' ]), {
    url: '/1.0/test-service/',
    method: 'GET'
  },

  function(res) {
    assert.equal(res.statusCode, 200);
    var data = JSON.parse(res.body);
    assert.equal(data.text, 'test 1.0');
  });

  assert.response(http._serverOnly('data/http_services/', [ 'test-service' ]), {
    url: '/2.0/test-service/',
    method: 'GET'
  },

  function(res) {
    assert.equal(res.statusCode, 202);
    var data = JSON.parse(res.body);
    assert.equal(data.text, 'test 2.0');
  });

  assert.response(http._serverOnly('data/http_services/', [ 'test-service' ]), {
    url: '/5.5/test-service/',
    method: 'GET'
  },

  function(res) {
    assert.equal(res.statusCode, 404);
  });

  assert.response(http._serverOnly('data/http_services/', [ 'test-service' ],
                                   latestVersion), {
    url: '/test-service/',
    method: 'GET'
  },

  function(res) {
    assert.equal(res.statusCode, 202);
    var data = JSON.parse(res.body);
    assert.equal(data.text, sprintf('test %s', latestVersion));
    test.finish();
  });
};
