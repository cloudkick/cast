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

var sprintf = require('sprintf').sprintf;
var async = require('async');

var http = require('services/http');
var agent = require('cast-agent/entry');

var API_VERSION = '1.0';

/*
 * Need to mock the agent start date, because those test don't actually start
 * the agent so this variable is null.
 */
agent.dateStarted = new Date();

// @TODO: Verify all the routes including ones which should return 404
var ACTIVE_ROUTES = [
  // bundles
  ['/bundles/', 'GET'],

  // ca
  ['/ca/', 'GET'],

  // endpoints
  ['/endpoints/', 'GET'],

  // facts
  ['/facts/', 'GET'],

  // health
  ['/health/', 'GET'],
  ['/health/scheduled/', 'GET'],

  // info
  ['/info/', 'GET'],

  // instances
  ['/instances/', 'GET'],


  // services
  ['/services/', 'GET']
];

/*
 * A test which verified that all the http modules export the "urls" variable.
 */
exports['test_all_http_modules_export_register_function'] = function(test, assert) {
  var blacklist = [ 'constants.js', 'api.js' ];
  var httpModulesPath = path.join(process.cwd(), '../lib/http/endpoints/');

  fs.readdir(httpModulesPath, function(err, files) {
    assert.ifError(err);

    var module, file, i;
    var filesCount = files.length;

    for (i = 0; i < filesCount; i++) {
      file = files[i];

      if (blacklist.indexOf(file) !== -1) {
        continue;
      }

      module = require(sprintf('http/endpoints/%s', file.replace('.js', '')));
      assert.ok(module.register);
      assert.ok(typeof module.register === 'function');
    }

    test.finish();
  });
};

/**
 * Test none of the active routes returns 404.
 */
exports['test_routs_work_and_dont_return_404'] = function(test, assert) {
  var i, len, route, url, version, req;
  var getServer = http.getAndConfigureServer;

  async.forEachSeries(ACTIVE_ROUTES, function(route, callback) {
    req = {
      url: sprintf('/%s%s', API_VERSION, route[0]),
      method: route[1]
    };

    assert.response(getServer(), req, function(res) {
      assert.ok(res.statusCode !== 404);
      callback();
    });
  },

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};
