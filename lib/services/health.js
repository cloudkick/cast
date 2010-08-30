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
var uuid = require('extern/uuid');
 
var async = require('extern/async');
var sprintf = require('extern/sprintf').sprintf;

var ps = require('util/pubsub');
var log = require('util/log');

var Service = require('services').Service;
var check = require('health');
var http_check = require('health/checks/http');

var SERVICE_NAME = 'Health';

/**
 * Class representing a single scheduled check.
 *
 * @param {Check} Check object
 * @param {Integer} Run interval in miliseconds
 *
 * @constructor
 */
function ScheduledCheck(check, interval) {
  this.id = uuid.uuid();
  this.check = check;
  this.interval = interval || 90000;
  
  this.timeout_id = null;
  this.is_paused = false;
  this.is_scheduled = false;
  this.last_run_date = null;
}

/**
 * Health service class.
 
 * @constructor
 */
function Health() {
  Service.call(this, SERVICE_NAME);
  
  this.active_checks = {};
}

sys.inherits(Health, Service);

/**
 * Start the service and re-schedule all the unscheduled (not paused) checks.
 */
Health.prototype.start = function() {
  Service.prototype.start.call(this);

  this.schedule_checks();
};

/**
 * Stop the service and un-schedule all the non-paused scheduled checks.
 */
Health.prototype.stop = function() {
  Service.prototype.stop.call(this);

  for (var check_id in this.active_checks) {
    this.unschedule_check(this.active_checks[check_id].id);
  }
};

/**
 * Add a new check.
 *
 * @param {ScheduledCheck} Sccheduled check
 */
Health.prototype.add_check = function(scheduled_check) {
  var self = this;
  var timeout_id;
  
  this.active_checks[scheduled_check.id] = scheduled_check;
  this._set_interval(scheduled_check.id);
  this.active_checks[scheduled_check.id].is_scheduled = true;
  
  log.info(sprintf('Check %s added and scheduled to run every %s seconds', scheduled_check.id, scheduled_check.interval / 1000));
};

/**
 * Remove and unschedule a check
 *
 * @param {Integer} id Check ID
 */
Health.prototype.remove_check = function(id) {
  if (!this._check_exists(id)) {
    throw new Error(sprintf('Check with id %s not found', id));
  };

  if (this.active_checks[id].is_scheduled && this.active_checks[id].timeout_id) {
    this._clear_interval(id);
    this.active_checks[id].is_scheduled = false;
  }
  
  if (delete this.active_checks[id]) {
    return true;
    
    log.info(sprintf('Removed check with id %s', id))
  }
  
  return false;
};

/**
 * Run a check
 *
 * @param {Integer} id Check ID
 */
Health.prototype.run_check = function(id) {
  this.active_checks[id].check.run();
  this.active_checks[id].last_run_date = new Date();
};

/**
 *  Schedule all the unscheduled checks.
 *
 * @param {Boolean} include_paused True to include the paused checks
 */
Health.prototype.schedule_checks = function(include_paused) {
  for (var check_id in this.active_checks) {
    if (!include_paused && this.active_checks[check_id].is_paused) {
      continue;
    }
    
    this.schedule_check(check_id);
  }
};

/**
 *  Unschedule all the scheduled checks.
 */
Health.prototype.unschedule_checks = function() {
  for (var check_id in this.active_checks) {
    this.unschedule_check(check_id);
  }
};

/**
 * Schedule a check.
 *
 * @param {Integer} id Check ID
 */
Health.prototype.schedule_check = function(id) {
  if (!this.active_checks[id].is_scheduled && !this.active_checks[id].timeout_id) {
    this._set_interval(id);
    this.active_checks[id].is_scheduled = true;
  }
};

/**
 * Unschedule a check.
 *
 * @param {Integer} id Check ID
 */
Health.prototype.unschedule_check = function(id) {
  if (this.active_checks[id].is_scheduled && this.active_checks[id].timeout_id) {
    this._clear_interval(id);
    this.active_checks[id].is_scheduled = false;
  }
};

/**
 * Pause a check.
 *
 * @param {Integer} id Check ID
 */
Health.prototype.pause_check = function(id) {
  if (!this._check_exists(id)) {
    throw new Error(sprintf('Check with id %s not found', id));
  };
  
  if (this.active_checks[id].is_scheduled && this.active_checks[id].timeout_id && !this.is_paused) {
    this._clear_interval(id);
    this.active_checks[id].is_scheduled = false;
    this.active_checks[id].is_paused = true;
  }
};

/**
 * Resume a check.
 *
 * @param {Integer} id Check ID
 */
Health.prototype.resume_check = function(id) {
  if (!this._check_exists(id)) {
    throw new Error(sprintf('Check with id %s not found', id));
  };
  
  if (!this.active_checks[id].is_scheduled && !this.active_checks[id].timeout_id && this.is_paused) {
    this._set_interval(id);
    this.active_checks[id].is_scheduled = true;
    this.active_checks[id].is_paused = false;
  }
};

/**
 * Return all the active checks.
 *
 * @return {Array} Array of ScheduledCheck objects
 */
Health.prototype.get_checks_array = function() {
  result = [];
  for (var check_id in this.active_checks) {
      result.push(this.active_checks[check_id]);
    }

  return result;
};

Health.prototype._check_exists = function(id) {
  if (!this.active_checks.hasOwnProperty(id)) {
    return false;
  }
  
  return true;
}

Health.prototype._set_interval = function(id) {
  var self = this;

  timeout_id = setInterval(function () { self.run_check(self.active_checks[id].id); }, 
                                         self.active_checks[id].interval);
  this.active_checks[id].timeout_id = timeout_id;
};

Health.prototype._clear_interval = function(id) {
  clearTimeout(this.active_checks[id].timeout_id);
  this.active_checks[id].timeout_id = null;
};

var health = new Health();

load = function() {
  function start_health() {
    health.start();

    ps.emit('cast.agent.services.health.started');
    log.info('health service started');
  }

   function stop_health() {
     health.stop();
     
     ps.emit('cast.agent.services.health.stopped');
     log.info('health service stopped');
   };
   
   ps.on(ps.AGENT_STATE_START, function() {
     if (!health.is_running) {
       start_health();
     }
   });
   
   ps.on(ps.AGENT_STATE_STOP, function() {
    if (health.is_running) {
      stop_health();
    }
   });

};

exports.load = load;
exports.health = health;
