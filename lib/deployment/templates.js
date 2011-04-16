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

var templates = require('util/templates');

/*
 * Realize (render and save) application templates.
 *
 * @param {Object} manifestObj
 * @param {Object} instanceData
 * @param {String} templatesPath
 * @oaram {String} targetPath
 * @param {Function} callback
 *
 */
exports.realizeApplicationTemplates = function(manifestObj, instanceData, templatesPath, targetPath, callback) {
  var context;

  context = { 'manifest': manifestObj };
  if (instanceData) {
    context.instance = instanceData;
  }

  if (manifestObj.hasOwnProperty('template_variables')) {
    // Assign "template_variables" property value to the property named "user_defined" on the
    // context object and delete it from the context.manifest
    context.user_defined = manifestObj['template_variables'];
    delete context.manifest['template_variables'];
  }

  templates.getTemplateContext(true, context, function(error, context) {
    if (error) {
      callback(error);
      return;
    }

    templates.renderAndSaveTemplates(templatesPath, manifestObj['template_files'], targetPath, context,
                                        function(error) {
      if (error) {
        callback(error);
        return;
      }

      callback();
    });
  });
};

/**
 * Return object with instance data which can be used when rendering a template.
 *
 * @param {String} instanceName Instance name.
 * @param {String} instancePath Instance path.
 * @return {Object}
 */
exports.getInstanceTemplateObject = function(instanceName, instancePath) {
  var instanceObject = {
    'name': instanceName,
    'path': instancePath
  };

  return instanceObject;
};
