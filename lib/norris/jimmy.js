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
 * Helpers to make it really easy to make facts.
 *
 */

var exec = require('child_process').exec;
var misc = require('util/misc');
var async = require('extern/async');

exports.command_facts = function(factmap) {
  return function(cb) {
    var facts = {};
    var keys = Object.getOwnPropertyNames(factmap);

    async.forEach(keys, function(key, callback) {
      exec(factmap[key], function(err, stdout, stderr) {
        facts[key] = misc.trim(stdout);
        callback();
      });
    },
    function(err) {
      cb(facts);
    });
  };
};
