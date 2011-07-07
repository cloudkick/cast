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
 *
 * @param {Integer} checkId Check ID.
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

/**
 * Add a new check.
 *
 * @param {ScheduledCheck} scheduledCheck Sccheduled check.
 * @param {Boolean} schedule true to instantly schedule the check,
 *                           false to just add it to the active checks hash
 *                            table.
 * @param {Function} callback A callback fired with (err).
 */
function addCheck(scheduledCheck, schedule, callback) {
  health.addCheck(scheduledCheck, schedule);
  callback(null);
}

/**
 * Remove and unschedule a check
 *
 * @param {Integer} id Check ID.
 * @param {Function} callback A callback called with (err, removed)
 */
function removeCheck(checkId, callback) {
  var removed = false;

  try {
    removed = health.removeCheck(checkId);
  }
  catch (err) {
    callback(err, removed);
    return;
  }

  callback(null, removed);
}

/**
 * Resume a check.
 *
 * @param {Integer} checkId Check ID.
 * @param {Function} callback A callback fired with (err).
 */
function resumeCheck(checkId, callback) {
  try {
    health.resumeCheck(checkId);
  }
  catch (err) {
    callback(err);
    return;
  }

  callback(null);
}

/**
 * Pause a check.
 *
 * @param {Integer} checkId Check ID.
 * @param {Function} callback A callback fired with (err).
 */
function pauseCheck(checkId, callback) {
  try {
    health.pauseCheck(checkId);
  }
  catch (err) {
    callback(err);
    return;
  }

  callback(null);
}

exports.listChecks = listChecks;
exports.listScheduledChecks = listScheduledChecks;
exports.getCheck = getCheck;
exports.addCheck = addCheck;
exports.removeCheck = removeCheck;
exports.resumeCheck = resumeCheck;
exports.pauseCheck = pauseCheck;
