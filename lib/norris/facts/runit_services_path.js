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

var exec = require('child_process').exec;
var trim = require('util/misc').trim;
var log = require('util/log');

exports.get = function(done) {
  /* Return runit services path if runsvdir is running, false otherwise */
  exec('ps -C runsvdir -o args --no-headers', function(err, stdout, stderr) {
    var lines, matches, services_path;

    if (err) {
      done({runit_services_path: false});
      return;
    }
    lines = trim(stdout).split('\n');

    if (lines.length > 1) {
      // TODO: Better handling of this situation */
      log.err("More than one 'runsvdir' process found");
      done({runit_services_path: false});
      return;
    }
    else if (lines.length < 1) {
      done({runit_services_path: false});
      return;
    }

    // runsvdir [-P] path [ log ]
    matches = lines[0].match(/runsvdir (\-p\ )?(\S+)/i);

    if (matches === null || matches.length !== 3) {
      done({runit_services_path: false});
      return;
    }

    services_path = matches[2];
    done({runit_services_path: services_path});
  });
};
