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
 
var log = require('util/log');
var sprintf = require('extern/sprintf').sprintf;

var SERVICE_NAME = '';

/**
 * Base service class
 *
 * @param {String} Service name.
 *
 * @constructor
 */
function Service(service_name) {
  this.service_name = service_name;
  this.is_running = false;
  
  this.started_at = null;
}

/**
 * Start the service.
 */
Service.prototype.start = function() {
  if (this.is_running) {
    throw new Error('Service is already running');
  }
  
  this.is_running = true;
  this.started_at = new Date();
  
  log.info(sprintf('Starting service %s', this.service_name));
};

/**
 * Stop the service.
 */
Service.prototype.stop = function() {
  if (!this.is_running) {
    throw new Error('Service isn\'t running');
  }
  
  this.is_running = false;
  
  log.info(sprintf('Stopping service %s', this.service_name));
};

/**
 * Restart the service.
 *
 * @param {Integer} Number of seconds to wait before starting the service (optional).
 */
Service.prototype.restart = function(wait_period) {
  var self = this;
  
  this.stop();
  
  if (wait_period) {
    setTimeout(function() { self.start(); }, wait_period * 1000);
    
    return;
   }
   
   this.start();
};

/**
 * Return service status.
 */
Service.prototype.get_status = function() {
  var status = {'running': this.is_running, 'started_at': this.started_at };
  
  return status;
};

exports.Service = Service;
