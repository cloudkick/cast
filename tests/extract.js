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
var extract = require('util/tarball');

exports['extract tarball'] = function(assert, beforeExit) {
  var n = 0;
  var tbpath = path.join(process.cwd(), 'tests/data/fooserv.tar.gz');
  var expath = path.join(process.cwd(), '.tests/fooserv');
  extract.extract_tarball(tbpath, expath, 0755, function(err) {
    assert.ifError(err);
    n++;
  });
  beforeExit(function() {
    assert.equal(n, 1);
  });
};

exports['extract missing tarball'] = function(assert, beforeExit) {
  var n = 0;
  var tbpath = path.join(process.cwd(), 'tests/data/fooserv.tar.gz');
  var expath = path.join(process.cwd(), '.tests/fooserv');
  extract.extract_tarball(tbpath, expath, 0755, function(err) {
    assert.ok(err);
    n++;
  });
  beforeExit(function() {
    assert.equal(n, 1);
  });
};

exports.setup = function(done) {
  require('util/pubsub').ensure("config", done);
};
