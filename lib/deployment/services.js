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

var serviceManagement = require('service_management');

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
};

exports.createService = createService;
