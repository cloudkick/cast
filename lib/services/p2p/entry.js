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

var dht = require('extern/dht');
var config = require('util/config');
var log = require('util/log');
var sys = require('sys');
var manager = require('services/manager');

exports.create_service = function (host, port) {
  var p2p_service = new P2PService(host, port);
  p2p_service.start();
  return p2p_service;
};


var mb = function (s) {
    return new Buffer(s.toString(), "ascii");
}

function P2PService(host, port) {
  this.host = host;
  this.port = port;
  this._dht = dht.createNode(port).setGlobal();
  this._sm = new manager.ServiceManager();
};


P2PService.prototype.start = function () {
  var self = this;

  console.log("Starting the p2p service on \"%s\", %d", this.host, this.port);
  this._dht.join(this.host, this.port, function (success) {
    console.log("Joined", success);
    console.log(sys.inspect(self._dht));
    self._dht.put(mb("test"), mb("more"), 0);
    self._sm.list_services(function (err, cb) {
      console.log(cb);
      console.log(err);
    });
  });
};

P2PService.prototype.stop = function () {
  log.info("Starting the p2p service");

};
