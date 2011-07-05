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

var health = require('services/health').health;
var jobs = require('jobs');


/**
 * Retrieve a list of all checks.
 * @param {Function} callback A callback fired with (err, checks).
 */
function listChecks(callback) {
  callback(null, health.getChecksArray());
}


/**
 * Retrieve a list of all scheduled checks.
 * @param {Function} calback A callback fired with (err, checks).
 */
function listScheduledChecks(callback) {
  var checks = health.getChecksArray().filter(function(check) {
    return check.isScheduled;
  });
  callback(null, checks);
}


/**
 * Retrieve an individual check by its id.
 * @param {Function} callback A callback fired with (err, check).
 */
function getCheck(checkId, callback) {
  var check = health.activeChecks[checkId];

  if (!check) {
    callback(new jobs.NotFoundError('Check', checkId));
  } else {
    callback(null, check);
  }
}


exports.listChecks = listChecks;
exports.listScheduledChecks = listScheduledChecks;
exports.getCheck = getCheck;
