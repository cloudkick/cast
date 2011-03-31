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

var norris = require('norris');

var misc = require('util/misc');
var fsutil = require('util/fs');

var async = require('async');
var T = require('magic-templates');

/**
 * Return context object which can be used when rendering a template.
 *
 * @param {Boolean} useNorrisFacts If true, the template context will be populated with the norris facts.
 * @param {Object} context Other context with which the resulting context will be merged.
 * @param {Function} callback Callback which is called with a possible error as the first argument and the context
 *                            object as the second one on success.
 */
function getTemplateContext(useNorrisFacts, context, callback) {
  var templateContext = {};

  async.series([function(callback) {
    if (useNorrisFacts) {
      norris.get(function(facts) {

        templateContext = misc.merge(templateContext, {'facts': facts});
        callback();
      });
    }
    else {
      callback();
    }
  }],

  function(error) {
    if (error) {
      callback(error);
      return;
    }

    templateContext = misc.merge(templateContext, context);

    callback(null, templateContext);
  });
}

/**
 * Render a template with the provided context.
 *
 * @param {String} templatePath Full path to a template file.
 * @param {Object} context Context which is used when rendering a template.
 * @param {Function} callback Callback which is called with a possible error as a first argument and the rendered
 *                            template String as the second argument on success.
 */
function renderTemplateAsString(templatePath, context, callback) {
  var template = new T.Template(templatePath);

  template.load(function(error, template) {
    if (error) {
      callback(error);
      return;
    }

    template.render(context, function(error, output) {
      if (error) {
        callback(error);
        return;
      }

      callback(null, output.join(''));
    });
  });
}

/**
 * Return an object which can be used with the templateToTree function.
 *
 * @param {String} filePath Relative path to a file (e.g. rootDir/subdir/file2.html).
 * @param {Object} context Context which is used when rendering a template.
 * @param {Function} callback Callback which is called with a possible error as a first argument and the rendered
 *                            template String as the second argument on success.
 */
function getTemplateDataAsDirectoryTreeObject(filePath, data) {
  var directoryTreeObject = {};
  var prevObjRef, item;

  var paths = filePath.split('/');
  var pathsLength = paths.length;

  if (paths.length === 1) {
    directoryTreeObject[filePath] = data;
  }
  else {
    for (var i = 0; i < (pathsLength - 1); i++) {
      item = paths[i];

      if (!prevObjRef) {
        directoryTreeObject[item] = {};
        prevObjRef = directoryTreeObject[item];
      }
      else {
        prevObjRef[item] = {};
        prevObjRef = prevObjRef[item];
      }
    }

    item = paths[pathsLength - 1];
    prevObjRef[item] = data;
  }

  return directoryTreeObject;
}

/**
 * Render and save a list of templates.
 *
 * @param {String} templatesPath Path to a directory which contains the template files.
 * @param {Array} templatesList Array of relative paths to the template files.
 * @param {String} stringPath Path to the target directory where the rendered templates will be saved.
 * @param {Object} context Context which is used when rendering a template.
 * @param {Function} callback Callback which is called with a possible error as a first argumen.
 */
function renderAndSaveTemplates(templatesPath, templateList, targetPath, context, callback) {
  var templatesDirectoryTreeObject = {};
  var directoryTreeObject, templatePath;

  async.forEach(templateList, function(templateFile, callback) {
    templatePath = path.join(templatesPath, templateFile);

    renderTemplateAsString(templatePath, context, function(error, renderedTemplate) {
      if (error) {
        // Template rendering failed, skip this template
        callback();
        return;
      }

      // Otherwise save the rendered template in the target_path
      directoryTreeObject = getTemplateDataAsDirectoryTreeObject(templateFile, renderedTemplate);
      fsutil.templateToTree(targetPath, directoryTreeObject, true, function(error) {
        callback(error);
        return;
      });
    });
  },

  function(error) {
    callback(error);
  });
}

exports.getTemplateContext = getTemplateContext;
exports.renderTemplateAsString = renderTemplateAsString;
exports.getTemplateDataAsDirectoryTreeObject = getTemplateDataAsDirectoryTreeObject;
exports.renderAndSaveTemplates = renderAndSaveTemplates;
