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
 
var optparse = require('extern/optparse/lib/optparse');
var log = require('util/log');
var sys = require('sys');
var version = require('util/version');
var defaults = [
  ['-h', '--help', 'Print this help'],
  ['-V', '--version', 'Print the version']
];

var switches = [];

exports.add = function(arr) {
  switches = switches.concat(arr);
};

function halt(parser) {
  parser.halt();
  process.nextTick(function() {
    process.exit(0);
  });
}

exports.parser = function() {
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
      sys.puts('No handler was defined for option: ' +  opt);
      halt(parser);
  });
  parser.on('*', function(opt, value) {
      sys.puts('wild handler for ' + opt + ', value=' + value);
  });
  return parser;
};

(function() {
  exports.add(defaults);
})();
