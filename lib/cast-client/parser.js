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

var path = require('path');

var CommandParser = require('util/command_parser').CommandParser;

/*
 * Options which are available to any command that requests them
 */
exports.GLOBAL_OPTIONS = {
  'remote': {
    names: ['--remote', '-r'],
    dest: 'remote',
    title: 'remote',
    action: 'store',
    desc: 'The remote to use for this command'
  }
};

/**
 * Name of the cast client binary
 */
exports.BINARY = 'cast';

/**
 * Usage banner for cast client
 */
exports.BANNER = 'Usage: cast command [sub-command]';

/**
 * Commands to configure and parse for
 */
exports.COMMANDS = [
  'info',
  'version',
  'init',
  'bundles/list',
  'bundles/create',
  'bundles/validate-manifest',
  'bundles/upload',
  'instances/create',
  'instances/destroy',
  'instances/list',
  'services/list',
  'services/enable',
  'services/disable',
  'services/start',
  'services/stop',
  'services/restart',
  'services/tail',
  'remotes/add',
  'remotes/delete',
  'remotes/list',
  'remotes/set-default'
];

/**
 * Retrieve a command parser for the cast client
 * @return {CommandParser} A configured command parser.
 */
exports.getParser = function() {
  var p = new CommandParser(path.join(__dirname, 'commands'));

  p.binary = exports.BINARY;
  p.banner = exports.USAGE;
  p.addCommands(exports.COMMANDS);
  p.addGlobalOptions(exports.GLOBAL_OPTIONS);

  return p;
};
