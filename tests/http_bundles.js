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

/*
 * @NOTICE: This test is currently broken in Node 0.2.4.
 * It looks like buffering writes before connection (http://github.com/ry/node/commit/1d3142a882d08a5cd1bf221cf37e76692bd71205)
 * broke it, but I didn't have much time to investigate deeper.
 * When the issue is fixed, remove this comment.
 */
var sys = require('sys');
var fs = require('fs');
var crypto = require('crypto');
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
      assert.equal(res.statusCode, code, method + ' ' + url);
    });

    beforeExit(function(){
      assert.equal(1, n, 'Responses Received');
    });
  };
}

// The following tests can be executed asynchronously in any order

// Non-existant bundle
exports['GET /bundles/bar/'] = verify_response_code('/bundles/bar/', 404);

// Up one level from bundles
exports['GET /bundles/../'] = verify_response_code('/bundles/../', 404);

// At the bundles level
exports['GET /bundles/./'] = verify_response_code('/bundles/./', 404);

// Uploading to the bundles directory
exports['PUT /bundles/foo/../'] = verify_response_code('/bundles/foo/../', 404, 'PUT', hello);

// Uploading to a file in the bundles directory
exports['PUT /bundles/baz/baz@1.0.tar.gz'] = verify_response_code('/bundles/baz/baz@1.0.tar.gz', 500, 'PUT', hello);

// Listing a file in the bundles directory
exports['GET /bundles/baz/'] = verify_response_code('/bundles/baz/', 404);

// Get a file that is actually a directory
exports['GET /bundles/foo/foo@3.0.tar.gz'] = verify_response_code('/bundles/foo/foo@3.0.tar.gz', 404);

// Delete a file that is actually a directory
exports['DELETE /bundles/foo/foo@3.0.tar.gz'] = verify_response_code('/bundles/foo/foo@3.0.tar.gz', 404);


// These tests must be executed in series and enforce this using util/pubsub

exports['GET /bundles/'] = function(assert, beforeExit) {
  // The result body is empty, because bundle "foo" does not have any extracted
  // versions yet
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
    assert.equal(data.length, 0);
    ps.emit('bundles listed');
  });
  beforeExit(function(){
    assert.equal(1, n, 'Responses Received');
  });
};

/*exports['GET /bundles/ after PUT'] = function(assert, beforeExit) {
  // Make sure the 'foo' bundle is listed
  var n = 0;
  ps.on('foo@1.0.tar.gz listed', function() {
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
      assert.equal(data[0].name, "foo");
      ps.emit('bundles listed');
    });
    beforeExit(function(){
      assert.equal(1, n, 'Responses Received');
    });
  });
};*/

exports['PUT foo@1.0.tar.gz'] = function(assert, beforeExit) {
  var n = 0;
  fs.readFile('tests/data/fooserv.tar.gz', function(err, data) {
    n++;
    var sha1 = crypto.createHash('sha1');
    sha1.update(data);

    assert.response(getServer(), {
      url: '/bundles/foo/foo@1.0.tar.gz',
      method: 'PUT',
      data: data,
      headers: {'X-Content-SHA1': sha1.digest('base64')}
    },
    function(res) {
      n++;
      assert.equal(res.statusCode, 204);
      ps.emit('foo@1.0.tar.gz created');
    });
  });

  beforeExit(function() {
    assert.equal(n, 2);
  });
};

exports['GET /bundles/foo/'] = function(assert, beforeExit) {
  // Make sure listing the bundle shows the file
  var n = 0;
  ps.on('foo@1.0.tar.gz created', function() {
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
      assert.equal(data[0], "foo@1.0.tar.gz");
      ps.emit('foo@1.0.tar.gz listed');
    });
  });

  beforeExit(function(){
    assert.equal(1, n, 'Responses Received');
  });
};

exports['GET foo@1.0.tar.gz'] = function(assert, beforeExit) {
  // Make sure we can download the file and the contents are correct
  var n = 0;
  ps.on('foo@1.0.tar.gz listed', function() {
    assert.response(getServer(), {
      url: '/bundles/foo/foo@1.0.tar.gz',
      method: 'GET'
    },
    function(res) {
      n++;
      assert.equal(200, res.statusCode);
      // TODO: Check body contents
      ps.emit('foo@1.0.tar.gz read');
    });
  });

  beforeExit(function(){
    assert.equal(1, n, 'Responses Received');
  });
};

exports['DELETE foo@1.0.tar.gz'] = function(assert, beforeExit) {
  // Make sure we can delete the file
  var n = 0;
  ps.on('foo@1.0.tar.gz read', function() {
    assert.response(getServer(), {
      url: '/bundles/foo/foo@1.0.tar.gz',
      method: 'DELETE'
    },
    function(res) {
      n++;
      assert.equal(res.statusCode, 204);
      assert.length(res.body, 0);
      ps.emit('foo@1.0.tar.gz deleted');
    });
  });

  // And that it gets deleted
  ps.on('foo@1.0.tar.gz deleted', function() {
    assert.response(getServer(), {
      url: '/bundles/foo/foo@1.0.tar.gz',
      method: 'GET'
    },
    function(res) {
      n++;
      assert.equal(404, res.statusCode);
      ps.emit('foo@1.0.tar.gz verified deleted');
    });
  });

  beforeExit(function(){
    assert.equal(2, n, 'Responses Received');
  });
};

exports['PUT bar@1.0.tar.gz'] = function(assert, beforeExit) {
  var n = 0;
  ps.on('bundles listed', function() {
    var req = {
      url: '/bundles/bar/bar@1.0.tar.gz',
      method: 'PUT',
      headers: {
        'Transfer-Encoding': 'chunked'
      },
      streamer: function(request) {
        var intervalId;
        function write_some() {
          request.write(misc.randstr(1024));
          if (++n === 1000) {
            clearInterval(intervalId);
            request.end();
          }
        }
        intervalId = setInterval(write_some, 2);
      }
    };
    assert.response(getServer(), req, function(res) {
      n++;
      assert.equal(500, res.statusCode);
    });
  });

  beforeExit(function() {
    assert.equal(1001, n, 'Responses Received');
  });
};

exports['PUT foo@4.1.tar.gz'] = function(assert, beforeExit) {
  var n = 0;
  ps.on('foo@1.0.tar.gz listed', function() {
    fs.readFile('tests/data/fooserv.tar.gz', function(err, data) {
      n++;
      var sha1 = crypto.createHash('sha1');
      sha1.update(data);
      // Flip one bit
      data[9] = data[9] ^ 010;

      assert.response(getServer(), {
        url: '/bundles/foo/foo@4.1.tar.gz',
        method: 'PUT',
        data: data,
        headers: {'X-Content-SHA1': sha1.digest('base64')}
      },
      function(res) {
        n++;
        assert.equal(res.statusCode, 400);
      });
    });
  });

  beforeExit(function() {
    assert.equal(n, 2);
  });
};

exports.setup = function(done) {
  async.series([
    async.apply(ps.ensure, "config"),
    async.apply(exec, "mkdir -p .tests/data_root/bundles/foo/foo@3.0.tar.gz"),
    async.apply(exec, "mkdir -p .tests/data_root/extracted"),
    async.apply(exec, "touch .tests/data_root/bundles/foo/foobar"),
    async.apply(exec, "touch .tests/data_root/bundles/foo/bar@1.0.tar.gz"),
    async.apply(exec, "touch .tests/data_root/bundles/baz")
  ], done);
};
