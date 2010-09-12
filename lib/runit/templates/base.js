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

var BASE_TEMPLATE = {
  run: "#!/bin/bash\n# Stub run file\nexit 0",
  finish: "#!/bin/bash\n# Stubbed out finish file\nexit 0;",
  down: "# Down file so it doesn't start up automagically",
  log: {
    "run": sprintf("#!/bin/bash\nexec chpst -u%s svlogd -tt ./%s", config.svlogd_daemon_user, config.log_directory),
    "config": sprintf("s%s\nn%s", config.max_log_size, config.max_log_num),
    main: {}
  }
};

var get_application_template = function(instance_name, instance_path, application_type, callback) {
  if (!misc.in_array(manifest_constants.APPLICATION_TYPES, application_type)) {
     return callback(new Error(sprintf('Invalid application type %s', application_type)));
  }

  try {
    var get_runit_template = require(sprintf('runit/templates/%s', application_type)).get_template;
  }
  catch (error) {
    return callback(new Error(sprintf('Cannot load template module for application type %s', application_type)));
  }

  get_runit_template(instance_name, instance_path, function(error, template) {
    if (error) {
      return callback(error);
    }

    template = misc.merge(BASE_TEMPLATE, template);

    callback(null, template);
  });
};

exports.BASE_TEMPLATE = BASE_TEMPLATE;
exports.get_application_template = get_application_template;
