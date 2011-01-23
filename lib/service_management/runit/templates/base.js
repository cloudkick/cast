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
var config = require('util/config').get().runit;

var manifest_constants = require('manifest/constants');

var get_application_template = function(service_name, service_path, entry_file, application_type, callback)
{
  var get_runit_template = null;
  if (!misc.in_array(application_type, manifest_constants.APPLICATION_TYPES)) {
    return callback(new Error(sprintf('Invalid application type %s', application_type)));
  }

  try {
    get_runit_template = require(sprintf('service_management/runit/templates/%s', application_type)).get_template;
  }
  catch (error) {
    return callback(new Error(sprintf('Cannot load template module for application type %s', application_type)));
  }

  get_runit_template(service_name, service_path, entry_file, function(error, template) {
    if (error) {
      return callback(error);
    }

    var chpst;

    if (config.svlogd_daemon_user) {
      chpst = sprintf('chpst -u %s ', config.svlogd_daemon_user);
    }
    else {
      chpst = '';
    }

    var app_template = {
      run: '#!/bin/bash\n# Stub run file\nexit 0',
      finish: '#!/bin/bash\n# Stubbed out finish file\nexit 0;',
      down: "# Down file so it doesn't start up automagically",
      log: {
        'run': sprintf('#!/bin/bash\nexec %ssvlogd -tt ./%s', chpst, config.log_directory),
        'config': sprintf('s%s\nn%s', config.max_log_size, config.max_log_num),
        main: {}
      }
    };

    template = misc.merge(app_template, template);

    callback(null, template);
  });
};

exports.get_application_template = get_application_template;
