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

var service_management = require('service_management');

/**
 * Creates an instance of a service, building out the runit application directory.
 * @param {String} instance_name  Name of the instance.
 * @param {String} instance_path  The path to the version instance
 * @param {Object} manifest_obj   The manifest object of the instance
 * @param {Function} callback Callback on completion, first parameter if present is an error.
 */
exports.create_service = function(instance_name, instance_path, manifest_obj, callback) {
  var manager = service_management.get_default_manager().get_manager();
  var template_args = {
    service_name: instance_name,
    instance_path: instance_path,
    entry_file: manifest_obj.entry_file,
    application_type: manifest_obj.type
  };

  manager.get_service_template(template_args, function(err, template) {
    if (err) {
      return callback(err);
    }

    manager.create_service(instance_name, template, function(err) {
      callback(err);
    });
  });
};
