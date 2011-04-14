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

var serviceManagement = require('service_management');
var runit = require('service_management/runit');

/**
 * Maximum delay before runit picks up new changes (in milliseconds).
 * @type {Number}
 * @const
 */
var RUNIT_DELAY = 6000;

/**
 * Creates an instance of a service, building out the runit application directory.
 * @param {String} instanceName  Name of the instance.
 * @param {String} instancePath  The path to the version instance.
 * @param {Object} manifestObj   The manifest object of the instance.
 * @param {Function} callback Callback on completion, first parameter if present is an error.
 */
function createService(instanceName, instancePath, manifestObj, callback) {
  var manager = serviceManagement.getDefaultManager().getManager();
  var templateArgs = {
    serviceName: instanceName,
    instancePath: instancePath,
    entryFile: manifestObj['entry_file'],
    applicationType: manifestObj.type
  };

  manager.getServiceTemplate(templateArgs, function(err, template) {
    if (err) {
      callback(err);
      return;
    }

    manager.createService(instanceName, template, function(err) {
      callback(err);
    });
  });
}

/**
 * A utility function which enables the service, waits RUNIT_DELAY number of
 * milliseconds and than starts the service.
 *
 * Note: Function will only wait RUNIT_DELAY milliseconds before calling
 * service.start if a runit service manager is used.
 * In any case, callback is fired immediately after service.start has been
 * called.
 *
 * @param {String} Service name.
 * @param {Function} callback which is fired with (err)
 */
function enableAndStartService(serviceName, callback) {
  var manager = serviceManagement.getDefaultManager().getManager();
  var service;

  function getService(callback) {
    manager.getService(serviceName, function(err, service) {
      if (err) {
        callback(err);
        return;
      }

      callback(null, service);
    });
  }

  function enableService(service, callback) {
    service.enable(function(err) {
      if (err) {
        callback(err);
        return;
      }

      callback(null, service);
    });
  }

  function waitAndStartService(service, callback) {
    // Waiting is only needed if we are using runit service manager
    if (!manager instanceof runit.RunitServiceManager) {
      service.start(callback);
      return;
    }

    callback();
    setTimeout(function() {
      service.start(function() {});
    }, RUNIT_DELAY);
  }

  var ops = [getService, enableService, waitAndStartService];

  async.waterfall(ops, function(err) {
    callback(err);
  });
}

exports.createService = createService;
exports.enableAndStartService = enableAndStartService;
