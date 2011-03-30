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

/**
 * Norris Engine gives you Facts about the currently running machine.
 */

var async = require('async');

var misc = require('util/misc');
var log = require('util/log');
var config = require('util/config');

var defaults = {};
var factcache = {};
var expiry = new Date(0);
var requests = [];
var facttypes = [
  'arch', 'hostname', 'kernel', 'gnutar', 'runsvdir_running', 'node_binary',
  'node_version'
];

/**
 * Expire Norris fact cache
 */
exports.expire = function() {
  expiry = Date.now();
};

/**
 * Retrieve Norris facts
 *
 * @param {Function} cb A callback taking the facts object as its only argument.
 */
exports.get = function(cb) {
  var now = Date.now();

  // If the cache is expired rebuild it
  if (now >= expiry) {
    requests.push(cb);

    // If a refresh is already in progress, just subscribe for the results
    if (requests.length > 1) {
      return;
    }

    // Otherwise we need to actually rebuild the cache ourselves
    factcache = misc.merge({}, defaults);

    async.forEach(facttypes, function(item, callback) {
      var ft = require('./facts/' + item);
      ft.get(function(fact) {
        factcache = misc.merge(factcache, fact);
        callback();
      });
    },
    function(err) {
      // Have incoming requests hit the cache directly at this point
      expiry = new Date(now + (config.get()['norris_ttl'] * 1000));
      var subscribers = requests;
      var facts = factcache;
      requests = [];

      // Notify subscribers
      async.forEach(subscribers, function(subscriber, callback) {
        subscriber(facts);
        callback();
      }, function() {});
    });
  }

  // Otherwise just return the cache
  else {
    process.nextTick(function() {
      cb(factcache);
    });
  }
};

var getFactCache = function() {
  return factcache;
};

var flushFactCache = function() {
  factcache = {};
};

exports.getFactCache = getFactCache;
exports.flushFactCache = flushFactCache;
