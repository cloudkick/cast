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

var archMap = {
  'amd64': 'x86_64',
  'x64_64': 'x86_64'
};

exports.get = function(done) {
  exec('uname -m', function(err, stdout, stderr) {
    var m = trim(stdout).toLowerCase();
    if (archMap[m]) {
      m = archMap[m];
    }
    done({arch: m});
  });
};
