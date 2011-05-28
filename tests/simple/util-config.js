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

var config = require('util/config');

exports['test_config_get'] = function(test, assert) {
  config.configFiles = [
    'test.conf'
  ];

  config.setupAgent(function(err) {
    assert.ifError(err);
    assert.equal(config.get()['ssl_enabled'], false);
    test.finish();
  });
};

exports['test_config_file_does_not_exist'] = function(test, assert) {
  // Missing config files should be silently ignored
  config.configFiles = [
    'does-not-exist.conf'
  ];

  config.setupAgent(function(err) {
    assert.ifError(err);
    test.finish();
  });
};

exports['test_config_file_contains_invalid_json'] = function(test, assert) {
  config.configFiles = [
    'data/invalid-json.conf'
  ];

  config.setupAgent(function(err) {
    assert.ok(err);
    assert.match(err.message, /contains invalid json/i);
    test.finish();
 });
};
