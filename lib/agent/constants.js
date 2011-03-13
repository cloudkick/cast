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

var agent = require('services/agent');

exports.OUTGOING_COMMAND_MAPPING = {
  'hello': {
    command: 'hello 1 %s %s %s',
    argCount: 3,
    args: ['version', 'endpoint_key', 'endpoint_secret'],
    dontLog: ['endpoint_key', 'endpoint_secret']
  },
  'ping': {
    command: 'ping %s',
    argCount: 1,
    args: ['current_time'],
    dontLog: []
  },
  'result': {
    command: 'result %s %s %d\r\n%s\r',
    argCount: 4,
    args: ['check_name', 'token', 'data_length', 'data'],
    dontLog: []
  }
};

exports.INCOMING_COMMAND_MAPPING = {
  'accepted': {
    argCount: 0,
    argsSplit: true,
    args: [],
    handler: null,
    dontLog: []
  },
  'run_check': {
    argCount: 4,
    argsSplit: true,
    args: ['token', 'check_name', 'payload_len', 'payload'],
    handler: null,
    dontLog: []
  },
  'pong': {
    argCount: 1,
    argsSplit: true,
    args: ['pong_value'],
    handler: null,
    dontLog: []
  },
  'restart': {
    argCount: 0,
    argsSplit: true,
    args: [],
    handler: null,
    dontLog: []
  },
  'error': {
    argCount: 1,
    argsSplit: false,
    args: ['error_message'],
    handler: null,
    dontLog: []
  }
};

exports.CONNECT_TIMEOUT = 5000;
exports.INITIAL_CONNECT_DELAY = 2000;
exports.PING_INTERVAL = 10000;
exports.MAX_MISSED_PONGS = 2;
exports.CHECK_TIMEOUT = 30000;
exports.WORKER_POOL_SIZE = 1;

exports.COMMAND_QUEUE_SIZE = 20;
exports.DONT_QUEUE = ['hello', 'ping']; // Outgoing commands which are not queued if the connection fails

exports.WORKER_CHECK_SCRIPT = 'lib/agent/check_worker.js';
