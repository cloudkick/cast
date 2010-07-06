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

var sys = require("sys");
var log = require('utils/log');
var version = require('utils/version');
var ps = require('utils/pubsub');

exports.run = function() {
  var called_stop = false;
  log.info(version.toString());
/*
  var rv = config.init();

  if (!rv) {
    return;
  }
*/
  ps.on(ps.AGENT_STATE_STOP, function() {
    called_stop = true;
  }, true);

  ps.on(ps.AGENT_STATE_EXIT, function() {
    if (called_stop === false) {
      ps.pub(ps.STATE_STOP);
      called_stop = true;
    }
  }, true);

  ps.on(ps.AGENT_CONFIG_DONE, function(foo) {
    process.addListener('SIGINT', function () {
      log.debug("Caught SIGINT, exiting....");
      ps.pub(ps.AGENT_STATE_EXIT, {'why': 'signal', 'value': "SIGINT"});
      process.exit();
    });
    log.err(foo)
  }, true);

  ps.emit(ps.AGENT_CONFIG_DONE, 'foobar');

};
