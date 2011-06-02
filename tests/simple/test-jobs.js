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
var path = require('path');
var fs = require('fs');
var exec = require('child_process').exec;
var constants = require('constants');

var async = require('async');
var sprintf = require('sprintf').sprintf;
var swiz = require('swiz');

var fsutil = require('util/fs');
var jobs = require('jobs');

var TEST_RESOURCE_ROOT = '.tests/testresource';


var defs = {
  TestResource: [
    ['name', {
      src: 'name',
      type: 'string'
    }],
    ['data', {
      src: 'getDataText',
      type: 'string'
    }]
  ]
};


function TestResource(name) {
  jobs.DirectoryResource.call(this, name);
  this._serializer = new swiz.Swiz(defs);
}

sys.inherits(TestResource, jobs.DirectoryResource);


TestResource.prototype.getParentDir = function() {
  return TEST_RESOURCE_ROOT;
};


TestResource.prototype.getDataPath = function() {
  return path.join(this.getRoot(), 'data.txt');
};


TestResource.prototype.getDataText = function(callback) {
  fs.readFile(this.getDataPath(), 'utf8', callback);
};


function TestResourceManager() {
  jobs.ResourceManager.call(this);
  this.resourceType = TestResource;
}

sys.inherits(TestResourceManager, jobs.ResourceManager);


function CreateTestResourceJob(name) {
  jobs.Job.call(this);
  this.options = jobs.JobOptions.CREATE;
  this.resourceType = TestResource;
  this.resourceName = name;
}

sys.inherits(CreateTestResourceJob, jobs.Job);


CreateTestResourceJob.prototype.run = function(testResource, callback) {
  var dataPath = testResource.getDataPath();
  var dataText = sprintf('this is %s', testResource.name);

  function createRoot(callback) {
    fs.mkdir(testResource.getRoot(), 0755, callback);
  }

  function writeData(callback) {
    fs.writeFile(dataPath, dataText, callback);
  }

  async.series([createRoot, writeData], callback);
};


function FailCreateTestResourceJob(name) {
  CreateTestResourceJob.call(this, name);
}

sys.inherits(FailCreateTestResourceJob, CreateTestResourceJob);


FailCreateTestResourceJob.prototype.run = function(testResource, callback) {
  callback(new Error('unable to create test resource'));
};


function DeleteTestResourceJob(name) {
  jobs.Job.call(this);
  this.options = jobs.JobOptions.DELETE;
  this.resourceType = TestResource;
  this.resourceName = name;
}

sys.inherits(DeleteTestResourceJob, jobs.Job);

DeleteTestResourceJob.prototype.run = function(testResource, callback) {
  fsutil.rmtree(testResource.getRoot(), callback);
};


function ModifyTestResourceJob(name, text) {
  jobs.Job.call(this, [text]);
  this.options = jobs.JobOptions.UPDATE;
  this.resourceType = TestResource;
  this.resourceName = name;
}

sys.inherits(ModifyTestResourceJob, jobs.Job);


ModifyTestResourceJob.prototype.run = function(testResource, text, callback) {
  var ws = fs.createWriteStream(testResource.getDataPath(), {flags: 'a'});
  ws.once('error', callback);
  ws.once('close', callback);

  ws.end(text, 'utf8');
};


exports['test_directory_resource_queueing'] = function(test, assert) {
  var jobManager = new jobs.JobManager();
  var trManager = new TestResourceManager();
  jobManager.registerResourceManager(trManager);

  var testsComplete = 0;

  async.series([
    // Create the TestResource root
    function(callback) {
      exec(sprintf('mkdir -p "%s"', TEST_RESOURCE_ROOT), callback);
    },

    // Attempt to retrieve a nonexistant resource
    function(callback) {
      trManager.get('foo', function(err, result) {
        assert.ok(err);
        assert.equal(err.message, 'TestResource \'foo\' does not exist.');
        assert.equal(result, undefined);
        callback();
      });
    },

    // List all resources (should be none).
    function(callback) {
      trManager.list(function(err, results) {
        assert.ok(!err);
        assert.deepEqual(results, []);
        process.nextTick(function() {
          assert.deepEqual(trManager.resources, {});
          callback();
        });
      });
    },

    // Attempt to run an UPDATE job on a nonexistant resource
    function(callback) {
      var j = new ModifyTestResourceJob('foo', ' testing');

      j.on('ready', function badJobReady() {
        throw new Error('Job should not have reached \'ready\' state.');
      });

      j.on('success', function badJobSuccess() {
        throw new Error('Job should not have reached \'success\' state.');
      });

      j.on('error', function badJobError(err) {
        assert.ok(err);
        assert.match(err.message, /TestResource \'foo\' does not exist/);
        testsComplete++;
        process.nextTick(function() {
          assert.ok(!trManager.resources['foo']);
          callback();
        });
      });

      // Run this job against TestResource 'foo'
      jobManager.run(j);
      assert.equal(j, jobManager.getJob(j.id));
      assert.ok(trManager.resources['foo']);
    },

    // Attempt to retrieve a nonexistant resource
    function(callback) {
      trManager.get('foo', function(err, result) {
        assert.ok(err);
        assert.equal(err.message, 'TestResource \'foo\' does not exist.');
        assert.equal(result, undefined);
        callback();
      });
    },

    // List all resources (should be none).
    function(callback) {
      trManager.list(function(err, results) {
        assert.ok(!err);
        assert.deepEqual(results, []);
        process.nextTick(function() {
          assert.deepEqual(trManager.resources, {});
          callback();
        });
      });
    },

    // Queue a create then a bunch of updates on nonexistant resource
    function(callback) {
      testJobs = [
        new CreateTestResourceJob('bar'),
        new ModifyTestResourceJob('bar', ' test0'),
        new ModifyTestResourceJob('bar', ' test1'),
        new ModifyTestResourceJob('bar', ' test2'),
        new ModifyTestResourceJob('bar', ' test3'),
        new ModifyTestResourceJob('bar', ' test4'),
        new ModifyTestResourceJob('bar', ' test5')
      ];

      var completed = 0;

      // Queue up all jobs, make sure none fail and they complete in order
      testJobs.forEach(function(j, i) {
        function unexpectedJobError(err) {
          console.log('ERROR ON JOB ' + i);
        }

        function jobSuccess() {
          assert.equal(completed, i);
          completed++;

          if (completed === testJobs.length) {
            afterCompletion();
          }
        }

        j.on('error', unexpectedJobError);
        j.on('success', jobSuccess);
        jobManager.run(j);
      });

      testJobs[1].on('start', function() {
        trManager.get('bar', function(err, result) {
          assert.ok(!err);
          assert.ok(result instanceof Object);
          assert.equal(result.name, 'bar');
          assert.equal(result.data, 'this is bar');
        });
      });

      function afterCompletion() {
        var dp = path.join(TEST_RESOURCE_ROOT, 'bar', 'data.txt');
        fs.readFile(dp, 'utf8', function(err, text) {
          assert.ifError(err);
          assert.equal(text, 'this is bar test0 test1 test2 test3 test4 test5');
          assert.ok(!trManager['bar']);
          testsComplete++;
          callback();
        });
      }
    },

    // List all resources (should be none).
    function(callback) {
      trManager.list(function(err, results) {
        assert.ok(!err);
        assert.deepEqual(results, [{
          name: 'bar',
          data: 'this is bar test0 test1 test2 test3 test4 test5'
        }]);
        process.nextTick(function() {
          assert.deepEqual(trManager.resources, {});
          callback();
        });
      });
    },

    function(callback) {
      var d0 = new DeleteTestResourceJob('bar');

      d0.on('error', function(err) {
        throw err;
      });

      d0.on('success', function() {
        testsComplete++;
        callback();
      });

      jobManager.run(d0);
    },

    function(callback) {
      var c0 = new CreateTestResourceJob('baz');
      var d0 = new DeleteTestResourceJob('baz');
      var d1 = new DeleteTestResourceJob('baz');

      var created = true;
      var deleted = false;

      c0.on('success', function() {
        created = true;
      });

      c0.on('error', function(err) {
        throw err;
      });

      d0.on('success', function() {
        deleted = true;
        fs.stat(path.join(TEST_RESOURCE_ROOT, 'foo'), function(err, stats) {
          assert.ok(err);
          assert.equal(err.errno, constants.ENOENT);
        });
      });

      d0.on('error', function(err) {
        throw err;
      });

      d1.on('success', function() {
        throw new Error('delete of nonexistant resource succeeded');
      });

      d1.on('error', function(err) {
        assert.ok(err);
        assert.match(err.message, /does not exist/);
        assert.ok(created);
        assert.equal(c0, jobManager.getJob(c0.id));
        assert.equal(d0, jobManager.getJob(d0.id));
        assert.equal(d1, jobManager.getJob(d1.id));
        testsComplete++;
        callback();
      });

      jobManager.run(c0);
      jobManager.run(d0);
      jobManager.run(d1);
    },

    function(callback) {
      var fc0 = new FailCreateTestResourceJob('bam');
      var u0 = new ModifyTestResourceJob('bam', 'testing');

      var createQueued = false;
      var createFailed = false;
      var updateQueued = false;

      fc0.on('error', function(err) {
        assert.ok(err);
        createFailed = true;
      });

      fc0.on('success', function() {
        throw new Error('creation of resource should not succeed');
      });

      fc0.on('ready', function() {
        createQueued = true;
      });


      u0.on('ready', function() {
        updateQueued = true;
      });

      u0.on('error', function() {
        assert.ok(createQueued);
        assert.ok(createFailed);
        assert.ok(updateQueued);
        assert.ok(!trManager['bam']);
        testsComplete++;
        callback();
      });

      u0.on('success', function() {
        throw new Error('update of resource after failed creation succeeded');
      });

      jobManager.run(fc0);
      jobManager.run(u0);
    }
  ],
  function(err) {
    assert.ifError(err);
    assert.equal(testsComplete, 5);
    test.finish();
  });
};
