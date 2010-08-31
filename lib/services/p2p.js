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
var ps = require('util/pubsub');
var config = require('util/config');
var log = require('util/log');
var p2p = require('services/p2p/entry');

exports.load = function()
{
  var conf = config.get();
  var service;

  ps.on(ps.AGENT_STATE_START, function() {
    // Configure the P2P system;
    service = p2p.create_service("localhost", 10000);
  });

  ps.on(ps.AGENT_STATE_STOP, function() {
    // Stop the P2P system;
    if (service) {
      service.stop();
    }
  });
};