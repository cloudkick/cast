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

var req = require('util/requirements');
var assert = require('./../assert');

exports['test_compareVersions_b_less_than_a'] = function() {
  var i, version;
  var versionA = '0.2.1';
  var versionsB = [ '0.1.0', '0.1.9', '0.2.0', '0.0.0' ];

  for (i = 0; i < versionsB.length; i++) {
    version = versionsB[i];
    assert.equal(req.compareVersions(versionA, version), false);
  }
};

// Test compare_versions ver_b >= ver_a
exports['test_compareVersions_b_more_than_or_equal_a'] = function() {
  var i, version;
  var versionA = '0.2.1';
  var versionsB = [ '0.2.1', '0.2.2', '0.2.3', '0.2.9', '0.3.0', '1.0.0' ];

  for (i = 0; i < versionsB.length; i++) {
    version = versionsB[i];
    assert.ok(req.compareVersions(versionA, version));
  }
};

exports['test_isDefined'] = function() {
  var i, item;
  var assertTrue = [ '1', ['foo', 'bar'], 1, {}, { 'foo': 'bar'}, true ];
  var assertFalse = [ null, undefined, false ];

  for (i = 0; i < assertTrue.length; i++) {
    item = assertTrue[i];
    assert.ok(req.isDefined(null, item), item + ' is defined');
  }

  for (i = 0; i < assertFalse.length; i++) {
    item = assertFalse[i];
    assert.equal(req.isDefined(null, item), false);
  }
};
