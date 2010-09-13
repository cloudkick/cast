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

function get_service_dir() {
  return new RunitServiceDirectory(config.get().servicedir);
}

var create_service = function(instance_name, instance_path, entry_file, application_type, callback) {
  var runit = get_service_dir();

  runit_templates.get_application_template(instance_name, instance_path, entry_file, application_type, function(error, template) {
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

exports.create_service = create_service;
