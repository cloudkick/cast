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
 * Logging subsytem, providing log filtering and a simple set of log message
 * types.
 */

var sys = require("sys");
var stacktrace = require('extern/stacktrace');
/**
 * TODO: format strings
 */

var loglevels = {
	'nothing': 0,
	'crit': 1,
	'err': 2,
	'warn': 3,
	'info': 4,
	'debug': 5
};

var loglevel_strs = [];
var loglevel = loglevels.debug;

function logit (level, inargs) {
  if (level <= loglevel) {
    sys.log(loglevel_strs[level]+ ": "+ Array.apply({}, inargs).join(" "));
  }
}

exports.set_loglevel = function(level) {
	loglevel = level;
};

exports.trace = function() {
  return stacktrace.trace();
};

(function() {
  var localf = function (attrname) {
    exports[attrname] = (function (level) {
      return function () {
        return logit(level, arguments);
        };
    })(loglevels[attrname]);
  };
  for (var attrname in loglevels) {
		if (loglevels.hasOwnProperty(attrname)) {
      loglevel_strs[loglevels[attrname]] = attrname;
      localf(attrname);
		}
  }
})();
