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
var constants = require('constants');

var async = require('async');

var tail = require('util/tail');

var cwd = process.cwd;

exports['test_tailFile_file_does_not_exist'] = function(test, assert) {
  tail.tailFile('/inexistent/path/yeah.more', 500, false,
                function onData(err, data, unsubscribe) {
    assert.ok(err);
    assert.equal(err.errno, constants.ENOENT);
    test.finish();
  });
};


exports['test_tailFile_empty_file'] = function(test, assert) {
  tail.tailFile(path.join(cwd, 'data/foo.js'), 500, false,
                function onData(err, data, unsubscribe) {
    assert.ifError(err);
    assert.equal(data.length, 0);
    test.finish();
  });
};

exports['test_tailFile_largeFile'] = function(test, assert) {
  // File is bigger then 500 bytes so all the request 500 bytes should be
  // returned
  tail.tailFile(path.join(cwd, 'data/text1.txt'), 500, false,
                function onData(err, data, unsubscribe) {
    assert.ifError(err);
    assert.equal(data.length, 500);
    test.finish();
  });
};

exports['test_tailFile_smallFile'] = function(test, assert) {
  // File is only 11 bytes long so only 11 bytes should be returned
  tail.tailFile(path.join(cwd, 'data/text2.txt'), 500, false,
                function onData(err, data, unsubscribe) {
    assert.ifError(err);
    assert.equal(data.length, 11);
    test.finish();
  });
};

exports['test_tailFile_follow_file_does_not_exist'] = function(test, assert) {
  tail.tailFile('/inexistent/path/yeah.more', 500, true,
                function onData(err, data, unsubscribe) {
    assert.ok(err);
    assert.equal(err.errno, constants.ENOENT);
    test.finish();
  });
};

exports['test_tailFile_follow_basic'] = function(test, assert) {
  tail.tailFile(path.join(cwd, 'data/text2.txt'), 500, true,
                function onData(err, data, unsubscribe) {
    assert.ifError(err);
    assert.equal(data.length, 11);
    unsubscribe();
    test.finish();
  });
};

exports['test_tailFile_follow_multiple_subscribers'] = function(test, assert) {
  var filePath = path.join(cwd, '.tests/temp-file-multisubs-test.txt');
  var writeStream = fs.createWriteStream(filePath);
  var unsubscribeArray = [];
  var callbackCalledCount = 0;

  async.series([
    function tailFileSubscriber1(callback) {
      var callbackCalled = false;

      tail.tailFile(filePath, 500, true,
                    function onData(err, data, unsubscribe) {
        assert.ifError(err);
        callbackCalledCount++;

        if (!callbackCalled) {
          callbackCalled = true;
          unsubscribeArray.push(unsubscribe);
          callback();
        }
      });
    },

    function tailFileSubscriber2(callback) {
      var callbackCalled = false;

      tail.tailFile(filePath, 500, true,
                    function onData(err, data, unsubscribe) {
        assert.ifError(err);
        callbackCalledCount++;

        if (!callbackCalled) {
          callbackCalled = true;
          unsubscribeArray.push(unsubscribe);
          callback();
        }
      });
    },

    function writeSomeData(callback) {
      writeStream.write('data1');
      callback();
    }
  ],

  function(err) {
    var intervalId;
    intervalId = setInterval(function() {
      // Callback needs to be called at least 4 times:
      // subscriber #1 - 1 initial callback, 1+ when "data1" is written
      // subscriber #2 - 1 initial callback, 1+ when "data1" is written
      if (callbackCalledCount >= 4) {
        clearInterval(intervalId);

        unsubscribeArray[0]();
        unsubscribeArray[1]();
        test.finish();
      }
    }, 100);
  });
};

exports['test_tailFile_follow_file_changes'] = function(test, assert) {
  test.finish();
};

exports['test_tailFile_follow_file_gets_truncated'] = function(test, assert) {
  test.finish();
};
