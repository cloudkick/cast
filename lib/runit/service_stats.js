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

function get_service_list(dir, callback) {
  var services = [];
  // For every directory in the service directory, if its a service control
  // directory then add it to the services list
  fs.readdir(dir, function (err, files) {
    if (err) callback(err);
    var processedCount = 0;
    files.forEach(function (file) {
      fs.stat(path.join(dir, file), function (err, stats) {
        if (err) {
          log.warn(err);
          processedCount++;
          if (processedCount == files.length) callback(undefined, services);
        }
        // Ignore errors - these aren't services
        else if (stats.isDirectory()) {
          read_service_control(dir, file, function (err, obj) {
            if (err) log.debug(file + ': ' + err);
            else services.push(obj);
            processedCount++;
            if (processedCount == files.length) callback(undefined, services);
          });
        } else {
          processedCount++;
          if (processedCount == files.length) callback(undefined, services);
        }
      });
    });
  });
};

function create_runsv_layout(dir, owner, group) {
  var utils = ["run", "finish"];
  path.exists(dir, function (exists) {
    !exists && fs.mkdirSync(dir, 0700);
    // Bootstrap the run file
    for (i in utils) {
      var cfile = utils[i],
          ppath = path.join(dir, cfile);
      path.exists(ppath, (function (ppath) {
        var func = function (exists) {
          console.log("Creating file, " + ppath);
          !exists && fs.open(ppath, "w", 0700, function (err, fd) {
            if (err) throw err;
            fs.write(fd, TEMPLATE[cfile]);
          });
        };
        return func;
      })(ppath));
    }
    var log_dir = path.join(dir,"log");
    path.exists(log_dir, function (exists) {
      !exists && fs.mkdirSync(log_dir, 0700);
      for (i in utils) {
        var cfile = utils[i],
            ppath = path.join(log_dir, cfile);
        console.log("Creating file, " + ppath);
        path.exists(ppath, (function (ppath) {
          var func = function (exists) {
            !exists && fs.open(ppath, "w", 0700, function (err, fd) {
              if (err) throw err;
              fs.write(fd, LOG_TEMPLATE[cfile]);
            });
          };
          return func;
        })(ppath));
      };
    });
  });
};

function read_service_control(basedir, servicename, callback) {
  var service = {};
  var err;
  var dir = path.join(basedir, servicename);
  var ctrl_path = path.join(dir, "supervise", "status");
  var down_path = path.join(dir, "supervise", "down");
  path.exists(ctrl_path, function (exists) {
    if (!exists) {
      err = "Couldn't find supervise/status file";
      if (callback) {
        callback(err, service);
      }
    } else {
      fs.open(ctrl_path, "r", 0644, function (_err, fd) {
        if (_err) {
          if (callback) {
            callback(_err, service);
          }
          return;
        }
        path.exists(down_path, function (exists) {
          var normallyup = (!exists);
          var buf = new Buffer(1024);
          fs.read(fd, buf, 0, buf.length, null, function(_err, bytesRead) {
            if (_err) {
              if (callback) {
                callback(_err, service);
              }
              return;
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
            var time = jspack.Unpack('>L', buf, 4)[0]
            var pid = jspack.Unpack('<L', buf, 12)[0];
            var paused = buf[16];
            var want = buf[17];
            var term = buf[18];
            var state = buf[19];
            service["name"] = servicename;
            service["time"] = jspack.Unpack('>L>L', buf, 0)[1];
            service["pid"] = (pid != 0)? pid: -1;
            service["normally"] = normallyup? "up" : "down";
            service["paused"] = paused? true: false;
            service["want"] = {
              'u': "up",
              'd': "down",
            }[want];
            service["term"] = term? true:false;
            service["state"] = {
              0: "down",
              1: "run",
              2: "finish",
            }[state];
            if (callback) {
              callback(err, service);
            }
          });
        });
      })
    }
  });
};

var TEMPLATE = {
  "run": "#!/bin/bash\n# Stub run file\nexit 0",
  "finish": "#!/bin/bash\n# Stubbed out finish file\nexit 0;",
  "down": "# Down file so it doesn't start up automagically"
};

var LOG_TEMPLATE = {
  "run": "echo",
  "finish": "echo 'finish'"
};

var obj = {
  "": "",
  "health_checks": [
    {"type": "socket", 
     "details":{ 
       "port": 11211,
       "host": "localhost"
     }},
     {"type": "file_exists",
     "details": {
      "path": "test/exists"
     }}
  ]
};

exports.get_service_list = get_service_list;
exports.create_runsv_layout = create_runsv_layout;
