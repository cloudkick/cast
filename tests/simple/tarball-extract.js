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
var tarball = require('util/tarball');
var async = require('extern/async');
var assert = require('assert');

(function() {
  var completed = false;

  async.series([
    // Extract a tarball
    function(callback) {
      var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
      var expath = path.join(process.cwd(), '.tests/fooserv');
      tarball.extract_tarball(tbpath, expath, 0755, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // Extract a tarball to a path that already exists
    function(callback) {
      var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
      var expath = path.join(process.cwd(), '.tests/fooserv');
      tarball.extract_tarball(tbpath, expath, 0755, function(err) {
        assert.ok(err);
        callback();
      });
    },

    // Extract a tarball that doesn't exist
    function(callback) {
      var tbpath = path.join(process.cwd(), 'data/slowapp.tar.gz');
      var expath = path.join(process.cwd(), '.tests/slowserv');
      tarball.extract_tarball(tbpath, expath, 0755, function(err) {
        assert.ok(err);
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
