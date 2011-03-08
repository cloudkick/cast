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

var sprintf = require('extern/sprintf').sprintf;

var misc = require('util/misc');
var config = require('util/config');

var manifest_constants = require('manifest/constants');

exports.build_run_file = function(cmd, redir) {
    var run_line = ['exec'];

    var svlogd_user = config.get().runit.svlogd_daemon_user;
    if (svlogd_user) {
      run_line.push(sprintf('chpst -u %s', svlogd_user));
    }
    run_line.push(cmd);
    if (redir) {
      run_line.push('2>&1');
    }

    var file = [
      '#!/bin/bash',
      run_line.join(' ')
    ];

    return file.join('\n');
};

/**
 * Get a template that can be used to generate a runit service configuration
 * using template_to_tree.
 *
 * @param {Object} template_args  An object containing: service_name, instance_path, entry_file
 * @param {Function} callback     A callback that takes (err, template)
 */
exports.get_application_template = function(template_args, callback) {
  var get_runit_template, template, chpst, i;
  var required_args = ['application_type', 'service_name'];
  for (i = 0; i < required_args.length; i++) {
    if (!template_args[required_args[i]]) {
      callback(new Error(required_args[i] + ' not specified for base runit template'));
      return;
    }
  }

  var application_type = template_args.application_type;
  var service_name = template_args.service_name;
  var runit_conf = config.get().runit;

  if (!misc.in_array(application_type, manifest_constants.APPLICATION_TYPES)) {
    callback(new Error(sprintf('Invalid application type %s', application_type)));
    return;
  }

  try {
    get_runit_template = require(sprintf('./%s', application_type)).get_template;
  }
  catch (error) {
    callback(new Error(sprintf('Cannot load template module for application type %s', application_type)));
    return;
  }

  get_runit_template(template_args, function(error, template) {
    if (error) {
      callback(error);
      return;
    }

    var log_cmd = sprintf('svlogd -tt ./%s', runit_conf.log_directory);
    var config_file = [
      runit_conf.max_log_size,
      runit_conf.max_log_num
    ].join('\n');

    template = misc.merge({
      run: '#!/bin/bash\n# Stub run file\nexit 0',
      finish: sprintf("#!/bin/sh\necho 'Service %s stopped'\nsleep 1\nexit 0", service_name),
      down: "# Down file so it doesn't start up automagically",
      log: {
        'run': exports.build_run_file(log_cmd),
        'config': config_file,
        main: {}
      }
    }, template);

    callback(null, template);
  });
};
