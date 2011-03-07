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
var assert = require('assert');

var instances = require('deployment/instances');
var hooks = require('deployment/hooks');

instance = new instances.Instance('test_instance');
instance._bundle_name = 'test_bundle';
instance.root = path.join(__dirname, '../data/instances/test_instance/');

// Test success (exit code == 0)
(function() {
  var completed = false;

  var callback = function(err, killed, stdout, stderr) {
    assert.ifError(err);
    assert.ok(!killed);

    assert.equal('test hook success stdout', stdout);
    assert.equal('test hook success stderr', stderr);

    completed = true;
  };

  hooks.execute(instance, '1.0', 'hook_success.js', null, [],
                callback);

  process.on('exit', function() {
    assert.ok(completed, 'Tests completed');
  });
})();

// Test failure (exit code != 0)
(function() {
  var completed = false;

  var callback = function(err, killed, stdout, stderr) {
    assert.ok(err);
    assert.ok(!killed);

    assert.equal('test hook failure stdout', stdout);
    assert.equal('test hook failure stderr', stderr);

    completed = true;
  };

  hooks.execute(instance, '1.0', 'hook_failure.js', null, [],
                callback);

  process.on('exit', function() {
    assert.ok(completed, 'Tests completed');
  });
})();

// Test hook args
(function() {
  var completed = false;

  var callback = function(err, killed, stdout, stderr) {
    assert.ifError(err);
    assert.ok(!killed);

    assert.equal('test hook args stdout: test1, test2', stdout);
    assert.equal('test hook args stderr', stderr);

    completed = true;
  };

  hooks.execute(instance, '1.0', 'hook_args.js', null, [ 'test1', 'test2'],
                callback);

  process.on('exit', function() {
    assert.ok(completed, 'Tests completed');
  });
})();

// Test timeout
(function() {
  var completed = false;

  var callback = function(err, killed, stdout, stderr) {
    assert.ok(err);
    assert.ok(killed);

    completed = true;
  };

  hooks.execute(instance, '1.0', 'hook_timeout.js', 300, [],
                callback);

  process.on('exit', function() {
    assert.ok(completed, 'Tests completed');
  });
})();

// Test failure (hook script is not executable)
(function() {
  var completed = false;

  var callback = function(err, killed, stdout, stderr) {
    assert.ok(err);
    assert.ok(!killed);

    completed = true;
  };

  hooks.execute(instance, '1.0', 'hook_not_executable.js', null, [],
                callback);

  process.on('exit', function() {
    assert.ok(completed, 'Tests completed');
  });
})();
