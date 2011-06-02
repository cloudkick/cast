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

var fs = require('fs');
var sys = require('sys');
var path = require('path');
var constants = require('constants');

var sprintf = require('sprintf').sprintf;
var async = require('async');

var misc = require('util/misc');
var Errorf = misc.Error;
var SupervisedService = require('service_management/base').SupervisedService;
var SupervisedServiceManager = require('service_management/base').SupervisedServiceManager;

function MockService(pathAvailable, pathEnabled, name) {
  SupervisedService.call(this, pathAvailable, pathEnabled, name);

  this.pathAvailable = path.join(this._basePathAvailable, this.name);
  this.pathEnabled = path.join(this._basePathEnabled, this.name);
}

sys.inherits(MockService, SupervisedService);

MockService.prototype.getLogPath = function() {
  return '';
};

MockService.prototype.getDetails = function(callback) {
  callback(null, {});
};

MockService.prototype.isEnabled = function(callback) {
  callback(true);
};

MockService.prototype.restart = function(callback) {
  callback(null);
};

MockService.prototype.start = function(callback) {
  callback(null);
};

MockService.prototype.stop = function(callback) {
  callback(null);
};

MockService.prototype.kill = function(callback) {
  callback(null);
};

MockService.prototype.enable = function(callback) {
  callback(null);
};

/**
 * Disable a service by removing the symlink to it from the enabled directory
 *
 * @param {Function} callback A callback with a possible error.
 */
MockService.prototype.disable = function(callback) {
  callback(null);
};

MockService.prototype.destroy = function(callback) {
  callback(null);
};

function MockServiceManager(pathAvailable, pathEnabled) {
  SupervisedServiceManager.call(this, pathAvailable, pathEnabled);
}

sys.inherits(MockServiceManager, SupervisedServiceManager);

MockServiceManager.prototype.getService = function(name, callback) {
  var self = this;
  callback(null, new MockService(self.pathAvailable, self.pathEnabled, name));
};

MockServiceManager.prototype.listServicesDetails = function(callback) {
  var self = this;
  var services = [];

  callback(null, services);
};

MockServiceManager.prototype.createService = function(serviceName, serviceTemplate, callback) {
  callback(null);
};

MockServiceManager.prototype.runAction = function(serviceName, action, callback) {
  var validActions = ['getDetails', 'isEnabled', 'start', 'stop', 'restart',
                      'enable', 'disable', 'destroy'];

  if (!misc.inArray(action, validActions)) {
    callback(new Errorf('Invalid action: %s', action));
    return;
  }

  callback(null);
};

function getManager(pathAvailable, pathEnabled) {
  return new MockServiceManager(pathAvailable, pathEnabled);
}

exports.configDefaults = {};
exports.getManager = getManager;
exports.MockService = MockService;
exports.MockServiceManager = MockServiceManager;
