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

var Check = require('health').Check;
var CheckResult = require('health').CheckResult;

exports['test missing required property throws exception'] = function(test, assert) {
  var n = 0;

  try {
    var check = new Check('test check', ['option_1'], [], {}, {});
  }
  catch(exception) {
    n++;
  }

  assert.equal(n, 1);
  test.finish();
};

exports['test format arguments worky properly'] = function(test, assert) {
  var requiredArguments = ['ip_address', 'port'];
  var optionalArguments = ['use_ssl'];
  var defaultValues = { 'use_ssl': true };

  var arguments1 = { 'ip_address': '1.2.3.4', 'port': 80 };
  var arguments2 = { 'ip_address': '4.3.2.1', 'port': 80, 'use_ssl': false };
  var arguments3 = { 'ip_address': '4.3.2.1', 'port': 80, 'use_ssl': true };

  var check1 = new Check('test check 1', requiredArguments, optionalArguments, defaultValues,
                                         arguments1);
  var check2 = new Check('test check 2', requiredArguments, optionalArguments, defaultValues,
                                        arguments2);
  var check3 = new Check('test check 1', requiredArguments, optionalArguments, defaultValues,
                                        arguments3);

  assert.deepEqual(check1.checkArguments, {'ip_address': '1.2.3.4', 'port': 80, 'use_ssl': true});
  assert.deepEqual(check2.checkArguments, {'ip_address': '4.3.2.1', 'port': 80, 'use_ssl': false});
  assert.deepEqual(check3.checkArguments, {'ip_address': '4.3.2.1', 'port': 80, 'use_ssl': true});
  test.finish();
};

exports['test class instantation'] = function(test, assert) {
  var check = new Check('test check', ['option_1'], [], {'option_1': 'test'});
  assert.length(check.resultHistory, 0);
  assert.equal(check.lastRunDate, null);
  test.finish();
};

exports['test result history'] = function(test, assert) {
  var check = new Check('test check', ['option_1'], [], {'option_1': 'test'});
  assert.length(check.resultHistory, 0);

  check.addResult(new CheckResult());
  check.addResult(new CheckResult());
  check.addResult(new CheckResult());
  assert.length(check.resultHistory, 3);

  assert.equal(check.getLastResult(), check.getResultAtIndex(0));

  check.clearResultHistory();
  assert.length(check.resultHistory, 0);
  test.finish();
};
