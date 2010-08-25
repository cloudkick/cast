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

var sys = require('sys');
var exec = require('child_process').exec;
var ps = require('util/pubsub');
var misc = require('util/misc');
var async = require('extern/async');

function getServer() {
  return require('services/http')._serverOnly();
}

var hello = "Hello World";

function verify_response_code(url, code, method, data) {
  var req = {
    url: url,
    method: method
  };
  if (data) {
    req.data = data;
  }
  return function(assert, beforeExit) {
    // Make sure listing the 'bar' bundle 404s
    var n = 0;
    assert.response(getServer(), req, function(res) {
      n++;
      assert.equal(res.statusCode, code);
    });

    beforeExit(function(){
      assert.equal(1, n, 'Responses Received');
    });
  };
}

// The following tests can be executed asynchronously in any order

exports['GET /bundles/'] = function(assert, beforeExit) {
  // Make sure the 'foo' bundle is listed
  var n = 0;
  assert.response(getServer(), {
    url: '/bundles/',
    method: 'GET'
  },
  function(res) {
    n++;
    assert.equal(res.statusCode, 200);
    var data = JSON.parse(res.body);
    assert.ok(data instanceof Array);
    assert.equal(data.length, 1);
    assert.equal(data[0], "foo");
  });
  beforeExit(function(){
    assert.equal(1, n, 'Responses Received');
  });
};

// Non-existant bundle
exports['GET /bundles/bar/'] = verify_response_code('/bundles/bar/', 404);

// Up one level from bundles
exports['GET /bundles/../'] = verify_response_code('/bundles/../', 404);

// At the bundles level
exports['GET /bundles/./'] = verify_response_code('/bundles/./', 404);

// Uploading to non-existant bundle
exports['PUT /bundles/foo/t.txt'] = verify_response_code('/bundles/bar/t.txt', 404, 'PUT', hello);

// Uploading to the bundles directory
exports['PUT /bundles/foo/../'] = verify_response_code('/bundles/foo/../', 404, 'PUT', hello);

// Uploading to a file in the bundles directory
exports['PUT /bundles/baz.txt/t.txt'] = verify_response_code('/bundles/baz.txt/t.txt', 404, 'PUT', hello);

// Listing a file in the bundles directory
exports['GET /bundles/baz.txt'] = verify_response_code('/bundles/baz.txt/', 404);

// Get a file that is actually a directory
exports['GET /bundles/foo/baz'] = verify_response_code('/bundles/foo/baz', 404);

// Delete a file that is actually a directory
exports['DELETE /bundles/foo/baz'] = verify_response_code('/bundles/foo/baz', 404);


// These tests must be executed in series and enforce this using util/pubsub

exports['PUT t.txt'] = function(assert, beforeExit) {
  // Make sure adding a file to a bundle succeeds
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

exports['GET /bundles/foo/'] = function(assert, beforeExit) {
  // Make sure listing the bundle shows the file
  var n = 0;
  ps.on('t.txt created', function() {
    assert.response(getServer(), {
      url: '/bundles/foo/',
      method: 'GET'
    },
    function(res) {
      n++;
      assert.equal(res.statusCode, 200);
      var data = JSON.parse(res.body);
      assert.ok(data instanceof Array);
      assert.equal(data.length, 1);
      assert.equal(data[0], "t.txt");
      ps.emit('t.txt listed');
    });
  });
  beforeExit(function(){
    assert.equal(1, n, 'Responses Received');
  });
};

exports['GET t.txt'] = function(assert, beforeExit) {
  // Make sure we can download the file and the contents are correct
  var n = 0;
  ps.on('t.txt listed', function() {
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
  // Make sure we can delete the file
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

  // And that it gets deleted
  ps.on('t.txt deleted', function() {
    assert.response(getServer(), {
      url: '/bundles/foo/t.txt',
      method: 'GET'
    },
    function(res) {
      n++;
      assert.equal(404, res.statusCode);
      ps.emit('t.txt verified deleted');
    });
  });

  beforeExit(function(){
    assert.equal(2, n, 'Responses Received');
  });
};

exports['PUT long.txt'] = function(assert, beforeExit) {
  var n = 0;
  ps.on('t.txt verified deleted', function() {
    var req = {
      url: '/bundles/foo/long.txt',
      method: 'PUT',
      headers: {
        'Transfer-Encoding': 'chunked'
      },
      streamer: function(request) {
        var intervalId;
        function write_some() {
          request.write(misc.randstr(1024));
          if (++n === 1000) {
            request.end();
            clearInterval(intervalId);
          }
        }
        intervalId = setInterval(write_some, 5);
      }
    };
    assert.response(getServer(), req, function(res) {
      n++;
      assert.equal(204, res.statusCode);
    });
  });

  beforeExit(function(){
    assert.equal(1001, n, 'Responses Received');
  });
};

exports.setup = function(done) {
  async.series([
    async.apply(ps.ensure, "config"),
    async.apply(exec, "mkdir -p .tests/data_root/bundles/foo/baz"),
    async.apply(exec, "touch .tests/data_root/bundles/baz.txt")
  ], done);
};
