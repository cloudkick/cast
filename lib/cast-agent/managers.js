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

/**
 * ResourceManagers that should be instantiated, initialized and registered
 * with the job manager.
 */
var RESOURCE_MANAGERS = [
  {
    module: 'security/ca',
    type: 'SigningRequestManager'
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
 * The Cast Agent's Swiz instance.
 */
var serializer = null;


/**
 * Initialize the job manager and all resource managers.
 * @param {Function} callback
 */
function initManagers(callback) {
  var swizDefs = {};

  // First we need a JobManager.
  jobManager = new jobs.JobManager();

  // Initialize an individual ResourceManager.
  function initResourceManager(managerInfo, callback) {
    var constructor = require(managerInfo.module)[managerInfo.type];
    var m = new constructor();

    m.init(function(err) {
      if (!err) {
        managers[managerInfo.type] = m;
        jobManager.registerResourceManager(m);
        swizDefs[m.resourceType.name] =
            m.resourceType.prototype.getSerializerDef();
      }
      callback(err);
    });
  }

  // Initialize all of the managers.
  async.forEachSeries(RESOURCE_MANAGERS, initResourceManager, function(err) {
    if (!err) {
      serializer = new swiz.Swiz(swizDefs);
    }
    callback(err);
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
