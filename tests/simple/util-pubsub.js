/*
 * Licensed to Cloudkick, Inc ('Cloudkick') under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * Cloudkick licenses this file to You under the Apache License, Version 2.0
 * (the 'License'); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var sys = require('sys');

var async = require('async');

var ps = require('util/pubsub');

exports['test_basic_subscription'] = function(test, assert) {
  var n = 0;
  ps.on('basic', function(value) {
    assert.equal(n, value);
    n++;
  });

  ps.emit('basic', n);
  ps.emit('basic', n);

  assert.equal(n, 2, 'Events Received');
  test.finish();
};

exports['test_ensure'] = function(test, assert) {
  var n = 0;
  var m = 0;

  // Already seen
  ps.emit('ensure');
  ps.ensure('ensure', function() {
    n++;
  });

  assert.equal(n, 1, 'Events Received');

  ps.emit('ensure');
  ps.emit('ensure');
  ps.emit('ensure');

  assert.equal(n, 1, 'Events Received');

  // Not seen yet
  ps.ensure('ensure-new', function() {
    m++;
  });

  ps.emit('ensure-new');
  ps.emit('ensure-new');

  assert.equal(m, 1, 'Events Received');
  test.finish();
};

exports['test_once_subscription'] = function(test, assert) {
  var n = 0;
  var m = 0;
  ps.once('once', function(value) {
    assert.equal(n, value);
    n++;
  });

  ps.once('once', function(value) {
    assert.equal(m, value);
    m++;
  });

  ps.emit('once', n);
  ps.emit('once', n);
  ps.emit('once', m);
  ps.emit('once', m);

  assert.equal(n, 1);
  assert.equal(m, 1);
  test.finish();
};

exports['test_bad_parameters'] = function(test, assert) {
  var n = 0;

  try {
    ps.once();
  }
  catch(e1) {
    n++;
    assert.match(e1, /pubsub/);
  }
  try {
    ps.on();
  }
  catch(e2) {
    n++;
    assert.match(e2, /pubsub/);
  }
  try {
    ps.emit();
  }
  catch(e3) {
    n++;
    assert.match(e3, /pubsub/);
  }

  assert.equal(3, n, 'Exceptions thrown');
  test.finish();
};
