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
var misc = require('util/misc');
var config = require('util/config');
var sprintf = require('extern/sprintf').sprintf;
var async = require('extern/async');
var jspack = require('extern/jspack/jspack').jspack;


/**
 * RunitService represents a runit service control directory (as passed to
 * runsv).  These are lazily constructed, so its possible that a RunitService's
 * doesn't corresponding directory doesn't actually exist, and you won't know
 * until you attempt to read the details, etc.
 *
 * @param {String} basedir  The directory in which the service resides.
 * @param {String} name     The name of the service, corresponds to the name of
 *                            the service's control directory.
 */
function RunitService(basedir, name) {
  this.availpath = path.join(basedir, 'available', name);
  this.enablepath = path.join(basedir, 'enabled', name);
  this.name = name;
}



/**
 * Retrieves the details of a service. Potential errors and the details object
 * are passed to a required callback
 *
 * @param {Function} cb A required callback taking (err, details).
 */
RunitService.prototype.get_details = function(cb) {
  var self = this;
  var details = {};
  var down_path = path.join(this.availpath, 'down');
  path.exists(down_path, function(exists) {
    details.name = self.name;
    details.normally = exists ? 'down' : 'up';
    self.is_enabled(function(enabled) {
      details.enabled = enabled;
      if (enabled) {
        self.get_status(function(err, sstatus) {
          // If we were unable to retrieve the status, set the status to false
          details.status = err ? false : sstatus;
          return cb(null, details);
        });
      }
      else {
        return cb(null, details);
      }
    });
  });
};


/**
 * Checks whether a service is enabled by looking for it in the avaiable
 * directory.
 *
 * @param {Function} cb A callback that takes a boolean.
 */
RunitService.prototype.is_enabled = function(cb) {
  path.exists(this.enablepath, cb);
};


/**
 * Get status information about a service
 *
 * @param {Function} cb A callback that takes a possible error and
 *                            a status object.
 */
RunitService.prototype.get_status = function(cb) {
  var sstatus = {};
  var sstatus_path = path.join(this.availpath, 'supervise', 'status');
  fs.open(sstatus_path, 'r', 0644, function(err, fd) {
    if (err) {
      return cb(err, sstatus);
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
    var buf = new Buffer(20);
    fs.read(fd, buf, 0, buf.length, null, function(err, bytesRead) {
      if (err) {
        return cb(err, sstatus);
      }
      var time = jspack.Unpack('>L', buf, 4)[0];
      var pid = jspack.Unpack('<L', buf, 12)[0];
      var paused = buf[16];
      var want = buf[17];
      var term = buf[18];
      var state = buf[19];
      sstatus.time = jspack.Unpack('>L>L', buf, 0)[1];
      sstatus.pid = (pid !== 0) ? pid : -1;
      sstatus.paused = paused ? true : false;
      sstatus.want = {
        'u': 'up',
        'd': 'down'
      }[want];
      sstatus.term = term ? true : false;
      sstatus.state = {
        0: 'down',
        1: 'run',
        2: 'finish'
      }[state];
      return cb(err, sstatus);
    });
  });
};


/**
 * Pipe characters into the runsv control pipe to control the service. For a
 * list of available control characters and their corresponding signals, see
 * the runsv man page.
 *
 * @param {String} cchar The control character to write to the pipe.
 * @param {Function} cb A callback called with a possible error.
 */
RunitService.prototype.control = function(cchar, cb) {
  var self = this;
  this.is_enabled(function(enabled) {
    if (!enabled) {
      return cb(new Error('Service disabled'));
    }
    var cpath = path.join(self.availpath, 'supervise', 'control');
    // Node's syntax is a little annoying on this, we have to specify a mode
    // in order to provide a callback
    fs.open(cpath, process.O_WRONLY, 0700, function(err, fd) {
      if (err) {
        return cb(new Error('Control file not yet created'));
      }
      var buf = new Buffer(cchar, 'ascii');
      fs.write(fd, buf, 0, buf.length, null, function(err, writen) {
        return cb(err);
      });
    });
  });
};


/**
 * Restart the service. The callback fires when the control characters have
 * been written, without regard to what actually happens to the service. This
 * sends a TERM followed by a CONT, then has runsv start the service and set it
 * to up.
 *
 * @param {Function} cb A callback called with a possible error.
 */
RunitService.prototype.restart = function(cb) {
  this.control('tcu', cb);
};


/**
 * Start the service and set it to "up".
 *
 * @param {Function} cb A callback called with a possible error.
 */
RunitService.prototype.start = function(cb) {
  this.control('u', cb);
};


/**
 * Stop the service and set it to "down".
 *
 * @param {Function} cb A callback called with a possible error.
 */
RunitService.prototype.stop = function(cb) {
  this.control('d', cb);
};


/**
 * Enable a service by symlinking to it from the enabled directory
 *
 * @param {Function} cb A callback with a possible error.
 */
RunitService.prototype.enable = function(cb) {
  var self = this;
  self.is_enabled(function(enabled) {
    if (!enabled) {
      var target;
      if (self.availpath[0] === '/') {
        target = self.availpath;
      }
      else {
        target = path.join(process.cwd(), self.availpath);
      }
      return fs.symlink(target, self.enablepath, cb);
    }
    return cb();
  });
};


/**
 * Disable a service by removing the symlink to it from the enabled directory
 *
 * @param {Function} cb A callback with a possible error.
 */
RunitService.prototype.disable = function(cb) {
  var self = this;
  self.is_enabled(function(enabled) {
    if (enabled) {
      return fs.unlink(self.enablepath, cb);
    }
    return cb();
  });
};


/**
 * RunitServiceDirectory represents a runit services directory as passed to
 * 'runsvdir'. This is lazily constructed, so the success of this constructor
 * does not necessarily indicate that the directory exists or contains any
 * services.
 *
 * @param {String} dir  The path to the services directory.
 */
function RunitServiceDirectory(dir) {
  this.dir = dir;
  this.availdir = path.join(dir, 'available');
  this.enabldir = path.join(dir, 'enabled');
}


/**
 * Retrieve a service within the service directory by name. This takes a
 * required callback which will receive a possible error and the RunitService
 * object (which may not represent a valid service, see {@link RunitService}).
 *
 * @param {Function} cb A callback taking an error and a {@link RunitService}.
 */
RunitServiceDirectory.prototype.get_service = function(name, cb) {
  var self = this;
  fs.stat(path.join(self.availdir, name), function(err, stats) {
    if (err) {
      return cb(err);
    }
    else {
      return cb(null, new RunitService(self.dir, name));
    }
  });
};


/**
 * Retrieve a list of objects containing details for all valid services in the
 * service directory.
 *
 * @param {Function} cb A callback taking an error a list of retrieved details.
 */
RunitServiceDirectory.prototype.list_services_details = function(cb) {
  var self = this;
  var services = [];

  fs.readdir(self.availdir, function(err, files) {
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
      return cb(err, services);
    });
  });
};


/**
 * Create a RunitService layout with the given name. This is incomplete.
 *
 * @param {String} service_name Service names.
 * @param [Object] Service template object (see runit/templates/base.js for example).
 * @param {Function} cb A callback taking a possible error.
 */
RunitServiceDirectory.prototype.create_service_layout = function(service_name, service_template, cb) {
  var svcpath = path.join(this.availdir, service_name);

  fs.stat(svcpath, function(err, stats) {
    if (!err) {
      return cb(new Error('Service name already in use'));
    }
    else {
      misc.template_to_tree(svcpath, service_template, true, cb);
    }
  });
};

/*
 * Return a new runit service directory object.
 *
 * @param {String} base_dir Base services directory
 * @return {RunitServiceDirectory}
 */
var get_service_dir = function(base_dir) {
  var _base_dir = base_dir || path.join(config.get().data_root, config.get().service_dir);

  return new RunitServiceDirectory(_base_dir);
};

exports.RunitServiceDirectory = RunitServiceDirectory;
exports.get_service_dir = get_service_dir;
