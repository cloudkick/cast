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

var norris = require('norris');

exports['working hostname'] = function(assert, beforeExit) {
  var n = 0;
  norris.get(function(facts)  {
    n++;
    assert.notEqual(facts.hostname, "");
    assert.ifError(facts.hostname.length < 4);
  });
  beforeExit(function() {
    assert.equal(n, 1);
  });
};

exports['working marchine arch'] = function(assert, beforeExit) {
  var n = 0;
  norris.get(function(facts)  {
    n++;
    assert.ok(facts.arch == "i386" || facts.arch == "x86_64", "expected i386 or x86_64: "+ facts.arch);
    assert.ifError(facts.arch.length < 4);
  });
  beforeExit(function() {
    assert.equal(n, 1);
  });
};

exports.setup = function(done) {
  require('util/pubsub').ensure("config", done);
};
