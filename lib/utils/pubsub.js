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

var log = require('./log');
var sys = require('sys');
var events = require('events').EventEmitter;
var emitter = null;

function PubSubEmitter(){
  events.call(this);
}
sys.inherits(PubSubEmitter, events);
emitter = new PubSubEmitter();

exports.AGENT_CONFIG_DONE = "cast.agent.config.done";
exports.AGENT_STATE_START ='cast.agent.state.start';
exports.AGENT_STATE_STOP ='cast.agent.state.stop';
exports.AGENT_STATE_EXIT ='cast.agent.state.exit';

(function(){

  function emitf(path, data)
  {
    if (path === undefined) {
      throw "pubsub: path must be defined, did you forget to add a new event type?";
    }
    emitter.emit(path, data);
  }

  function onf(path, cb, once)
  {
    if (path === undefined) {
      throw "pubsub: path must be defined, did you forget to add a new event type?";
    }

    if (once === undefined) {
      once = false;
    }

    function incb() {
      cb.apply(cb,  Array.prototype.slice.call(arguments));
      if (once === true) {
        emitter.removeListener(path, incb);
      }
    }
    emitter.addListener(path, incb);
  }

  function oncef(path, cb)
  {
    return onf(path, cb, true);
  }

  exports.emit = emitf;
  exports.on = onf;
  exports.once = oncef;
})();

