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
instance._bundleName = 'test_bundle';
instance.root = path.join(__dirname, '../data/instances/test_instance/');

var instance_version_path = path.join(instance.root, 'versions/test_bundle@1.0');
var hooks_path = path.join(instance_version_path, '.cast-project/hooks');

// Test success (exit code == 0)
(function() {
  var n = 0;

  var callback = function(err, killed, stdout, stderr) {
    assert.ifError(err);
    assert.ok(!killed);

    assert.equal('test hook success stdout', stdout);
    assert.equal('test hook success stderr', stderr);

    n++;
  };

  var hook_file = 'hook_success.js';
  var base_hook = new hooks.Hook('pre', hook_file,
                                  path.join(hooks_path, hook_file),
                                  false);
  var instance_hook = new hooks.InstanceHook('pre', hook_file,
                                             instance_version_path);
  base_hook.execute(null, [], callback);
  instance_hook.execute(null, [], callback);

  process.on('exit', function() {
    assert.equal(n, 2, 'Tests completed');
  });
})();

// Test failure (exit code != 0)
(function() {
  var n = 0;

  var callback = function(err, killed, stdout, stderr) {
    assert.ok(err);
    assert.ok(!killed);

    assert.equal('test hook failure stdout', stdout);
    assert.equal('test hook failure stderr', stderr);

    n++;
  };

  var hook_file = 'hook_failure.js';
  var base_hook = new hooks.Hook('pre', hook_file,
                                  path.join(hooks_path, hook_file),
                                  false);
  var instance_hook = new hooks.InstanceHook('pre', hook_file,
                                             instance_version_path);
  base_hook.execute(null, [], callback);
  instance_hook.execute(null, [], callback);

  process.on('exit', function() {
    assert.equal(n, 2, 'Tests completed');
  });
})();

// Test hook args
(function() {
  var n = 0;

  var callback = function(err, killed, stdout, stderr) {
    assert.ifError(err);
    assert.ok(!killed);

    assert.equal('test hook args stdout: test1, test2', stdout);
    assert.equal('test hook args stderr', stderr);

    n++;
  };

  var hook_file = 'hook_args.js';
  var base_hook = new hooks.Hook('pre', hook_file,
                                  path.join(hooks_path, hook_file),
                                  false);
  var instance_hook = new hooks.InstanceHook('pre', hook_file,
                                             instance_version_path);
  base_hook.execute(null, [ 'test1', 'test2'], callback);
  instance_hook.execute(null, [ 'test1', 'test2'], callback);

  process.on('exit', function() {
    assert.equal(n, 2, 'Tests completed');
  });
})();

// Test timeout
(function() {
  var n = 0;

  var callback = function(err, killed, stdout, stderr) {
    assert.ok(err);
    assert.match(err, /timeout/);
    assert.ok(killed);

    n++;
  };

  var hook_file = 'hook_timeout.js';
  var base_hook = new hooks.Hook('pre', hook_file,
                                  path.join(hooks_path, hook_file),
                                  false);
  var instance_hook = new hooks.InstanceHook('pre', hook_file,
                                             instance_version_path);
  base_hook.execute(300, [], callback);
  instance_hook.execute(300, [], callback);

  process.on('exit', function() {
    assert.equal(n, 2, 'Tests completed');
  });
})();

// Test failure (hook script is not executable)
(function() {
  var n = 0;

  var callback = function(err, killed, stdout, stderr) {
    assert.ok(err);
    assert.match(err, /status 127/);
    assert.ok(!killed);

    n++;
  };

  var hook_file = 'hook_not_executable.js';
  var base_hook = new hooks.Hook('pre', hook_file,
                                  path.join(hooks_path, hook_file),
                                  false);
  var instance_hook = new hooks.InstanceHook('pre', hook_file,
                                             instance_version_path);
  base_hook.execute(null, [], callback);
  instance_hook.execute(null, [], callback);

  process.on('exit', function() {
    assert.equal(n, 2, 'Tests completed');
  });
})();

// Test failure (hook file does not exist)
(function() {
  var n = 0;

  var callback1 = function(err, killed, stdout, stderr) {
    assert.ok(!err);
    assert.ok(!killed);

    n++;
  };

  var callback2 = function(err, killed, stdout, stderr) {
    assert.ok(err);
    assert.match(err, /does not exist/);
    assert.ok(!killed);

    n++;
  };

  var hook_file = 'hook_not_exists.js';
  var hook1 = new hooks.InstanceHook('pre', hook_file,
                                     instance_version_path, false);
  var hook2 = new hooks.InstanceHook('pre', hook_file,
                                     instance_version_path, true);
  hook1.execute(null, [], callback1);
  hook2.execute(null, [], callback2);

  process.on('exit', function() {
    assert.equal(n, 2, 'Tests completed');
  });
})();
