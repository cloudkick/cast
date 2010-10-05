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

/*
 * Calls a function with the provided arguments.
 *
 * Last argument passed to the function must be a callback which is called with null as the first
 * argument (error) and other arguments if the called function passes any other argument besides
 * error to its callback.
 *
 */
exports.call_ignoring_error = function(func) {
  var arg, call_func;
  var args = [];
  var callback = (arguments.length > 1) ? arguments[arguments.length - 1] : null;

  if (typeof(func) !== 'function') {
    throw new Error('First argument must a function');
  }

  if (callback && (typeof(callback) !== 'function')) {
    throw new Error('Last argument (callback) must a function');
  }

  if (arguments.length > 2) {
    for (var i = 1; i < (arguments.length - 1); i++) {
      arg = arguments[i];
      args.push(arg);
    }
  }

  func_callback = function() {
    if (!callback) {
      return;
    }

    var args = [null];

    // We assume that the first argument passed to this function is error and ignore it
    if (arguments.length > 1) {
      for (var i = 1; i < arguments.length; i++) {
        arg = arguments[i];
        args.push(arg);
      }
    }

    callback.apply({}, args);
  };

  args.push(func_callback);

  func.apply({}, args);
};
