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

var get = function(done) {
  var checkVersion = function(tarBinary, callback) {
    exec(sprintf('%s --version', tarBinary), function(err, stdout, stderr) {
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

    async.filterSeries(o, checkVersion, function(results) {
      var gnutarBinary;

      if (!results) {
        gnutarBinary = null;
      }
      else {
        gnutarBinary = results[0];
      }

      done({gnutar: gnutarBinary});
    });
  });
};

exports.get = get;
