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

var async = require('extern/async');
var fs =  require('fs');
var test = require('util/test');
var certgen = require('security/certgen');

exports['create selfsigned cert'] = function(assert, beforeExit) {
  var n = 0;

  certgen.selfsigned('testhostnamerare', '.tests/certs/t.key', '.tests/certs/t.crt', function(err) {
    assert.equal(null, err, 'no errors from cert generation');
    console.log('ssl shit worked');
    n++;
  })

  beforeExit(function() {
    assert.equal(1, n, 'callbacks run');
  });
};

exports.setup = function(done) {
  async.series([
    async.apply(require('util/pubsub').ensure, "config"),
    async.apply(fs.mkdir, '.tests/certs', 0700)
  ],
  done);
};
