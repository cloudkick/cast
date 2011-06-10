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

var uuid = require('node-uuid');

var Errorf = require('util/misc').Errorf;
var errors = require('./errors');


/**
 * A resource that is backed by a directory.
 * @param {String} name The name of this resource's directory.
 * @constructor
 */
function JobManager() {
  this._resourceManagers = {};
  this._jobs = {};
}


/**
 * Queue a job to be run on the appropriate resource.
 * @param {Object} job The job to be executed.
 */
JobManager.prototype.run = function(job) {
  var type = job.resourceType.name;

  if (!this._resourceManagers[type]) {
    throw new Errorf('No resource manager registered for \'%s\'', type);
  }

  // Assign the job an ID
  job.id = uuid();
  this._jobs[job.id] = job;

  var manager = this._resourceManagers[type];
  manager.runJob(job);
};


/**
 * Retrieve a list of all jobs.
 * @param {Function} callback A callback fired with (err, jobs).
 */
JobManager.prototype.listJobs = function(callback) {
  var self = this;
  var keys = Object.keys(this._jobs);

  function idToJob(id) {
    return self._jobs[id];
  }

  callback(null, keys.map(idToJob));
};


/**
 * Retrieve a job based on its id.
 * @param {String} id The id of the job to retrieve.
 * @param {Function} callback A callback fired with (err, job).
 */
JobManager.prototype.getJob = function(id, callback) {
  if (this._jobs[id]) {
    callback(null, this._jobs[id]);
  } else {
    callback(new errors.NotFoundError('Job', id));
  }
};


/**
 * Register a new resource manager.
 * @param {Object} manager The resource manager.
 */
JobManager.prototype.registerResourceManager = function(manager) {
  var type = manager.resourceType.name;
  this._resourceManagers[type] = manager;
};


exports.JobManager = JobManager;
