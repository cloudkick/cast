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

var sprintf = require('sprintf').sprintf;
var terminal = require('terminal');

var ps = require('util/pubsub');

function printMessage(type, msg) {
  var msgPrefix;

  if (type === 'client') {
    msgPrefix = '[blue][client][/blue]';
  }
  else if (type === 'server') {
    msgPrefix = '[magenta][server][/magenta]';
  }
  else if (type === 'transport') {
    msgPrefix = '[cyan][transport][/cyan]';
  }

  terminal.puts(sprintf('%s %s', msgPrefix, msg));
}

function printErrorAndExit(err, exitCode, includeStackTrace) {
  includeStackTrace = includeStackTrace || false;

  printMessage('client', sprintf('[bold]Error[/bold]: %s', err.message));
  ps.emit(ps.CLIENT_STATE_EXIT, {'exitCode': 1});
}

exports.printErrorAndExit = printErrorAndExit;
