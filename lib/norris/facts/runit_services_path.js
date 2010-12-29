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
  /* Return an array of paths monitored by runsvdir if one or multiple runsvdir processes are
    running, false otherwise */
  exec('ps aux | grep runsvdir', function(err, stdout, stderr) {
    var i, lines, line, runsvdir_paths, matches, result;

    if (err) {
      done({runit_services_path: false});
      return;
    }

    lines = trim(stdout).split('\n');
    runsvdir_paths = [];
    for (i = 0; i < lines.length; i++) {
      // runsvdir [-P] path [ log ]
      line = lines[i];
      matches = line.match(/runsvdir (\-p\ )?(\S+)/i);

      if (matches === null || matches.length !== 3) {
        continue;
      }

      runsvdir_paths.push(matches[2]);
    }

    result = (runsvdir_paths.length > 0) ? runsvdir_paths : false;
    done({runit_services_path: result});
  });
};
