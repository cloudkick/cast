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

var log = require('util/log');
var config = require('util/config');
var sys = require('sys');
var path = require('path');
var RunitServiceDirectory = require('runit/services').RunitServiceDirectory;

exports.ServiceManager = function () {
  this.runit = new RunitServiceDirectory(config.get().servicedir);
  this.expire = Date.now();
  this.requests = [];
  this._cache = {};
};

exports.ServiceManager.prototype.list_services = function(callback) {
  var now = Date.now();
  var self = this;

  // Expire if its old
  if (now >= this.expire) {
    this.requests.push(callback);

    if (this.requests.length > 1) {
      return;
    }

    this.runit.list_services_details(function (err, services) {
      var subscribers = self.requests;

      if (err) {
        return callback(err, services);
      } 
      self._cache["list_services_details"] = [err, services];
      self.expire = new Date(now + (config.get().norris_ttl * 1000));
      self.requests = [];

      // Notify subscribers
      async.forEach(subscribers, function(subscriber, callback) {
        subscriber(err, services);
        callback();
      }, function() {});
    });
  } else {
    process.nextTick(function() {
      var cc = self._cache["list_services_details"];
      callback(cc[0], cc[1]);
    });
  }
};
