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

/*
 * Class representing a supervised service.
 *
 * @param {String} basedir The directory in which the service resides.
 * @param {String} pathAvailable The directory in which the available service reside.
 * @param {String} pathEnabled The directory in which the enabled service reside.
 * @param {String} name Service name.
 * 
 * @constructor
 */
function SupervisedService(pathAvailable, pathEnabled, name) {
  this._basePathAvailable = pathAvailable;
  this._basePathEnabled = pathEnabled;

  this.name = name;
}


/**
 * Retrieve serializer type.
 */
SupervisedService.prototype.getSerializerType = function() {
  return 'Service';
};


/*
 * Retrieves the details of a service.
 *
 * @param {Function} A callback fired with (err, status), where status has:
 *    - time - unix timestamp of the time when the service was started
 *    - pid - PID of the service
 *    - state - state of the service (down or running)
 */
SupervisedService.prototype.getStatus = function(callback) {
  throw new Error('Not implemented');
};

/*
 * Return a path to the service log file.
 *
 * @param {String} Path to the service log file.
 */
SupervisedService.prototype.getLogPath = function() {
  throw new Error('Not implemented');
};

/*
 * Check if a service is enabled.
 *
 * @param {Function} callback A callback that takes a boolean.
 */
SupervisedService.prototype.isEnabled = function(callback) {
  throw new Error('Not implemented');
};

/**
 * A dirty hack to make it easier to serialize services with swiz.
 * @param {Function} callback A callback fired with (err, enabled).
 */
SupervisedService.prototype.isEnabledSer = function(callback) {
  this.isEnabled(function(enabled) {
    callback(null, enabled);
  });
};

/*
 * Start a service.
 *
 * @param {Function} callback A callback called with a possible error.
 */
SupervisedService.prototype.start = function(callback) {
  throw new Error('Not implemented');
};

/*
 * Stop a service.
 *
 * @param {Function} callback A callback called with a possible error.
 */
SupervisedService.prototype.stop = function(callback) {
  throw new Error('Not implemented');
};

/*
 * Restart a service.
 *
 * @param {Function} callback A callback called with a possible error.
 */
SupervisedService.prototype.restart = function(callback) {
  throw new Error('Not implemented');
};

/*
 * Enable a service.
 *
 * @param {Function} callback A callback called with a possible error.
 */
SupervisedService.prototype.enable = function(callback) {
  throw new Error('Not implemented');
};

/*
 * Disable a service.
 *
 * @param {Function} callback A callback called with a possible error.
 */
SupervisedService.prototype.disable = function(callback) {
  throw new Error('Not implemented');
};

/*
 * Stop the service (if started) and delete every file and directory associated with its configuration.
 *
 * @param {Function} callback A callback called with a possible error.
 */
SupervisedService.prototype.destroy = function(callback) {
  throw new Error('Not implemented');
};

/*
 * Object representing a supervised service manager.
 *
 * @param {String} pathAvailable The directory in which the available services reside.
 * @param {String} pathEnabled The directory in which the enabled services reside.
 */
function SupervisedServiceManager(pathAvailable, pathEnabled) {
  this.pathAvailable = pathAvailable;
  this.pathEnabled = pathEnabled;
}

/*
 * Return a service object.
 *
 * @param {String} name Name of the service.
 * @param {Function} callback A callback taking an error and a {@link SupervisedService}.
 */
SupervisedServiceManager.prototype.getService = function(name, callback) {
  throw new Error('Not implemented');
};

/*
 * Retrieve a service template object.
 *
 * @param {String} name Name of the service.
 * @param {Function} callback A callback which is called with an error as the first argument and template
 *                            object as the second one (template object properties depend on a service manager
 *                            being used).
 */
SupervisedServiceManager.prototype.getServiceTemplate = function(name, callback) {
  throw new Error('Not implemented');
};

/*
 * Create a new service.
 *
 * @param {String} serviceName Service names.
 * @param {Object} serviceTemplate Service template object (see runit/templates/base.js for example).
 * @param {Function} callback A callback taking a possible error.
 */
SupervisedServiceManager.prototype.createService = function(serviceName, entryFile, callback) {
  throw new Error('Not implemented');
};

/*
 * Helper function which given the service name and action retrieves the
 * service object and calls the provided action function on it.
 *
 * @param {String} serviceName Service name.
 * @param {String} action Which action to run on the obtained service object.
 * @param {Function} callback A callback called with (err, ..)
 */
SupervisedServiceManager.prototype.runAction = function(serviceName, action, callback) {
  throw new Error('Not implemented');
};

exports.SupervisedService = SupervisedService;
exports.SupervisedServiceManager = SupervisedServiceManager;
