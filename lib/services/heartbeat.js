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

var http = require('http');
var https = require('https');
var url = require('url');

var async = require('async');
var sprintf = require('sprintf').sprintf;

var Service = require('services').Service;
var ps = require('util/pubsub');
var control = require('control');
var misc = require('util/misc');
var config = require('util/config');
var log = require('util/log');

var SERVICE_NAME = 'Heartbeat';

function Heartbeat() {
  Service.call(this, SERVICE_NAME);

  this._timeoutId = null;
}

Heartbeat.prototype.start = function() {
  Service.prototype.start.call(this);
  this._sendHeartbeat();
};

Heartbeat.prototype.stop = function() {
  Service.prototype.stop.call(this);

  if (this._timeoutId) {
    clearTimeout(this._timeoutId);
  }
};

Heartbeat.prototype._sendHeartbeat = function(callback) {
  callback = callback || function() {};
  var self = this;
  var serverUrl = config.get()['heartbeat']['url'];
  var timestamp = misc.getUnixTimestamp();
  var payload = {
    'timestamp': timestamp
  };

  if (!serverUrl) {
    callback();
    return;
  }

  log.info(sprintf('Sending heartbeat to %s', serverUrl));

  async.series([
    function getInfo(callback) {
      control.info.getInfo(function(err, info) {
        payload['agent_info'] = info;
        callback();
      });
    },

    function sendHearbeat(callback) {
      var defaultPort, module;

      var parsed = url.parse(serverUrl);
      if (parsed.protocol === 'http:') {
        defaultPort = 80;
        module = http;
      }
      else {
        defaultPort = 443;
        module = https;
      }

      var port = (parsed.port) ? parsed.port : defaultPort;
      var body = JSON.stringify(payload);

      var options = {
        'host': parsed.hostname,
        'port': port,
        'path': parsed.pathname,
        'method': 'POST'
      };

      options.headers = {
        'content-type': 'application/json',
        'content-length': body.length
      };

      var req = module.request(options, function(res) {
        callback();
      });

      req.on('error', callback);
      req.end(body);
    }
  ],

  function(err) {
    // Re-schedule ourselves
    self._schedule();
    callback(err);
  });
};

Heartbeat.prototype._schedule = function() {
  var self = this;
  var interval = config.get()['heartbeat']['interval'];
  this._timeoutId = setTimeout(this._sendHeartbeat.bind(self),
                               interval);
};

var service = new Heartbeat();

function load() {
  ps.on(ps.AGENT_STATE_START, function() {
    if (!service.isRunning) {
      service.start();
    }
  });

  ps.on(ps.AGENT_STATE_STOP, function() {
    if (service.isRunning) {
      service.stop();
    }
  });
}

exports.load = load;
exports.instance = service;
