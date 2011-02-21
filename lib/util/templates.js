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

var async = require('extern/async');
var T = require('extern/strobe-templates/index');

/**
 * Return context object which can be used when rendering a template.
 *
 * @param {Boolean} use_norris_facts If true, the template context will be populated with the norris facts.
 * @param {Object} context Other context with which the resulting context will be merged.
 * @param {Function} callback Callback which is called with a possible error as the first argument and the context
 *                            object as the second one on success.
 */
var get_template_context = function(use_norris_facts, context, callback) {
  var template_context = {};

  async.series([function(callback) {
    if (use_norris_facts) {
      norris.get(function(facts) {

        template_context = misc.merge(template_context, {'facts': facts});
        callback();
      });
    }
    else {
      callback();
    }
  }],

  function(error) {
    if (error) {
      return callback(error);
    }

    template_context = misc.merge(template_context, context);

    callback(null, template_context);
  });
};

/**
 * Render a template with the provided context.
 *
 * @param {String} template_path Full path to a template file.
 * @param {Object} context Context which is used when rendering a template.
 * @param {Function} callback Callback which is called with a possible error as a first argument and the rendered
 *                            template String as the second argument on success.
 */
var render_template_as_string = function(template_path, context, callback) {
  var template = new T.Template(template_path);

  template.load(function(error, template) {
    if (error) {
      return callback(error);
    }

    template.render(context, function(error, output) {
      if (error) {
        return callback(error);
      }

      callback(null, output.join(''));
    });
  });
};

/**
 * Return an object which can be used with the template_to_tree function.
 *
 * @param {String} file_path Relative path to a file (e.g. root_dir/subdir/file2.html).
 * @param {Object} context Context which is used when rendering a template.
 * @param {Function} callback Callback which is called with a possible error as a first argument and the rendered
 *                            template String as the second argument on success.
 */
var get_template_data_as_directory_tree_object = function(file_path, data) {
  var directory_tree_object = {};
  var prev_obj_ref, item;

  var paths = file_path.split('/');
  var paths_length = paths.length;

  if (paths.length === 1) {
    directory_tree_object[file_path] = data;
  }
  else {
    for (var i = 0; i < (paths_length - 1); i++) {
      item = paths[i];

      if (!prev_obj_ref) {
        directory_tree_object[item] = {};
        prev_obj_ref = directory_tree_object[item];
      }
      else {
        prev_obj_ref[item] = {};
        prev_obj_ref = prev_obj_ref[item];
      }
    }

    item = paths[paths_length - 1];
    prev_obj_ref[item] = data;
  }

  return directory_tree_object;
};

/**
 * Render and save a list of templates.
 *
 * @param {String} templates_path Path to a directory which contains the template files.
 * @param {Array} templates_list Array of relative paths to the template files.
 * @param {String} string_path Path to the target directory where the rendered templates will be saved.
 * @param {Object} context Context which is used when rendering a template.
 * @param {Function} callback Callback which is called with a possible error as a first argumen.
 */
var render_and_save_templates = function(templates_path, template_list, target_path, context, callback) {
  var templates_directory_tree_object = {};
  var directory_tree_object, template_path;

  async.forEach(template_list, function(template_file, callback) {
    template_path = path.join(templates_path, template_file);

    render_template_as_string(template_path, context, function(error, rendered_template) {
      if (error) {
        // Template rendering failed, skip this template
        return callback();
      }

      // Otherwise save the rendered template in the target_path
      directory_tree_object = get_template_data_as_directory_tree_object(template_file, rendered_template);
      fsutil.template_to_tree(target_path, directory_tree_object, true, function(error) {
        return callback(error);
      });
    });
  },

  function(error) {
    callback(error);
  });
};

exports.get_template_context = get_template_context;
exports.render_template_as_string = render_template_as_string;
exports.get_template_data_as_directory_tree_object = get_template_data_as_directory_tree_object;
exports.render_and_save_templates = render_and_save_templates;
