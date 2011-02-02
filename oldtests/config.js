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
var exec = require('child_process').exec;
var async = require('extern/async');
var config = require('util/config');

exports.setup = function(done) {
  var ps = require('util/pubsub');
  var path = require('path');
  config.config_files = ["~/.xxx_no_such_file", path.join(__dirname, "test.conf")];
  config.setup_agent(function(error) {
    if (error) {
      throw new Error('Error during test configuration');
    }
    async.series([
      async.apply(exec, 'rm -rf .tests'),
      async.apply(exec, 'mkdir .tests')
    ],
    function() {
      process.nextTick(function() {
        ps.emit("config");
        done();
      });
    });
  });
};

exports['basic config'] = function(assert, beforeExit) {
  var conf = config.get();
  assert.equal(49443, conf.port);
  assert.equal(".tests/data_root", conf.data_root);
};

