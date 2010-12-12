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
 * Object representing a supervised service.
 *
 * @param {String} basedir The directory in which the service resides.
 * @param {String} path_available The directory in which the available service reside.
 * @param {String} path_enabled The directory in which the enabled service reside.
 * @param {String} name Service name.
 */
function SupervisedService(path_available, path_enabled, name) {
  this._base_path_available = path_available;
  this._base_path_enabled = path_enabled;

  this.name = name;
}

/*
 * Retrieves the details of a service.
 *
 * @return {Object} Object containining the following properties:
 * - name - service name
 * - enabled - true if the service is enabled, false otherwise
 * - status - an object with the following properties:
 *          - time - unix timestamp of the time when the service was started
 *          - pid - PID of the service
 *          - state - state of the service (down or running)
 */
SupervisedService.prototype.get_details = function(callback) {
  throw new Error('Not implemented');
};

/*
 * Return a path to the service log file.
 *
 * @param {String} Path to the service log file.
 */
SupervisedService.prototype.get_log_path = function() {
  throw new Error('Not implemented');
};

/*
 * Check if a service is enabled.
 *
 * @param {Function} callback A callback that takes a boolean.
 */
SupervisedService.prototype.is_enabled = function(callback) {
  throw new Error('Not implemented');
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
 * @param {String} path_available The directory in which the available services reside.
 * @param {String} path_enabled The directory in which the enabled services reside.
 */
function SupervisedServiceManager(path_available, path_enabled) {
  this.path_available = path_available;
  this.path_enabled = path_enabled;
}

/*
 * Return a service object.
 *
 * @param {String} name Name of the service.
 * @param {Function} callback A callback taking an error and a {@link SupervisedService}.
 */
SupervisedServiceManager.prototype.get_service = function(name, callback) {
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
SupervisedServiceManager.prototype.get_service_template = function(name, callback) {
  throw new Error('Not implemented');
};

/*
 * Create a new service.
 *
 * @param {String} service_name Service names.
 * @param {Object} service_template Service template object (see runit/templates/base.js for example).
 * @param {Function} callback A callback taking a possible error.
 */
SupervisedServiceManager.prototype.create_service = function(service_name, service_path, entry_file, callback) {
  throw new Error('Not implemented');
};

/*
 * Retrieve a list of objects containing details for all valid services.
 *
 * @param {Function} callback A callback taking an error and list of retrieved details.
 */
SupervisedServiceManager.prototype.list_services_details = function(callback) {
  throw new Error('Not implemented');
};

exports.SupervisedService = SupervisedService;
exports.SupervisedServiceManager = SupervisedServiceManager;
