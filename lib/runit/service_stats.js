var http = require('http');
var url = require('url');
var fs = require('fs');
var path = require('path');
var Buffer = require('buffer').Buffer;
var jspack = require('./extern/jspack/jspack').jspack;
var hc = require('./health/check');

var DIR = "/w/testing";
var cntr = 0;
var hd;

http.createServer(function (request, response) {
  var path = url.parse(request.url).pathname;
  if (path == "/create") {
    createRunsvLayout("/w/testing", "daemon", "daemon");
    response.end('Hello World\n');
  }
  if (path == "/status") {
    readServiceControl(DIR, function(err, data) {
      if (err) throw err;
      var str = JSON.stringify(data);
      response.end(str);
      cntr += 1;
      console.log("Status message received " + cntr + " times");
    });
  }
  if (path == "/status/app") {
    var st = [],
        result = []
    for (k in hd) {
     hd[k].runCheck(function (item) {
       result.push(item);
       // Simulating a deferred list.  As each event comes in check if it is
       // the total # of events equals the amount that came in.  If so fire the event.
       if (hd.length == result.length) {
         for (k in hd) {
           st.push(hd[k].lastStatus());
         }
         response.writeHead(200, {'Content-Type': 'text/plain'});
         response.end(JSON.stringify({"statuses": st}));
       }
     });
    }
  }
  response.writeHead(200, {'Content-Type': 'text/plain'});
}).listen(8124);

console.log('Server running at http://127.0.0.1:8124/');


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

hc.loadHealthCheck(obj, function (err, data) {
  hd = data; 
});
