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

var optparse = require('optparse/lib/optparse');

var version = require('util/version');

var defaults = [
  ['-h', '--help', 'Print this help'],
  ['-V', '--version', 'Print the version'],
  ['-d', '--debug', 'Enable "debug" log level and return actual stack ' +
                    'traces with the error responses']
];

var switches = [];

var options = {};

function add(arr) {
  switches = switches.concat(arr);
}

function halt(parser) {
  parser.halt();
  process.nextTick(function() {
    process.exit(0);
  });
}

function getParser() {
  var parser = new optparse.OptionParser(switches);

  parser.on('help', function() {
    sys.puts(parser.toString());
    halt(parser);
  });

  parser.on('version', function() {
    sys.puts(version.toString());
    halt(parser);
  });

  parser.on(function(opt) {
    sys.puts('No handler was defined for option: ' + opt);
    halt(parser);
  });

  parser.on('debug', function() {
    options.debug = true;
  });

  return parser;
}

function getOptions() {
  return options;
}

if (switches.length === 0 && defaults.length > 0) {
  // Add default option
  add(defaults);
}

exports.add = add;
exports.getParser = getParser;
exports.getOptions = getOptions;
