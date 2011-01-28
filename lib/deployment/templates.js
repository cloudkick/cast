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

var async = require('extern/async');

var templates = require('util/templates');
var misc = require('util/misc');

var manifest = require('manifest');

/*
 * Realize (render and save) application templates.
 *
 * @param {Object} manifest_object
 * @param {Object} instance_data
 * @param {String} templates_path
 * @oaram {String} target_path
 * @param {Function} callback
 *
 */
var realize_application_templates = function(manifest_object, instance_data, templates_path, target_path, callback) {
  var context;

  context = { 'manifest': manifest_object };
  if (instance_data) {
    context.instance = instance_data;
  }

  if (manifest_object.hasOwnProperty('template_variables')) {
    // Assign "template_variables" property value to the property named "user_defined" on the
    // context object and delete it from the context.manifest
    context.user_defined = manifest_object.template_variables;
    delete context.manifest.template_variables;
  }

  templates.get_template_context(true, context, function(error, context) {
    if (error) {
      return callback(error);
    }

    templates.render_and_save_templates(templates_path, manifest_object.template_files, target_path, context,
                                        function(error) {
      if (error) {
        return callback(error);
      }

      callback();
    });
  });
};

exports.realize_application_templates = realize_application_templates;
