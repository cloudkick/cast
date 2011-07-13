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

/**
 * Test which verifies that the control test mock objects take the same number
 * of argument that the actual control objects.
 */

var path = require('path');

var async = require('async');
var sprintf = require('sprintf').sprintf;

var fsUtil = require('util/fs');
var misc = require('util/misc');

var filename = path.basename(__filename);

exports['test_mock_objects_are_up_to_dates'] = function(test, assert) {
  fsUtil.getMatchingFiles(__dirname, '.js$', true, function(err, files) {
    assert.ifError(err);

    async.forEach(files, function(file, callback) {
      var exported, filePath;

      if (file === filename) {
        callback();
        return;
      }

      filePath = path.join(__dirname, file);
      misc.getExportedMember(filePath, 'mock', function(err, mockControl) {
        var control, key, name, origFunc, mockFunc, errMsg;
        if (err || !mockControl) {
          callback();
          return;
        }

        name = file.replace('.js', '').replace('test-', '');
        for (key in mockControl) {
          if (mockControl.hasOwnProperty(key)) {
            control = require(path.join('control', name));
            origFunc = control[key];
            mockFunc = mockControl[key];

            errMsg = sprintf('mock control function %s does not take the same ' +
                     'number of arguments as the control one.', mockFunc.name);
            assert.equal(origFunc.length, mockFunc.length, errMsg);
          }
        }

        callback();
      });
    },

    function(err) {
      assert.ifError(err);
      test.finish();
    });
  });
};
