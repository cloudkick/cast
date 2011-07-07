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
var uuid = require('node-uuid');

var async = require('async');
var sprintf = require('sprintf').sprintf;

var ps = require('util/pubsub');
var log = require('util/log');

var Service = require('services').Service;
var check = require('health');
var httpCheck = require('health/checks/http');

var SERVICE_NAME = 'Health';

/**
 * Class representing a single scheduled check.
 *
 * @param {Check} check Check object.
 * @param {Integer} interval Run interval in miliseconds.
 *
 * @constructor
 */
function ScheduledCheck(check, interval) {
  this.id = uuid();
  this.check = check;
  this.interval = interval || 90000;

  this.timeoutId = null;
  this.isPaused = false;
  this.isScheduled = false;
  this.lastRunDate = null;
}

/**
 * Health service class.

 * @constructor
 */
function Health() {
  Service.call(this, SERVICE_NAME);

  this.activeChecks = {};
}

sys.inherits(Health, Service);

/**
 * Start the service and re-schedule all the unscheduled (not paused) checks.
 */
Health.prototype.start = function() {
  Service.prototype.start.call(this);

  this.scheduleChecks();
};

/**
 * Stop the service and un-schedule all the non-paused scheduled checks.
 */
Health.prototype.stop = function() {
  Service.prototype.stop.call(this);

  for (var checkId in this.activeChecks) {
    if (this.activeChecks.hasOwnProperty(checkId)) {
      this.unscheduleCheck(this.activeChecks[checkId].id);
    }
  }
};

/**
 * Add a new check.
 *
 * @param {ScheduledCheck} scheduledCheck Sccheduled check.
 * @param {Boolean} schedule true to instantly schedule the check,
 *                           false to just add it to the active checks hash
 *                            table.
 */
Health.prototype.addCheck = function(scheduledCheck, schedule) {
  schedule = schedule || false;

  this.activeChecks[scheduledCheck.id] = scheduledCheck;

  if (schedule) {
    this._setInterval(scheduledCheck.id);
    this.activeChecks[scheduledCheck.id].isScheduled = true;

    log.info(sprintf('Check %s added and scheduled to run every %s seconds',
                      scheduledCheck.id, scheduledCheck.interval / 1000));
  }
  else {
    log.info(sprintf('Check %s added, but left unscheduled',
                     scheduledCheck.id));
  }
};

/**
 * Remove and unschedule a check
 *
 * @param {Integer} id Check ID.
 * @return {Boolean} If check was removed.
 */
Health.prototype.removeCheck = function(id) {
  if (!this._checkExists(id)) {
    throw new Error(sprintf('Check with id %s not found', id));
  }

  if (this.activeChecks[id].isScheduled && this.activeChecks[id].timeoutId) {
    this._clearInterval(id);
    this.activeChecks[id].isScheduled = false;
  }

  if (delete this.activeChecks[id]) {
    log.info(sprintf('Removed check with id %s', id));

    return true;
  }

  return false;
};

/**
 * Run a check
 *
 * @param {Integer} id Check ID.
 */
Health.prototype.runCheck = function(id) {
  this.activeChecks[id].check.run();
  this.activeChecks[id].lastRunDate = new Date();
};

/**
 *  Schedule all the unscheduled checks.
 *
 * @param {Boolean} includePaused True to include the paused checks.
 */
Health.prototype.scheduleChecks = function(includePaused) {
  for (var checkId in this.activeChecks) {
    if (this.activeChecks.hasOwnProperty(checkId)) {
      if (!includePaused && this.activeChecks[checkId].isPaused) {
        continue;
      }

      this.scheduleCheck(checkId);
    }
  }
};

/**
 *  Unschedule all the scheduled checks.
 */
Health.prototype.unscheduleChecks = function() {
  for (var checkId in this.activeChecks) {
    if (this.activeChecks.hasOwnProperty(checkId)) {
      this.unscheduleCheck(checkId);
    }
  }
};

/**
 * Schedule a check.
 *
 * @param {Integer} id Check ID.
 */
Health.prototype.scheduleCheck = function(id) {
  if (!this.activeChecks[id].isScheduled && !this.activeChecks[id].timeoutId) {
    this._setInterval(id);
    this.activeChecks[id].isScheduled = true;
  }
};

/**
 * Unschedule a check.
 *
 * @param {Integer} id Check ID.
 */
Health.prototype.unscheduleCheck = function(id) {
  if (this.activeChecks[id].isScheduled && this.activeChecks[id].timeoutId) {
    this._clearInterval(id);
    this.activeChecks[id].isScheduled = false;
  }
};

/**
 * Pause a check.
 *
 * @param {Integer} id Check ID.
 */
Health.prototype.pauseCheck = function(id) {
  if (!this._checkExists(id)) {
    throw new Error(sprintf('Check with id %s not found', id));
  }

  if (this.activeChecks[id].isScheduled && this.activeChecks[id].timeoutId && !this.isPaused) {
    this._clearInterval(id);
    this.activeChecks[id].isScheduled = false;
    this.activeChecks[id].isPaused = true;
  }
};

/**
 * Resume a check.
 *
 * @param {Integer} id Check ID.
 */
Health.prototype.resumeCheck = function(id) {
  if (!this._checkExists(id)) {
    throw new Error(sprintf('Check with id %s not found', id));
  }

  if (!this.activeChecks[id].isScheduled && !this.activeChecks[id].timeoutId && this.isPaused) {
    this._setInterval(id);
    this.activeChecks[id].isScheduled = true;
    this.activeChecks[id].isPaused = false;
  }
};

/**
 * Return all the active checks.
 *
 * @return {Array} Array of ScheduledCheck objects.
 */
Health.prototype.getChecksArray = function() {
  var result = [];
  for (var checkId in this.activeChecks) {
    if (this.activeChecks.hasOwnProperty(checkId)) {
      result.push(this.activeChecks[checkId]);
    }
  }

  return result;
};

Health.prototype._checkExists = function(id) {
  if (!this.activeChecks.hasOwnProperty(id)) {
    return false;
  }

  return true;
};

Health.prototype._setInterval = function(id) {
  var timeoutId;
  var self = this;

  timeoutId = setInterval(function() { self.runCheck(self.activeChecks[id].id); },
                                         self.activeChecks[id].interval);
  this.activeChecks[id].timeoutId = timeoutId;
};

Health.prototype._clearInterval = function(id) {
  clearTimeout(this.activeChecks[id].timeoutId);
  this.activeChecks[id].timeoutId = null;
};

var health = new Health();

function load() {
  function startHealth() {
    health.start();

    ps.emit('cast.agent.services.health.started');
    log.info('health service started');
  }

   function stopHealth() {
     health.stop();

     ps.emit('cast.agent.services.health.stopped');
     log.info('health service stopped');
   }

   ps.on(ps.AGENT_STATE_START, function() {
     if (!health.isRunning) {
       startHealth();
     }
   });

   ps.on(ps.AGENT_STATE_STOP, function() {
    if (health.isRunning) {
      stopHealth();
    }
   });
}

exports.load = load;
exports.health = health;
exports.instance = health;

exports.ScheduledCheck = ScheduledCheck;
