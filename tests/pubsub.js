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

var ps = require('util/pubsub');
var sys = require('sys');


exports['basic subs'] = function(assert, beforeExit) {
  var n = 0;
  var xnum = 42;
  ps.on("basic", function(value) {
    n++;
    assert.equal(xnum, value, "passed parameter from publisher was wrong");
    xnum++;
  });

  ps.emit("basic", xnum);
  ps.emit("basic", xnum);

  beforeExit(function(){
    assert.equal(2, n, 'Events Received');
  });
};

exports['sub once'] = function(assert, beforeExit) {
  var n = 0;
  var vnum = 42;
  ps.once("once", function(value) {
    n++;
    assert.equal(vnum-1, value, 'passed parameter');
    process.nextTick(function() {
      ps.emit("once", vnum);
    });
  });

  ps.emit("once", vnum++);
  ps.emit("once", vnum++);

  beforeExit(function(){
    assert.equal(1, n, 'Events Received');
  });
};

exports['bad params'] = function(assert, beforeExit) {
  var n = 0;
  try {
    ps.once()
  }
  catch(e) {
    n++;
    assert.match(e, /pubsub/);
  }
  try {
    ps.on()
  }
  catch(e) {
    n++;
    assert.match(e, /pubsub/);
  }
  try {
    ps.emit()
  }
  catch(e) {
    n++;
    assert.match(e, /pubsub/);
  }
  beforeExit(function(){
    assert.equal(3, n, 'Exceptions thrown');
  });
};
