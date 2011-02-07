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

process.chdir(__dirname);
require.paths.unshift('../lib');

var fs = require('fs');
var sys = require('sys');
var path = require('path');
var spawn = require('child_process').spawn;
var config = require('util/config');
var ps = require('util/pubsub');
var async = require('extern/async');
var sprintf = require('extern/sprintf').sprintf;

var TEST_TIMEOUT = 5 * 1000;
var MAX_BUFFER = 512 * 1024;
var EXCLUDE_DIRS = [
  'data'
];

var total = 0;
var successes = 0;
var failures = 0;

function equals_line(str) {
  return  "\033[34m===================="
        + "\033[31m " + str + " "
        + "\033[34m===================="
        + "\033[0m";
}

function execute_test(dir, file, callback) {
  var args = ['common.js', sprintf('./%s/%s', dir, file)];
  var child = spawn(process.execPath, args);
  var stderr = [];
  var stdout = [];
  var dead = false;
  var timed_out = false;
  var timeout_id;

  child.stderr.on('data', function(chunk) {
    stderr.push(chunk);
  });

  child.stdout.on('data', function(chunk) {
    stdout.push(chunk);
  });

  child.on('exit', function(code) {
    clearTimeout(timeout_id);
    if (code !== 0) {
      sys.puts(equals_line(sprintf("%s/%s", dir, file)));
      if (timed_out) {
        sys.puts('--- test timed out ---');
      }
      sys.puts('--- exit code: ' + code + ' ---');
      if (stderr.length > 0) {
        sys.puts('--- stderr ---');
        sys.puts(stderr.join(''));
      }
      if (stdout.length > 0) {
        sys.puts('--- stdout ---');
        sys.puts(stdout.join(''));
      }
      failures += 1;
    }
    else {
      successes += 1;
    }
    total += 1;
    return callback();
  });

  timeout_id = setTimeout(function() {
    timed_out = true;
    child.kill('SIGKILL');
  }, TEST_TIMEOUT);
}

fs.readdir(__dirname, function(err, dirs) {
  async.forEachSeries(dirs, function(dir, callback) {
    // Skip excluded directories
    if (EXCLUDE_DIRS.indexOf(dir) !== -1) {
      return callback();
    }

    fs.readdir(dir, function(err, files) {
      // This is the dirty way to skip non-directories
      if (err) {
        return callback();
      }

      async.forEachSeries(files, function(file, callback) {
        if (!file.match(/.*\.js$/)) {
          return callback();
        }

        // Execute the test file and report any errors
        execute_test(dir, file, callback);
      }, callback);
    });
  },
  function() {
    sys.puts(equals_line("Tests Complete"));
    sys.puts("    Successes: " + successes);
    sys.puts("     Failures: " + failures);
    sys.puts("    ------------------");
    sys.puts("        Total: " + total);
  });
});
