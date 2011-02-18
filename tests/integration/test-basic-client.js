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
var path = require('path');
var crypto = require('crypto');
var exec = require('child_process').exec;
var async = require('extern/async');
var assert = require('assert');

function getServer() {
  return require('services/http')._serverOnly();
}

(function() {
  var completed = false;
  var cbin = path.normalize(path.join(process.cwd(), '..', 'bin', 'cast'));
  var aroot = path.join(process.cwd(), '.tests');
  var croot = path.join(process.cwd(), '.tests/fooserv');
  var tbp = path.join(process.cwd(), 'data/fooserv.tar.gz');

  var copts = {
    cwd: croot
  };

  function cexec(args, callback) {
    args.unshift(cbin);
    exec(args.join(' '), copts, callback);
  }

  async.series([
    async.apply(exec, 'mkdir -p ' + aroot),

    async.apply(exec, 'tar -C ' + aroot + ' -xf ' + tbp),

    function(callback) {
      cexec(['bundles', 'create', 'v1.0'], function(err, stdout, stderr) {
        assert.ifError(err);
        assert.match(stdout, /validation succeeded/);
        assert.match(stdout, /Bundle created/);
        assert.equal(stderr.length, 0);
        callback();
      });
    },
  ],
  function(err) {
    completed = true;
    assert.ifError(err);
  });

  process.on('exit', function() {
    assert.ok(completed, 'Tests completed');
  });
})();
