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

var ps = require('util/pubsub');
var sys = require('sys');
var async = require('extern/async');
var assert = require('assert');

(function() {
  var completed = false;

  async.parallel([
    // Test basic subscription
    function(callback) {
      var n = 0;
      ps.on('basic', function(value) {
        assert.equal(n, value);
        n++;
      });

      ps.emit('basic', n);
      ps.emit('basic', n);

      assert.equal(n, 2, 'Events Received');
      callback();
    },

    // Test 'once' subscription
    function(callback) {
      var n = 0;
      ps.once('once', function(value) {
        assert.equal(n, value);
        n++;
      });

      ps.emit('once', n);
      ps.emit('once', n);
      
      assert.equal(n, 1, 'Events received');
      callback();
    },

    // Bad parameters
    function(callback) {
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
      callback();
    }
  ],
  function(err) {
    completed = true;
    assert.ifError(err);
  });

  process.on('exit', function() {
    assert.ok(completed, 'Tests completed');
  });
})();
