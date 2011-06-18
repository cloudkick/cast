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

var util = require('util');

var agentManagers = require('cast-agent/managers');
var jobs = require('jobs');
var instances = require('deployment/instances');


/**
 * Create an instance.
 * @extends {jobs.Job}
 * @param {String} name The name of the Instance.
 * @param {String} bundleName The name of the bundle to use.
 * @param {String} bundleVersion The version of the bundle to use.
 */
function CreateInstanceJob(name, bundleName, bundleVersion) {
  jobs.Job.call(this, [bundleName, bundleVersion]);
  this.options = jobs.JobOptions.CREATE;
  this.resourceName = name;
  this.resourceType = instances.Instance;
}

util.inherits(CreateInstanceJob, jobs.Job);


/**
 * Create an Instance.
 * @param {deployment.instances.Instance} instance The Instance to create.
 * @param {String} bundleName The name of the bundle to use.
 * @param {String} bundleVersion The version of the bundle to use.
 * @param {Function} callback A callback fired with (err).
 */
CreateInstanceJob.prototype.run = function(instance, bundleName, bundleVersion, callback) {
  instance.create(bundleName, bundleVersion, callback);
};


/**
 * Get an instance by name.
 * @param {String} name The name of the instance.
 * @param {Function} callback A callback fired with (err, instance).
 */
function getInstance(name, callback) {
  agentManagers.getManager('InstanceManager').get(name, callback);
}


/**
 * List existing instances.
 * @param {Function} callback A callback fired with (err, instances).
 */
function listInstances(callback) {
  agentManagers.getManager('InstanceManager').list(callback);
}


/**
 * Create a new instance.
 * @param {String} name The name of the instance to create.
 * @param {String} bundleName The name of the bundle to use.
 * @param {String} bundleVersion The version of the bundle to use.
 */
function createInstance(name, bundleName, bundleVersion) {
  var j = new CreateInstanceJob(name, bundleName, bundleVersion);
  agentManagers.getJobManager().run(j);
  return j;
}


exports.getInstance = getInstance;
exports.listInstances = listInstances;
exports.createInstance = createInstance;

