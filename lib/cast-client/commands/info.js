/*
 * Licensed to Cloudkick, Inc ('Cloudkick"); under one or more
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

var sprintf = require('sprintf').sprintf;

var terminal = require('util/terminal');
var version = require('util/version');

var config = {
  shortDescription: 'Display Cast client inforation.',
  longDescription: 'Display Cast client inforation (version, website, etc.).',
  requiredArguments: [],
  optionalArguments: [],
  options: []
};

var CAST_WEBSITE = 'http://www.cast-project.org';
var GITHUB_PAGE = 'https://github.com/cloudkick/cast';
var BUILDBOT_PAGE = 'http://buildbot.cast-project.org/';
var MAILING_LIST = 'https://groups.google.com/forum/#!forum/cast-dev';

var handleCommand = function(args) {
  terminal.puts('             [bold]CAST[/bold]');
  terminal.puts('');
  terminal.puts('    Deploy your applications');
  terminal.puts('         like a wizard');
  terminal.puts('');
  terminal.puts('              ,/   *');
  terminal.puts("           _,'/_   |");
  terminal.puts("           `(\")' ,'/");
  terminal.puts('        _ _,-H-./ /');
  terminal.puts('        \\_\\_\\.   /');
  terminal.puts('           )\" |  (');
  terminal.puts('       __ /   H   \\__');
  terminal.puts('       \\     /|\\    /');
  terminal.puts("        `--'|||`--'");
  terminal.puts('           ==^==');
  terminal.puts(sprintf('     [bold]Cast client v%s.%s.%s[/bold]', version.MAJOR, version.MINOR, version.PATCH));
  terminal.puts(sprintf(' [bold]%s[/bold]', CAST_WEBSITE));
  terminal.puts('');
  terminal.puts(sprintf('Mailing list: [bold]%s[/bold]', MAILING_LIST));
  terminal.puts(sprintf('Github: [bold]%s[/bold]', GITHUB_PAGE));
  terminal.puts(sprintf('Buildbot: [bold]%s[/bold]', BUILDBOT_PAGE));
};

exports.config = config;
exports.handleCommand = handleCommand;
