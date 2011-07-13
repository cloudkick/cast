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

var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;

var async = require('async');

var managers = require('cast-agent/managers');
var instances = require('deployment/instances');
var control = require('control');


exports['setUp'] = function(test, assert) {
  managers.initManagers(function(err) {
    assert.ifError(err);
    test.finish();
  });
};


exports['test_jobs'] = function(test, assert) {
  var job = null;

  async.series([
    async.apply(exec, 'mkdir -p .tests/data_root/services'),
    async.apply(exec, 'mkdir -p .tests/data_root/services-enabled'),

    // Prepare an extracted bundle
    function(callback) {
      var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
      var tbStream = fs.createReadStream(tbpath);
      control.bundles.addBundle('fooapp', '1.0', tbStream, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // Create an instance from the bundle
    function(callback) {
      job = control.instances.createInstance('foo0', 'fooapp', '1.0');

      job.on('success', callback);
      job.on('error', assert.fail.bind(assert));
    },

    // Retrieve the job, inspect it
    function(callback) {
      control.jobs.getJob(job.id, function(err, retrievedJob) {
        assert.ifError(err);
        assert.equal(retrievedJob.resourceType, instances.Instance);
        assert.equal(retrievedJob.resourceName, 'foo0');
        assert.deepEqual(retrievedJob.args, ['fooapp', '1.0']);
        assert.equal(retrievedJob, job);
        callback();
      });
    },

    // List jobs, make sure it matches
    function(callback) {
      control.jobs.listJobs(function(err, jobs) {
        assert.ifError(err);
        assert.equal(jobs.length, 1);
        assert.equal(jobs[0], job);
        callback();
      });
    }
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};
