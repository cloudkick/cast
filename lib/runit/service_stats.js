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

var log = require('util/log');
var fs = require('fs');
var path = require('path');
var Buffer = require('buffer').Buffer;
var jspack = require('extern/jspack/jspack').jspack;

var TEMPLATE = {
  "run": "#!/bin/bash\n# Stub run file\nexit 0",
  "finish": "#!/bin/bash\n# Stubbed out finish file\nexit 0;",
  "down": "# Down file so it doesn't start up automagically"
};

var LOG_TEMPLATE = {
  "run": "echo",
  "finish": "echo 'finish'"
};

function RunitService(basedir, name) {
  this.basedir = basedir;
  this.name = name;
}

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
RunitService.prototype.get_details = function(callback) {
  var details = {};
  var err;
  var dir = path.join(this.basedir, this.name);
  var ctrl_path = path.join(dir, "supervise", "status");
  var down_path = path.join(dir, "supervise", "down");
  path.exists(ctrl_path, function(exists) {
    if (!exists) {
      err = "Couldn't find supervise/status file";
      if (callback) {
        callback(err, details);
      }
    } else {
      fs.open(ctrl_path, "r", 0644, function(_err, fd) {
        if (_err) {
          if (callback) {
            callback(_err, details);
          }
          return;
        }
        path.exists(down_path, function(exists) {
          var normallyup = (!exists);
          var buf = new Buffer(1024);
          fs.read(fd, buf, 0, buf.length, null, function(_err, bytesRead) {
            if (_err) {
              if (callback) {
                callback(_err, details);
              }
              return;
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
            if (callback) {
              callback(err, details);
            }
          });
        });
      });
    }
  });
};

function RunitServiceDirectory(dir) {
  this.dir = dir;
}

RunitServiceDirectory.prototype.get_service = function(name, callback) {
  var self = this;
  fs.stat(path.join(self.dir, name), function(err, stats) {
    if (err) {
      // If this happens, something is very wrong
      log.warn(err);
      callack(err);
    }
    var service = new RunitService(self.dir, name);
    service.get_details(function(err, details) {
      if (err) {
        callback(err);
      }
      else {
        callback(err, details);
      }
    });
  });
};

RunitServiceDirectory.prototype.list_services_details = function(callback) {
  var self = this;
  var services = [];
  // For every directory in the service directory, if its a service control
  // directory then add it to the services list
  fs.readdir(this.dir, function(err, files) {
    if (err) {
      callback(err);
    }
    var processedCount = 0;
    files.forEach(function(file) {
      self.get_service(file, function(err, service) {
        if (!err) {
          services.push(service);
        }
        processedCount++;
        if (processedCount == files.length) {
          callback(undefined, services);
        }
      });
    });
  });
};


function create_runsv_layout(dir, owner, group) {
  // TODO: This function pretends to be synchronous, but really isn't
  var utils = ["run", "finish"];
  path.exists(dir, function(exists) {
    if (!exists) {
      fs.mkdirSync(dir, 0700);
    }
    // Bootstrap the run file
    for (var i = 0; i < util.length; i++) {
      var cfile = utils[i];
      var ppath = path.join(dir, cfile);
      path.exists(ppath, function(exists) {
        return function() {
          if (!exists) {
            console.log("Creating file, " + ppath);
            fs.open(ppath, "w", 0700, function(err, fd) {
              if (err) {
                throw err;
              }
              fs.write(fd, TEMPLATE[cfile]);
            });
          }
        };
      }());
    }
    var log_dir = path.join(dir, "log");
    path.exists(log_dir, function(exists) {
      if (!exists) {
        fs.mkdirSync(log_dir, 0700);
      }
      for (var i = 0; i < utils.length; i++) {
        var cfile = utils[i];
        var ppath = path.join(log_dir, cfile);
        path.exists(ppath, function(exists) {
          return function() {
            if (!exists) {
              console.log("Creating file, " + ppath);
              fs.open(ppath, "w", 0700, function(err, fd) {
                if (err) {
                  throw err;
                }
                fs.write(fd, TEMPLATE[cfile]);
              });
            }
          };
        }());
      }
    });
  });
}

exports.RunitServiceDirectory = RunitServiceDirectory;
exports.create_runsv_layout = create_runsv_layout;
