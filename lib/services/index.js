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

var sprintf = require('sprintf').sprintf;

var ps = require('util/pubsub');
var log = require('util/log');

/**
 * Base service class
 *
 * @param {String} Service name.
 *
 * @constructor
 */
function Service(serviceName) {
  this.serviceName = serviceName;
  this.isRunning = false;

  this.startedAt = null;
}

/**
 * Start the service.
 */
Service.prototype.start = function() {
  if (this.isRunning) {
    throw new Error('Service is already running');
  }

  this.isRunning = true;
  this.startedAt = new Date();

  log.info(sprintf('Starting service %s', this.serviceName));
  ps.emit(sprintf('cast.agent.services.%s.started',
                  this.serviceName.toLowerCase()));
};

/**
 * Stop the service.
 */
Service.prototype.stop = function() {
  if (!this.isRunning) {
    throw new Error('Service isn\'t running');
  }

  this.isRunning = false;

  log.info(sprintf('Stopping service %s', this.serviceName));
  ps.emit(sprintf('cast.agent.services.%s.stopped',
                  this.serviceName.toLowerCase()));
};

/**
 * Restart the service.
 *
 * @param {Integer} Number of seconds to wait before starting the service (optional).
 */
Service.prototype.restart = function(waitPeriod) {
  var self = this;

  this.stop();

  if (waitPeriod) {
    setTimeout(function() { self.start(); }, waitPeriod * 1000);

    return;
   }

   this.start();
};

/**
 * Return service status.
 */
Service.prototype.getStatus = function() {
  var status = {'running': this.isRunning, 'started_at': this.startedAt };

  return status;
};

exports.Service = Service;
