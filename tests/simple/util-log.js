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

var sys = require('sys');

var log = require('util/log');

var sysLog = sys.log;

exports['test_trace'] = function(test, assert) {
  var trace = log.trace('test trace');

  assert.match(trace, /util-log.js:25:19/);
  test.finish();
};

exports['test_setLogLevel'] = function(test, assert) {
  var buffer = '';
  sys.log = function(data) {
    buffer += data;
  };

  log.setLoglevel('debug');
  log.debug('test line');
  assert.equal(buffer, 'debug: test line');

  log.setLoglevel('nothing');
  log.debug('test line');
  assert.equal(buffer, 'debug: test line');
  test.finish();
};

exports['tearDown'] = function(test, assert) {
  sys.log = sysLog;
  test.finish();
};
