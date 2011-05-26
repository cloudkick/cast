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

var requiredParams = require('http/middleware/required-params').attachMiddleware;

exports['test_all_no_required_params_specified'] = function(test, assert) {
  var called = 0;

  requiredParams(null)({}, {}, function() {
    called++;
  });

  requiredParams([])({}, {}, function() {
    called++;
  });

  setTimeout(function() {
    assert.equal(called, 2);
    test.finish();
  }, 100);
};

exports['test_missing_params'] = function(test, assert) {
  var resBuffer = '';
  var resCode = null;
  var called = 0;
  var errSent = false;

  var res = {
    write: function(data) {
      resBuffer += data;
    },
    writeHead: function(code) {
      resCode = code;
    },
    end: function(data) {
      resBuffer += data;
    }
  };

  requiredParams(['parameter_one'])({}, res, function() {
    called++;
  });

  setTimeout(function() {
    assert.equal(called, 0);
    assert.equal(resCode, 400);
    assert.match(resBuffer, /missing required parameters/i);
    test.finish();
  }, 100);
};

exports['test_all_required_params_provided'] = function(test, assert) {
  var resBuffer = '';
  var resCode = null;
  var called = 0;
  var errSent = false;

  var req = {
    'body': {
      'parameter_one': 'foobar'
    }
  };

  requiredParams(['parameter_one'])(req, {}, function() {
    called++;
  });

  setTimeout(function() {
    assert.equal(called, 1);
    test.finish();
  }, 100);
};
