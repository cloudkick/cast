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

var async = require('async');

var agentManagers = require('cast-agent/managers');
var jobs = require('jobs');
var instances = require('deployment/instances');


function getInstanceManager() {
  return agentManagers.getManager('InstanceManager');
}


/**
 * A Job that executes a service action.
 * @extends {jobs.Job}
 * @param {String} name The name of the Instance to execute the action against.
 * @param {String} action The name of the service action to execute.
 */
function ServiceActionJob(name, action) {
  jobs.Job.call(this, [action]);
  this.options = jobs.JobOptions.UPDATE;
  this.resourceName = name;
  this.resourceType = instances.Instance;
}

util.inherits(ServiceActionJob, jobs.Job);


/**
 * Execute a service action.
 * @param {deployment.instances.Instance} instance The Instance to act on.
 * @param {String} action The name of the action to run.
 * @param {Function} callback A callback fired with (err).
 */
ServiceActionJob.prototype.run = function(instance, action, callback) {
  instance.serviceAction(action, callback);
};


function getService(name, callback) {
  getInstanceManager().get(name, function(err, instance) {
    if (err) {
      callback(err);
    } else {
      callback(null, instance.service);
    }
  });
}


function listServices(callback) {
  var services;

  getInstanceManager().list(function(err, instances) {
    if (err) {
      callback(err);
    } else {
      services = instances.map(function(instance) {
        return instance.service;
      });
      callback(null, services);
    }
  });
}


function enableService(name, callback) {
  var j = new ServiceActionJob(name, 'enable');
  agentManagers.getJobManager().run(j);
  return j;
}


function disableService(name, callback) {
  var j = new ServiceActionJob(name, 'disable');
  agentManagers.getJobManager().run(j);
  return j;
}


function startService(name, callback) {
  var j = new ServiceActionJob(name, 'start');
  agentManagers.getJobManager().run(j);
  return j;
}


function stopService(name, callback) {
  var j = new ServiceActionJob(name, 'stop');
  agentManagers.getJobManager().run(j);
  return j;
}


function restartService(name, callback) {
  var j = new ServiceActionJob(name, 'restart');
  agentManagers.getJobManager().run(j);
  return j;
}


function tailServiceLog(name, bytes, follow, callback) {
  var services;

  getInstanceManager().getLive(name, function(err, instance) {
    if (err) {
      callback(err);
    } else {
      instance.tailServiceLog(bytes, follow, callback);
    }
  });
}


exports.getService = getService;
exports.listServices = listServices;
exports.enableService = enableService;
exports.disableService = disableService;
exports.startService = startService;
exports.stopService = stopService;
exports.restartService = restartService;
exports.tailServiceLog = tailServiceLog;
