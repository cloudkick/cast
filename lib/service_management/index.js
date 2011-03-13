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

var availableManagers = {
  'runit': {
    service: require('service_management/runit').RunitService,
    manager: require('service_management/runit').RunitServiceManager,
    getManager: require('service_management/runit').getManager,
    configDefaults: require('service_management/runit').configDefaults
  }
};

/*
 * Property holding the service manager object.
 */
var defaultManager = null;

/**
 * Return service manager object.
 *
 * @param {String} name Manager name.
 * @return {Object} Object with the following keys: service, manager, getManager, configDefaults
 */
exports.getManager = function(name) {

  if (!availableManagers.hasOwnProperty(name)) {
    throw new Errorf('%s service manager does not exist.', name);
  }

  return availableManagers[name];
};

/**
 * Return a default service manager object.
 *
 * @return {Object} Default manager object with the following keys: service, manager, getManager, configDefaults
 */
exports.getDefaultManager = function() {
  var serviceManager;

  if (!defaultManager) {
    // Manager should not change during run-time, so caching the value is ok
    serviceManager = config.get().service_manager;
    defaultManager = exports.getManager(serviceManager);
  }

  return defaultManager;
};
