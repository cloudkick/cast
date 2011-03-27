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

var async = require('extern/async');

var tarball = require('util/tarball');
var assert = require('./../assert');

exports['test_extract_success'] = function() {
  var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
  var expath = path.join(process.cwd(), '.tests/fooserv1');

  tarball.extractTarball(tbpath, expath, 0755, function(err) {
    assert.ifError(err);
  });
};

exports['test_extract_to_path_that_already_exists_throws_error'] = function() {
  var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
  var expath = path.join(process.cwd(), '.tests/fooserv2');

  tarball.extractTarball(tbpath, expath, 0755, function(err) {
    assert.ifError(err);
    tarball.extractTarball(tbpath, expath, 0755, function(err) {
      assert.ok(err);
    });
  });
};

exports['test_extract_inexistent_tarball'] = function() {
  var tbpath = path.join(process.cwd(), 'data/slowapp.tar.gz');
  var expath = path.join(process.cwd(), '.tests/slowserv');
  tarball.extractTarball(tbpath, expath, 0755, function(err) {
    assert.ok(err);
  });
};
