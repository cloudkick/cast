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
var config = require('util/config');

exports.get = function(done) {
  /* Return runit services path if runsvdir is running, false otherwise */
  exec('ps ax | grep runsvdir | grep -v grep', function(err, stdout, stderr) {
    var i, lines, matches, service_root, runsvdir_root;

    if (err) {
      done({runsvdir_running: false});
      return;
    }

    lines = trim(stdout).split('\n');
    service_root = config.get().service_root;

    if (!service_root) {
      done({runsvdir_running: false});
      return;
    }

    service_root = service_root.replace(/\/$/, '');

    for (i = 0; i < lines.length; i++) {
      // runsvdir [-P] path [ log ]
      matches = lines[0].match(/runsvdir (\-p\ )?(\S+)/i);

      if (matches && matches.length === 3) {
        runsvdir_root = matches[2].replace(/\/$/, '');
        if (runsvdir_root === service_root) {
          done({runsvdir_running: true});
          return;
        }
      }
    }

    done({runsvdir_running: false});
  });
};
