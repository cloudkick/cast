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

var path = require('path');

var sprintf = require('extern/sprintf').sprintf;
var base = require('./base');

/**
 * Get the non-standard portions of a 'runit' service template.
 *
 * @param {Object} template_args  An object containing: instance_path, entry_file
 * @param {Function} callback     A callback that takes (err, template)
 */
var get_template = function(template_args, callback) {
  var i;
  var required_args = ['instance_path', 'entry_file'];
  for (i = 0; i < required_args.length; i++) {
    if (!template_args[required_args[i]]) {
      return callback(new Error(required_args[i] + ' not specified for shell runit template'));
    }
  }

  var instance_path = template_args.instance_path;
  var entry_file = template_args.entry_file;

  var entry_path = path.join(instance_path, entry_file);
  var run_cmd = sprintf('/bin/sh %s', entry_path);

  var template = {
    run: base.build_run_file(run_cmd, true)
  };

  callback(null, template);
};

exports.get_template = get_template;
