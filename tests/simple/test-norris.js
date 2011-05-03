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

var async = require('async');

var norris = require('norris');
var assert = require('./../assert');

exports['test_get_fact'] = function() {
  norris.get(function(facts)  {
    console.log(facts);

    // Check the hostname
    assert.ok(facts.hostname);

    // Check the architecture
    assert.ok(facts.arch);

    // Check gnutar
    assert.ok(facts.gnutar);

    // Check username
    assert.ok(facts.username);
  });
};
