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

var fs = require('fs');
var path = require('path');
var assert = require('assert');

var sprintf = require('sprintf').sprintf;

/*
 * A test which verified that all the http modules export the "urls" variable.
 */

exports['test_all_http_modules_export_urls_variable'] = function() {
  var blacklist = [ 'constants.js' ];
  var httpModulesPath = path.join(process.cwd(), '../lib/services/http/');

  fs.readdir(httpModulesPath, function(err, files) {
    assert.ifError(err);

    var module, file, i;
    var filesCount = files.length;

    for (i = 0; i < filesCount; i++) {
      file = files[i];

      if (blacklist.indexOf(file) !== -1) {
        continue;
      }

      module = require(sprintf('services/http/%s', file.replace('.js', '')));
      assert.ok(module.urls);
    }
  })
};
