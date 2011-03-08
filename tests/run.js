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

var succeeded_tests = [];
var failed_tests = [];

function equals_line(str) {
  return  "[blue]====================[/blue]"
        + " [red]" + str + "[/red] "
        + "[blue]====================[/blue]";
}

function execute_test(file, callback) {
  if (file.indexOf('tests/') == 0) {
    file = file.replace('tests/', '');
  }

  var args = ['common.js', sprintf('./%s', file)];
  var child = spawn(process.execPath, args);
  var stderr = [];
  var stdout = [];
  var dead = false;
  var timed_out = false;
  var timeout_id;

  child.stderr.on('data', function(chunk) {
    stderr.push(chunk);
  });

  child.stdout.on('data', function(chunk) {
    stdout.push(chunk);
  });

  child.on('exit', function(code) {
    clearTimeout(timeout_id);
    if (code !== 0) {
      terminal.puts(equals_line(sprintf("%s", file)));
      if (timed_out) {
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
      failed_tests.push(file);
    }
    else {
      successes += 1;
      succeeded_tests.push(file);
    }
    total += 1;
    callback();
    return;
  });

  timeout_id = setTimeout(function() {
    timed_out = true;
    child.kill('SIGKILL');
  }, TEST_TIMEOUT);
}

function print_test_results(tests) {
  var i = 0;
  var tests_len = tests.length;

  for (i = 0; i < tests_len; i++) {
    test = tests[i];
    terminal.puts(sprintf('     - %s', test));
  }
}

function run_tests(tests) {
  async.forEachSeries(tests, function(test, callback) {
    // Execute the test file and report any errors
    execute_test(test, callback);
  },

  function() {
    terminal.puts(equals_line("Tests Complete"));
    terminal.puts(sprintf("    Successes: [green]%s[/green]", successes));
    print_test_results(succeeded_tests);
    terminal.puts(sprintf("     Failures: [red]%s[/red]", failures));
    print_test_results(failed_tests);
    terminal.puts("    ------------------");
    terminal.puts("        Total: " + total);


    process.exit(failures);
  });
}

var tests = process.argv.splice(2);
run_tests(tests);
