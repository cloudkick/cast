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

var sys = require('sys');
var path = require('path');

var sprintf = require('extern/sprintf').sprintf;

var config = require('util/config');
var misc = require('util/misc');

var norris = require('norris');
var runit_templates = require('runit/templates/base');
var RunitServiceDirectory = require('runit/services').RunitServiceDirectory;
var get_service_dir = require('runit/services').get_service_dir;

/**
 * Creates an instance of a service, building out the runit application directory.
 * @param {String} instance_name Name of the instance.
 * @param {String} instance_path Path to of the instance.
 * @param {String} entry_file Path of the file to run inside runit.
 * @param {String} application_type Type of the application template to use, must be "shell" or "nodejs" at this time.
 * @param {Function} callback Callback on completion, first parameter if present is an error.
 */
exports.create_service = function(instance_name, instance_path, entry_file, application_type, callback)
{
  var runit = get_service_dir();

  runit_templates.get_application_template(instance_name, instance_path,
                                           entry_file, application_type,
                                           function(error, template)
  {
    if (error) {
      return callback(error);
    }

    runit.create_service_layout(instance_name, template, function(error) {
      if (error) {
        return callback(error);
      }
      callback();
    });
  });
};

