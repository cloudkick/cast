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

var async = require('async');
var sprintf = require('sprintf').sprintf;
var swiz = require('swiz');

var jobs = require('jobs');
var merge = require('util/misc').merge;

/**
 * ResourceManagers that should be instantiated, initialized and registered
 * with the job manager.
 */
var RESOURCE_MANAGERS = [
  {
    module: 'security/ca',
    type: 'SigningRequestManager'
  },
  {
    module: 'deployment/instances',
    type: 'InstanceManager'
  }
];

/**
 * Managers other than resource managers. A manager is essentially any class
 * that that we should create a single agent-wide instance of, and must provide
 * an init method.
 */
var GENERAL_MANAGERS = [
  {
    module: 'tempfiles',
    type: 'TempFileManager'
  },
  {
    module: 'bundles',
    type: 'BundleManager'
  }
];


/**
 * The Cast Agent's JobManager.
 */
var jobManager = null;


/**
 * The Cast Agent's ResourceManagers.
 */
var managers = {};


/**
 * The serializer's definitions.
 */
var serializerDefs = {};


/**
 * The Cast Agent's Swiz instance.
 */
var serializer = new swiz.Swiz(serializerDefs);


/**
 * Register a definition with the serializer.
 * @param {Object} defs A map of type names to definitions.
 */
function registerSerializerDefs(defs) {
  var type;
  for (type in defs) {
    if (defs.hasOwnProperty(type)) {
      serializerDefs[type] = defs[type];
    }
  }
}


/**
 * Initialize the job manager and all resource managers.
 * @param {Function} callback
 */
function initManagers(callback) {
  registerSerializerDefs(jobs.Job.prototype.getSerializerDefs());

  // First we need a JobManager.
  jobManager = new jobs.JobManager();

  function initResourceManager(managerInfo, callback) {
    var constructor = require(managerInfo.module)[managerInfo.type];
    var m = new constructor();

    m.init(function(err) {
      if (!err) {
        managers[managerInfo.type] = m;
        jobManager.registerResourceManager(m);
        registerSerializerDefs(m.resourceType.prototype.getSerializerDefs());
      }
      callback(err);
    });
  }

  function initGeneralManager(managerInfo, callback) {
    var constructor = require(managerInfo.module)[managerInfo.type];
    var m = new constructor();

    m.init(function(err) {
      if (!err) {
        managers[managerInfo.type] = m;
      }
      callback(err);
    });
  }

  // Initialize resource managers then general managers
  async.forEachSeries(RESOURCE_MANAGERS, initResourceManager, function(err) {
    if (!err) {
      async.forEach(GENERAL_MANAGERS, initGeneralManager, callback);
    } else {
      callback(err);
    }
  });
}


/**
 * Get the Cast JobManager.
 */
function getJobManager() {
  return jobManager;
}


/**
 * Get a ResourceManager.
 */
function getManager(name) {
  return managers[name];
}


/**
 * Get the Cast Swiz instance.
 */
function getSerializer() {
  return serializer;
}


exports.initManagers = initManagers;
exports.getManager = getManager;
exports.getJobManager = getJobManager;
exports.getSerializer = getSerializer;
exports.registerSerializerDefs = registerSerializerDefs;
