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
var jspack = require('../extern/jspack/jspack').jspack;

function getServiceList(dir, callback) {
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
          readServiceControl(path.join(dir, file), function (err, obj) {
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

function createRunsvLayout(dir, owner, group) {
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


function readServiceControl(dir, callback) {
  var obj = {},
      err, 
      ctrl_path = path.join(dir, "supervise", "status"),
      down_path = path.join(dir, "supervise", "down");
  path.exists(ctrl_path, function (exists) {
    if (!exists) {
      err = "Couldn't find supervise/status file";
      if (callback) {
        callback(err, obj);
      }
    } else {
      fs.open(ctrl_path, "r", 0644, function (_err, fd) {
        if (_err) {
          if (callback) {
            callback(_err, obj);
          }
          return;
        }
        fs.stat(down_path, function (_err, stats) {
          var normallyup;
          if (_err) {
            normallyup = false;
          } else {
            normallyup = true;

          }
          var buf = new Buffer(1024);
          fs.read(fd, buf, 0, buf.length, null, function(_err, bytesRead) {
            if (_err) {
              if (callback) {
                callback(_err, obj);
              }
              return;
            }
            var pid = jspack.Unpack('<L', buf, 12)[0], 
                paused = buf[16], st,
                want = buf[17];
            if (pid && !normallyup) {
              obj["normally"] = "down";
            }
            if (!pid && normallyup) {
              obj["normally"] = "up";
            }
            if (pid && paused) {
              obj["paused"] = true;
            }
            if (!pid && (want == "u")) {
              obj["want"] = "up";
            }
            if (pid && (want == "d")) {
              obj["want"] = "down";
            }

            obj["pid"] = pid;
            obj["time"] = jspack.Unpack('>L>L', buf, 0)[1];
            if (callback) {
              callback(err, obj);
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

exports.getServiceList = getServiceList;
exports.createRunsvLayout = createRunsvLayout;
