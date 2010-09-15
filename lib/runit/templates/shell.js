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
var config = require('util/config').get().runit;

var get_template = function(instance_name, instance_path, entry_file, callback) {
  var template, entry_path;

    entry_path = path.join(instance_path, entry_file);

    template = {
      run: sprintf('#!/bin/sh\nexec chpst -u%s /bin/sh %s', config.service_user, entry_path),
      finish: sprintf("#!/bin/sh\necho 'Service %s stopped'\nsleep 1\nexit 0", instance_name)
    };

    callback(null, template);
  });
};

exports.get_template = get_template;
