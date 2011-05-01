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

var Errorf = require('util/misc').Errorf;


/**
 * A resource that is backed by a directory.
 * @param {String} name The name of this resource's directory.
 * @constructor
 */
function JobManager() {
  this.resourceManagers = {};
}


/**
 * Queue a job to be run on the appropriate resource.
 * @param {Object} job The job to be executed.
 */
JobManager.prototype.run = function(job) {
  var type = job.resourceType.constructor.name;

  if (!this.resourceManagers[type]) {
    throw new Errorf('No resource manager registered for \'%s\'', type);
  }

  var manager = this.resourceManagers[type];
  manager.runJob(job);
};


/**
 * Register a new resource manager.
 * @param {Object} manager The resource manager.
 */
JobManager.prototype.registerResourceManager = function(manager) {
  var type = manager.resourceType.constructor.name;
  this.resourceManagers[type] = manager;
};


exports.JobManager = JobManager;
