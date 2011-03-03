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
var fs = require('fs');
var crypto = require('crypto');
var exec = require('child_process').exec;
var misc = require('util/misc');
var async = require('extern/async');
var assert = require('assert');

function getServer() {
  return require('services/http')._serverOnly();
}

var hello = "Hello World";

function verify_response_code(url, code, method, data, callback) {
  if (!callback) {
    if (data) {
      callback = data;
      data = undefined;
    }
    else if (method) {
      callback = method;
      method = undefined;
    }
  }
  var req = {
    url: url,
    method: method
  };
  if (data) {
    req.data = data;
  }
  assert.response(getServer(), req, function(res) {
    assert.equal(res.statusCode, code, method + ' ' + url);
    callback();
  });
}

(function() {
  var completed = false;
  var fooserv_tar_gz, fooserv_tar_gz_bad;

  // This is handy for tracking successful uploads
  var uploaded = {};
  var uploaded_count = 0;

  function upload_successful(name, version) {
    if (!uploaded[name]) {
      uploaded[name] = [];
    }
    if (uploaded[name].indexOf(version) === -1) {
      uploaded[name].push(version);
      uploaded_count++;
    }
  }

  function have_bundle(name, version) {
    return (uploaded[name] && uploaded[name].indexOf(version) !== -1);
  }

  async.series([
    // Prepare some bundles
    async.apply(exec, "mkdir -p .tests/data_root/bundles/foo/foo@3.0.tar.gz"),
    async.apply(exec, "mkdir -p .tests/data_root/extracted"),
    async.apply(exec, "touch .tests/data_root/bundles/foo/foobar"),
    async.apply(exec, "touch .tests/data_root/bundles/foo/bar@1.0.tar.gz"),
    async.apply(exec, "touch .tests/data_root/bundles/baz"),

    // Carry out a bunch of simple response code tests in parallel
    function(callback) {
      async.parallel([
        // Non-existant bundle
        async.apply(verify_response_code, '/bundles/bar/', 404),

        // Up one level from bundles
        async.apply(verify_response_code, '/bundles/../', 404),

        // At the bundles level
        async.apply(verify_response_code, '/bundles/./', 404),

        // Uploading to the bundles directory
        async.apply(verify_response_code, '/bundles/foo/../', 404, 'PUT', hello),

        // Uploading to a file in the bundles directory
        async.apply(verify_response_code, '/bundles/baz/baz@1.0.tar.gz', 500, 'PUT', hello),

        // Listing a file in the bundles directory
        async.apply(verify_response_code, '/bundles/baz/', 404),

        // Get a file that is actually a directory
        async.apply(verify_response_code, '/bundles/foo/foo@3.0.tar.gz', 404),

        // Delete a file that is actually a directory
        async.apply(verify_response_code, '/bundles/foo/foo@3.0.tar.gz', 404)

      ],
      callback);
    },

    // Remove bundles from the previous tests
    async.apply(exec, "rm -rf .tests/data_root/bundles/*"),

    // No bundles should be listed yet
    function(callback) {
      assert.response(getServer(), {
        url: '/bundles/',
        method: 'GET'
      },
      function(res) {
        assert.equal(res.statusCode, 200);
        var data = JSON.parse(res.body);
        assert.ok(data instanceof Array);
        assert.equal(data.length, 0);
        callback();
      });
    },

    // Load a bundle to use repeatedly
    function(callback) {
      fs.readFile('data/fooserv.tar.gz', function(err, data) {
        assert.ifError(err);
        fooserv_tar_gz = data;
        fooserv_tar_gz_bad = new Buffer(fooserv_tar_gz.length);
        fooserv_tar_gz.copy(fooserv_tar_gz_bad);
        fooserv_tar_gz_bad[9] = fooserv_tar_gz_bad[9] ^ 010;
        callback();
      });
    },

    // Upload a bundle without a SHA1
    function(callback) {
      assert.response(getServer(), {
        url: '/bundles/foo/foo@1.0.tar.gz',
        method: 'PUT',
        data: fooserv_tar_gz
      },
      function(res) {
        assert.equal(res.statusCode, 204);
        upload_successful('foo', '1.0');
        callback();
      });
    },

    // Upload a bundle with a SHA1 header
    function(callback) {
      var sha1 = crypto.createHash('sha1').update(fooserv_tar_gz);
      assert.response(getServer(), {
        url: '/bundles/foo/foo@2.0.tar.gz',
        method: 'PUT',
        data: fooserv_tar_gz,
        headers: {'X-Content-SHA1': sha1.digest('base64')}
      },
      function(res) {
        assert.equal(res.statusCode, 204);
        upload_successful('foo', '2.0');
        callback();
      });
    },

    // Upload a bundle with a bad SHA1 header
    function(callback) {
      var sha1 = crypto.createHash('sha1').update(fooserv_tar_gz);
      assert.response(getServer(), {
        url: '/bundles/foo/foo@2.1.tar.gz',
        method: 'PUT',
        data: fooserv_tar_gz_bad,
        headers: {'X-Content-SHA1': sha1.digest('base64')}
      },
      function(res) {
        assert.equal(res.statusCode, 400);
        callback();
      });
    },

    // Upload a bundle with a SHA1 trailer
    function(callback) {
      var sha1 = crypto.createHash('sha1').update(fooserv_tar_gz);
      assert.response(getServer(), {
        url: '/bundles/foo/foo@3.0.tar.gz',
        method: 'PUT',
        data: fooserv_tar_gz,
        trailers: {'X-Content-SHA1': sha1.digest('base64')}
      },
      function(res) {
        assert.equal(res.statusCode, 204);
        upload_successful('foo', '3.0');
        callback();
      });
    },

    // Upload a bundle with a bad SHA1 trailer
    function(callback) {
      var sha1 = crypto.createHash('sha1').update(fooserv_tar_gz);
      assert.response(getServer(), {
        url: '/bundles/foo/foo@3.1.tar.gz',
        method: 'PUT',
        data: fooserv_tar_gz_bad,
        trailers: {'X-Content-SHA1': sha1.digest('base64')}
      },
      function(res) {
        assert.equal(res.statusCode, 400);
        callback();
      });
    },

    // List available bundles
    function(callback) {
      assert.response(getServer(), {
        url: '/bundles/',
        method: 'GET'
      },
      function(res) {
        assert.equal(res.statusCode, 200);
        var data = JSON.parse(res.body);
        var i;
        assert.ok(data instanceof Array);
        assert.equal(data.length, uploaded_count);
        for (i = 0; i < data.length; i++) {
          assert.ok(data[i].name);
          assert.ok(data[i].version);
          assert.ok(have_bundle(data[i].name, data[i].version));
        }
        callback();
      });
    },

    // List files available one of the uploaded bundles
    function(callback) {
      var name = 'foo';
      assert.response(getServer(), {
        url: '/bundles/' + name + '/',
        method: 'GET'
      },
      function(res) {
        assert.equal(res.statusCode, 200);
        var data = JSON.parse(res.body);
        var i;
        var curName, curVersion;
        assert.ok(data instanceof Array);
        assert.equal(data.length, uploaded[name].length);
        for (i = 0; i < data.length; i++) {
          curName = data[i].split('@')[0];
          curVersion = data[i].split('@')[1].replace(/\.tar.gz$/, '');
          assert.ok(have_bundle(curName, curVersion));
        }
        callback();
      });
    },

    // Retrieve a bundle file
    function(callback) {
      assert.response(getServer(), {
        url: '/bundles/foo/foo@1.0.tar.gz',
        method: 'GET'
      },
      function(res) {
        assert.equal(res.statusCode, 200);
        // TODO: Check the actual contents of the body
        callback();
      });
    },

    // Delete a bundle file
    function(callback) {
      assert.response(getServer(), {
        url: '/bundles/foo/foo@1.0.tar.gz',
        method: 'DELETE'
      },
      function(res) {
        assert.equal(res.statusCode, 204);
        callback();
      });
    },

    // Verify its gone
    function(callback) {
      assert.response(getServer(), {
        url: '/bundles/foo/foo@1.0.tar.gz',
        method: 'GET'
      },
      function(res) {
        assert.equal(res.statusCode, 404);
        callback();
      });
    }

  ],
  function(err) {
    completed = true;
    assert.ifError(err);
  });

  process.on('exit', function() {
    assert.ok(completed, 'Tests completed');
  });
})();
