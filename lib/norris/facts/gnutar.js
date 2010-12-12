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

var async = require('extern/async');
var sprintf = require('extern/sprintf').sprintf;

var trim = require('util/misc').trim;

exports.get = function(done) {
  var check_version = function(tar_binary, callback) {
    exec(sprintf('%s --version', tar_binary), function(err, stdout, stderr) {
      if (err) {
        callback(false);
        return;
      }

      if (stdout.toLowerCase().indexOf('gnu tar') === -1) {
        callback(false);
        return;
      }

      callback(true);
    });
  };

  exec('which gnutar gtar tar', function(err, stdout, stderr) {
    var o = trim(stdout).split(/\r\n|\r|\n/);

    async.filterSeries(o, check_version, function(results) {
      var gnutar_binary;

      if (!results) {
        gnutar_binary = null;
      }
      else {
        gnutar_binary = results[0];
      }

      done({gnutar: gnutar_binary});
    });
  });
};
