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
 */
var realize_application_templates = function(manifest_path, templates_path, target_path, callback) {
  async.waterfall([
    function(callback) {
      manifest.get_manifest_data_as_object(manifest_path, true, function(error, manifest_object) {
        if (error) {
          return callback(error);
        }

        callback(null, manifest_object);
      });
    },

    function(manifest_object, callback) {
      var context;

      context = {'manifest': manifest_object};
      if (manifest_object.hasOwnProperty('template_variables')) {
        // Assign "template_variables" property value to the property named "user_defined" on the
        // context object and delete it from the context.manifest
        context = misc.merge(context, {'user_defined': manifest_object.template_variables });
        delete context.manifest.template_variables;
      }

      templates.get_template_context(true, context, function(error, context) {
        if (error) {
          return callback(error);
        }

        templates.render_and_save_templates(templates_path,
                                            manifest_object.template_files,
                                            target_path,
                                            context,
                                            function(error)
        {
          if (error) {
            return callback(error);
          }

          callback();
        });
      });
    }],

  function(error) {
    if (error) {
      return callback(error);
    }

    callback();
  });
};

exports.realize_application_templates = realize_application_templates;
