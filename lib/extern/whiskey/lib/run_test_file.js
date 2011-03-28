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

var sys = require('sys');

var async = require('async');

var longStackTraces = require('./extern/long-stack-traces');
var common = require('./common');
var constants = require('./constants');
var testUtil = require('./util');
var assert = require('./assert');

var failed = {};
var succeeded = {};

/**
 * Execute the test file after the event loop starts.
 */
process.nextTick(function() {
  if (process.argv.length < 3) {
    sys.puts('No test file specified');
    process.exit(1);
  }

  var paths_to_require = [];
  var testPath = process.argv[2];
  var cwd = (process.argv.length >= 4) ? process.argv[3] : null;
  var chdir = (process.argv.length >= 5) ? process.argv[4] : null;
  var testInitFile = (process.argv.length === 6) ? process.argv[5] : null;
  var testModule = testPath.replace(/\.js$/, '');

  testUtil.addToRequirePaths(testPath, cwd);

  var exportedFunctions;

  if (!testUtil.isNull(chdir)) {
    try {
      process.chdir(chdir);
    }
    catch (err) {}
  }

  try {
    exportedFunctions = require(testModule);
  }
  catch (err) {
    failed['file_does_not_exist'] = err;
    return;
  }

  var exportedFunctionsNames = Object.keys(exportedFunctions);
  var testInitModule = null, testInitFunction = null, functionsToRun;
  var setUpFunctionIndex, tearDownFunctionIndex;
  var testFunction, testFunctionName;

  functionsToRun = exportedFunctionsNames.filter(common.isValidTestFunctionName);
  functionsToRunLen = functionsToRun.length;
  setUpFunctionIndex = exportedFunctionsNames.indexOf(constants.SETUP_FUNCTION_NAME);
  tearDownFunctionIndex = exportedFunctionsNames.indexOf(constants.TEARDOWN_FUNCTION_NAME);

  async.series([
    function(callback) {
      // Call test init function (if present)
      if (!testUtil.isNull(testInitFile)) {
        try {
          testInitModule = require(testInitFile);
        }
        catch (err) {
          callback(err);
          return;
        }

        testInitFunction = testInitModule[constants.INIT_FUNCTION_NAME];
        if (testInitFunction) {
          try {
            testInitFunction(callback);
            return;
          }
          catch (err) {
            callback(err);
            return;
          }
        }
      }

      callback();
    },

    function(callback) {
      // Call setUp function (if present)
      if (setUpFunctionIndex !== -1) {
        testFunction = exportedFunctions[constants.SETUP_FUNCTION_NAME];

        try {
          testFunction(callback);
          return;
        }
        catch (err) {
          callback(err);
          return;
        }
      }

      callback();
    },

    function(callback) {
      // Run the tests
      for (var i = 0; i < functionsToRunLen; i++) {
        testFunctionName = functionsToRun[i];
        testFunction = exportedFunctions[testFunctionName];

        try {
          testFunction();
        }
        catch (err) {
          failed[testFunctionName] = err;
          continue;
        }

        succeeded[testFunctionName] = true;
      }

      callback();
    },

    function(callback) {
      // Call tearDown function (if present)
      if (tearDownFunctionIndex !== -1) {
        testFunction = exportedFunctions[constants.TEARDOWN_FUNCTION_NAME];

        try {
          testFunction(callback);
          return;
        }
        catch(err) {
          callback(err);
          return;
        }
      }

      callback();
    }],

    function(err) {
      if (err) {
        failed['setup_error'] = err;
      }
    });
});

process.on('uncaughtException', function(err) {
  failed['uncaught_exception'] = err;
});

process.on('exit', function() {
  common.printChildResults(succeeded, failed);
  process.reallyExit(failed.length);
});
