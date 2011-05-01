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

var async = require('async');
var sprintf = require('sprintf').sprintf;

var jobs = require('jobs');
var assert = require('./../assert');


var TEST_RESOURCE_ROOT = '.tests/testresource';


function TestResource(name) {
  jobs.DirectoryResource.call(this, name);
  this.parentDir = TEST_RESOURCE_ROOT;
}

sys.inherits(TestResource, jobs.DirectoryResource);


TestResource.prototype.getDataPath = function() {
  return path.join(this.getRoot(), 'data.txt');
};


function TestResourceManager() {
  jobs.ResourceManager.call(this);
  this.resourceType = TestResource;
}

sys.inherits(TestResourceManager, jobs.ResourceManager);


function CreateTestResourceJob() {
  jobs.Job.call(this);
  this.options = jobs.JobOptions.CREATE;
}

sys.inherits(CreateTestResourceJob, jobs.Job);


CreateTestResourceJob.prototype.run = function(testResource, callback) {
  var dataPath = this.getDataPath();
  var dataText = sprintf('this is %s', testResource.name);

  function createRoot(callback) {
    fs.mkdir(testResource.getRoot(), callback);
  }

  function writeData(callback) {
    fs.writeFile(dataPath, dataText, callback);
  }

  async.series([createRoot, writeData], callback);
};


function ModifyTestResourceJob(text) {
  jobs.Job.call(this, [text]);
  this.options = jobs.JobOptions.UPDATE;
}

sys.inherits(ModifyTestResourceJob, jobs.Job);


ModifyTestResourceJob.prototype.run = function(testResource, text) {
  ws = fs.createWriteStream(this.getDataPath(), {flags: 'a'});
  ws.once('error', callback);
  ws.once('close', callback);

  ws.end(text, 'utf8');
};


exports['test_directory_resource_queueing'] = function() {
  var m = new TestResourceManager();

  async.series([
    // Create the TestResource root
    function(callback) {
      exec(sprintf('mkdir -p "%s"', TEST_RESOURCE_ROOT), callback);
    },

    // Attempt to run an UPDATE job on a nonexistant resource
    function(callback) {
      var j = new ModifyTestResourceJob(' testing');

      j.on('ready', function badJobReady() {
        throw new Error('Job should not have reached \'ready\' state.');
      });

      j.on('success', function badJobSuccess() {
        throw new Error('Job should not have reached \'success\' state.');
      });

      j.on('error', function badJobError(err) {
        console.log(err);
        assert.ok(err);
        assert.match(err.message, /TestResource \'foo\' does not exist/);
      });

      // Run this job against TestResource 'foo'
      m.runJob('foo', j);
    },

    // Queue a create then a bunch of updates on nonexistant resource
    function(callback) {
      testJobs = [
        new CreateTestResourceJob(),
        new UpdateTestResourceJob(' test0'),
        new UpdateTestResourceJob(' test1'),
        new UpdateTestResourceJob(' test2'),
        new UpdateTestResourceJob(' test3'),
        new UpdateTestResourceJob(' test4'),
        new UpdateTestResourceJob(' test5')
      ];

      var completed = 0;

      // Queue up all jobs, make sure none fail and they complete in order
      testJobs.forEach(function(j, i) {
        function unexpectedJobError(err) {
          console.log('ERROR ON JOB ' + i);
          throw err;
        }

       
        function jobSuccess() {
          assert.equal(completed, i);
          completed++;

          if (completed === testJobs.length) {
            afterCompleting();
          }
        }

        j.on('error', unexpectedJobError);
        j.on('sucess', jobSuccess);
        m.runJob('bar', j);
      });

      function afterCompletion() {
        var dp = path.join(TEST_RESOURCE_ROOT, 'bar', 'data.txt');
        fs.readFile(dp, 'utf8', function(err, text) {
          assert.ifError(err);
          assert.equal(text, 'this is bar test0 test1 test2 test3 test4 test5');
          callback();
        });
      }
    }
  ],
  function(err) {
    assert.ifError(err);
  });
};
