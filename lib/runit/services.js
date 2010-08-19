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

var fs = require('fs');
var path = require('path');
var Buffer = require('buffer').Buffer;
var log = require('util/log');
var msic = require('util/misc');
var async = require('extern/async');
var jspack = require('extern/jspack/jspack').jspack;

var RUNSV_TEMPLATE = {
  run: "#!/bin/bash\n# Stub run file\nexit 0",
  finish: "#!/bin/bash\n# Stubbed out finish file\nexit 0;",
  down: "# Down file so it doesn't start up automagically",
  log: {
    "run": "#!/bin/bash\necho 'start'",
    "finish": "#!/bin/bash\necho 'finish'"
  }
};

/**
 * RunitService represents a runit service control directory (as passed to
 * runsv).  These are lazily constructed, so its possible that a RunitService's
 * doesn't corresponding directory doesn't actually exist, and you won't know
 * until you attempt to read the details, etc.
 *
 * @param {String} basedir  The directory in which the service resides
 * @param {String} name     The name of the service, corresponds to the name of
 *                            the service's control directory.
 */
function RunitService(basedir, name) {
  this.basedir = basedir;
  this.name = name;
}


/**
 * Reads the status file of a RunitService and retrieve an object containing:
 *    'name': The name of the service
 *    'time': The time the service was started
 *    'pid': The last known PID of the service, or -1 if it is unknown
 *    'normally: "up" if the service is auto-started, otherwise "down"
 *    'paused': A boolean representing whether the service is paused
 *    'want': "up" if the service is designated as running, otherwise "down"
 *    'term': A boolean representing whether the service was sent TERM
 *    'state': "down", "run" or "finish" depending on the current state
 *
 * Potential errors and the details object are passed to a required callback
 *
 * @param {Function} callback A required callback taking (err, details).
 */
RunitService.prototype.get_details = function(callback) {
  var details = {};
  var err;
  var dir = path.join(this.basedir, this.name);
  var ctrl_path = path.join(dir, "supervise", "status");
  var down_path = path.join(dir, "supervise", "down");
  path.exists(ctrl_path, function(exists) {
    if (!exists) {
      err = new Error("Couldn't find supervise/status file");
      return callback(err, details);
    }
    else {
      fs.open(ctrl_path, "r", 0644, function(_err, fd) {
        if (_err) {
          return callback(_err, details);
        }
        path.exists(down_path, function(exists) {
          var normallyup = (!exists);
          var buf = new Buffer(1024);
          /**
           * The 'status' file binary format is:
           *   Start time is stored as:
           *     Seconds in a uint64_t in indices 0 - 7
           *     Nanoseconds in an unsigned long in indices 8 - 11
           *   PID packed in indices 12 - 15
           *   Paused is 0|1 at index 16
           *   Want is u|d at index 17
           *   TERM is 0|1 at index 18
           *   State is (0|1|2) = (down|run|finish) at index 19
           */
          fs.read(fd, buf, 0, buf.length, null, function(_err, bytesRead) {
            if (_err) {
              return callback(_err, details);
            }
            var time = jspack.Unpack('>L', buf, 4)[0];
            var pid = jspack.Unpack('<L', buf, 12)[0];
            var paused = buf[16];
            var want = buf[17];
            var term = buf[18];
            var state = buf[19];
            details.name = this.name;
            details.time = jspack.Unpack('>L>L', buf, 0)[1];
            details.pid = (pid !== 0)? pid: -1;
            details.normally = normallyup? "up" : "down";
            details.paused = paused? true: false;
            details.want = {
              'u': "up",
              'd': "down"
            }[want];
            details.term = term? true:false;
            details.state = {
              0: "down",
              1: "run",
              2: "finish"
            }[state];
            return callback(err, details);
          });
        });
      });
    }
  });
};

/**
 * RunitServiceDirectory represents a runit services directory as passed to
 * 'runsvdir'. This is lazily constructed, so the success of this constructor
 * does not necessarily indicate that the directory exists or contains any
 * services.
 *
 * @param {String} dir  The path to the services directory
 */
function RunitServiceDirectory(dir) {
  this.dir = dir;
}

/**
 * Retrieve a service within the service directory by name. This takes a
 * required callback which will receive a possible error and the RunitService
 * object (which may not represent a valid service, see {@link RunitService}).
 *
 * @param {Function} cb A callback taking an error and a {@link RunitService}
 */
RunitServiceDirectory.prototype.get_service = function(name, callback) {
  var self = this;
  fs.stat(path.join(self.dir, name), function(err, stats) {
    if (err) {
      // If this happens, something is very wrong
      log.warn(err);
      return callack(err);
    }
    else {
      return callback(null, new RunitService(self.dir, name));
    }
  });
};

/**
 * Retrieve a list of objects containing details for all valid services in the
 * service directory.
 *
 * @param {Function} cb A callback taking an error a list of retrieved details
 */
RunitServiceDirectory.prototype.list_services_details = function(cb) {
  var self = this;
  var services = [];

  fs.readdir(self.dir, function(err, files) {
    // If the services directory can't be read, just return error now
    if (err) {
      return cb(err);
    }

    async.forEach(files, function(file, callback) {
      self.get_service(file, function(err, service) {
        if (err) {
          return callback(err);
        }
        service.get_details(function(err, details) {
          if (!err) {
            services.push(details);
          }
          return callback(err);
        });
      });
    },
    function(err) {
      cb(err, services);
    });
  });
};


/**
 * Create a RunitService layout with the given name. This is incomplete.
 *
 * @param {Function} cb A callback taking a possible error.
 */
RunitServiceDirectory.prototype.create_service_layout = function(name, cb) {
  var self = this;
  fs.stat(path.join(self.dir, name), function(err, stats) {
    if (!err) {
      cb(new Error("Service name already in use"));
    }
    else {
      misc.template_to_tree(dir, RUNSV_TEMPLATE, cb);
    }
  });
};

exports.RunitServiceDirectory = RunitServiceDirectory;
