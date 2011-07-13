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

var agentManagers = require('cast-agent/managers');

/**
 * Retrieve a list of all jobs. Note: there is currently no need for this to be
 * async, but we are likely to need it to be async in the future.
 * @param {Function} callback A callback fired with (err, jobs).
 */
function listJobs(callback) {
  agentManagers.getJobManager().listJobs(callback);
}


/**
 * Retrieve a job based on its id. Note: there is currently no need for this to
 * be async, but we are likely to need it to be async in the future.
 * @param {String} id The id of the job to retrieve.
 * @param {Function} callback A callback fired with (err, job).
 */
function getJob(id, callback) {
  agentManagers.getJobManager().getJob(id, callback);
}


exports.listJobs = listJobs;
exports.getJob = getJob;
