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

var ps = require('util/pubsub');
var sys = require('sys');

function getServer()
{
  return require('services/http')._serverOnly();
}

var hello = "Hello World";

exports['PUT t.txt'] = function(assert, beforeExit) {
  var n = 0;

  assert.response(getServer(), {
    url: '/bundles/foo/t.txt',
    method: 'PUT',
    data: hello
  },
  function(res) {
    n++;
    assert.equal(res.statusCode, 204);
    assert.length(res.body, 0);
    ps.emit('t.txt created');
  });
  beforeExit(function(){
    assert.equal(1, n, 'Responses Received');
  });
};

exports['GET t.txt'] = function(assert, beforeExit) {
  var n = 0;
  ps.on('t.txt created', function() {
    assert.response(getServer(), {
      url: '/bundles/foo/t.txt',
      method: 'GET'
    },
    function(res) {
      n++;
      assert.equal(200, res.statusCode);
      assert.equal(hello, res.body);
      ps.emit('t.txt read');
    });
  });
  beforeExit(function(){
    assert.equal(1, n, 'Responses Received');
  });
};

exports['DELETE t.txt'] = function(assert, beforeExit) {
  var n = 0;
  ps.on('t.txt read', function() {
    assert.response(getServer(), {
      url: '/bundles/foo/t.txt',
      method: 'DELETE'
    },
    function(res) {
      n++;
      assert.equal(res.statusCode, 204);
      assert.length(res.body, 0);
      ps.emit('t.txt deleted');
    });
  });

  ps.on('t.txt deleted', function() {
    assert.response(getServer(), {
      url: '/bundles/foo/t.txt',
      method: 'GET'
    },
    function(res) {
      n++;
      assert.equal(404, res.statusCode);
    });
  });

  beforeExit(function(){
    assert.equal(2, n, 'Responses Received');
  });
};

exports.setup = function(done) {
  require('util/pubsub').ensure("config", done);
}
