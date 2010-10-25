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

var path = require('path');

var config = require('util/config');
var Errorf = require('util/misc').Errorf;

var available_managers = {
  'runit': {
      'service': require('service_management/runit').RunitService,
      'manager': require('service_management/runit').RunitServiceManager,
      'get_manager': require('service_management/runit').get_manager,
      'config_defaults': require('service_management/runit').config_defaults
  }
};

/*
 * Property holding the service manager object.
 */
var default_manager = null;

/**
 * Return service manager object.
 *
 * @param {String} name Manager name.
 * @return {Object} Object with the following keys: service, manager, get_manager, config_defaults
 */
exports.get_manager = function(name) {

  if (!available_managers.hasOwnProperty(name)) {
    throw new Errorf('%s service manager does not exist.', name);
  }

  return available_managers[name];
};

/**
 * Return a default service manager object.
 *
 * @return {Object} Default manager object with the following keys: service, manager, get_manager, config_defaults
 */
exports.get_default_manager = function() {
  var service_manager;

  if (!default_manager) {
    // Manager should not change during run-time, so caching the value is ok
    service_manager = config.get().service_manager;
    default_manager = exports.get_manager(service_manager);
  }

  return default_manager;
};
