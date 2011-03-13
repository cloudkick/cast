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

process.chdir(__dirname);
require.paths.unshift('../lib');

var fs = require('fs');
var sys = require('sys');
var path = require('path');
var spawn = require('child_process').spawn;

var async = require('extern/async');
var sprintf = require('extern/sprintf').sprintf;

var config = require('util/config');
var ps = require('util/pubsub');
var terminal = require('util/terminal');

var TEST_TIMEOUT = 15 * 1000;
var MAX_BUFFER = 512 * 1024;

var total = 0;
var successes = 0;
var failures = 0;

var succeededTests = [];
var failedTests = [];

function equalsLine(str) {
  return  "[blue]====================[/blue]"
        + " [red]" + str + "[/red] "
        + "[blue]====================[/blue]";
}

function executeTest(file, verbosity, callback) {
  if (file.indexOf('tests/') == 0) {
    file = file.replace('tests/', '');
  }

  var fileName = path.basename(file);

  printMsg(sprintf('Running test: [bold]%s[/bold]', fileName), verbosity, 2);

  var args = ['common.js', sprintf('./%s', file)];
  var child = spawn(process.execPath, args);
  var stderr = [];
  var stdout = [];
  var dead = false;
  var timedOut = false;
  var timeoutId;

  child.stderr.on('data', function(chunk) {
    stderr.push(chunk);
  });

  child.stdout.on('data', function(chunk) {
    stdout.push(chunk);
  });

  child.on('exit', function(code) {
    clearTimeout(timeoutId);
    if (code !== 0) {
      terminal.puts(equalsLine(sprintf("%s", file)));
      if (timedOut) {
        terminal.puts('--- test timed out ---');
      }
      terminal.puts('--- exit code: ' + code + ' ---');
      if (stderr.length > 0) {
        terminal.puts('--- stderr ---');
        terminal.puts(stderr.join(''));
      }
      if (stdout.length > 0) {
        terminal.puts('--- stdout ---');
        terminal.puts(stdout.join(''));
      }
      failures += 1;
      failedTests.push(file);
    }
    else {
      successes += 1;
      succeededTests.push(file);
    }
    total += 1;
    callback();
    return;
  });

  timeoutId = setTimeout(function() {
    timedOut = true;
    child.kill('SIGKILL');
  }, TEST_TIMEOUT);
}

function printTestResults(tests) {
  var i = 0;
  var testsLen = tests.length;

  for (i = 0; i < testsLen; i++) {
    test = tests[i];
    terminal.puts(sprintf('     - %s', test));
  }
}

function printTestsResults() {
  terminal.puts(equalsLine("Tests Complete"));
  terminal.puts(sprintf("    Successes: [green]%s[/green]", successes));
  printTestResults(succeededTests);
  terminal.puts(sprintf("     Failures: [red]%s[/red]", failures));
  printTestResults(failedTests);
  terminal.puts("    ------------------");
  terminal.puts("        Total: " + total);

  process.exit(failures);
}

function printMsg(msg, verbosity, minVerbosity) {
  if (verbosity >= minVerbosity) {
    terminal.puts(msg);
  }
}

function runTests(tests, verbosity) {
  async.forEachSeries(tests, function(test, callback) {
    // Execute the test file and report any errors
    executeTest(test, verbosity, callback);
  },

  printTestsResults);
}

process.addListener('SIGINT', function() {
  printTestsResults();
});

var tests = process.argv.splice(2);
runTests(tests, 2);
