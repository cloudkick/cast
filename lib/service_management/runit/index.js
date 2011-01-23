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
var sys = require('sys');
var path = require('path');
var SupervisedService = require('service_management/base').SupervisedService;
var SupervisedServiceManager = require('service_management/base').SupervisedServiceManager;
var Buffer = require('buffer').Buffer;
var log = require('util/log');
var misc = require('util/misc');
var config = require('util/config');
var fsutil = require('util/fs');
var flowctrl = require('util/flow_control');
var constants = require('util/constants');
var sprintf = require('extern/sprintf').sprintf;
var async = require('extern/async');
var jspack = require('extern/jspack/jspack').jspack;

/* Default config values for the Runit service manager. */
var config_defaults = {
  'service_user': null,
  'svlogd_daemon_user': null,   // @TODO: Change back to syslog when we can retrieve the username
  'log_directory': 'main',      //        for the specified uid (getpwuid?)
  'max_log_size': 10 * 1024 * 1024,
  'max_log_num': 10
};

/**
 * RunitService represents a runit service _control directory (as passed to
 * runsv).  These are lazily constructed, so its possible that a RunitService's
 * doesn't corresponding directory doesn't actually exist, and you won't know
 * until you attempt to read the details, etc.
 *
 * @param {String} basedir  The directory in which the service resides.
 * @param {String} name     The name of the service, corresponds to the name of
 *                          the service's _control directory.
 * @this
 */
function RunitService(path_available, path_enabled, name) {
  SupervisedService.call(this, path_available, path_enabled, name);

  this.path_available = path.join(this._base_path_available, this.name);
  this.path_enabled = path.join(this._base_path_enabled, this.name);
}

sys.inherits(RunitService, SupervisedService);

/**
 * Return a path to the service main log file.
 *
 * @return {String} Path to the service log file.
 */
RunitService.prototype.get_log_path = function() {
  return path.join(this.path_available, 'log', 'main', 'current');
};

/**
 * Retrieves the details of a service. Potential errors and the details object
 * are passed to a required callback
 *
 * @param {Function} cb A required callback taking (err, details).
 */
RunitService.prototype.get_details = function(cb) {
  var self = this;
  var status;
  var details = {};
  var down_path = path.join(this.path_available, 'down');

  path.exists(down_path, function(exists) {
    details.name = self.name;

    self.is_enabled(function(enabled) {
      details.enabled = enabled;

      if (enabled) {
        self._get_status(function(err, sstatus) {
          // If we were unable to retrieve the status, set the status to false
          status = err ? false : sstatus;
          details = self._format_details(self.name, enabled, status);

          cb(null, details);
          return;
        });
      }
      else {
        details = self._format_details(self.name, enabled, null);

        cb(null, details);
        return;
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
  path.exists(this.path_enabled, cb);
};

/**
 * Get status information about a service
 *
 * @param {Function} cb A callback that takes a possible error and
 *                      a status object.
 */
RunitService.prototype._get_status = function(cb) {
  var sstatus = {};
  var sstatus_path = path.join(this.path_available, 'supervise', 'status');
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
 * Format the service details.
 *
 * @param {String} name Service name.
 * @param {Boolean} enabled true if the service is enabled, false otherwise.
 * @param {Object} status Object as returned by the _get_status method method.
 * @returned {Object} Object with the following keys: name, time, pid, state.
 *                    For more info, see {@link SupervisedService.get_details}
 */
RunitService.prototype._format_details = function(name, enabled, status) {
  var details_formatted, state;

  details_formatted = {
    'name': name,
    'enabled': enabled
  };

  if (status) {
    details_formatted.status = {
      'time': status.time,
      'pid': status.pid,
      'state': (status.state === 'up') ? 'running' : 'down'
    };
  }
  else {
    details_formatted.status = false;
  }

  return details_formatted;
};

/**
 * Pipe characters into the runsv control pipe to control the service. For a
 * list of available control characters and their corresponding signals, see
 * the runsv man page.
 *
 * @param {String} cchar The control character to write to the pipe.
 * @param {Function} cb A callback called with a possible error.
 */
RunitService.prototype._control = function(cchar, cb) {
  var self = this;
  this.is_enabled(function(enabled) {
    if (!enabled) {
      return cb(new Error('Service disabled'));
    }
    var cpath = path.join(self.path_available, 'supervise', '_control');
    // Node's syntax is a little annoying on this, we have to specify a mode
    // in order to provide a callback
    fs.open(cpath, constants.O_WRONLY, 0700, function(err, fd) {
      if (err) {
        return cb(new Error('control file not yet created'));
      }
      var buf = new Buffer(cchar, 'ascii');
      fs.write(fd, buf, 0, buf.length, null, function(err, writen) {
        return cb(err);
      });
    });
  });
};

/**
 * Restart the service. The callback fires when the _control characters have
 * been written, without regard to what actually happens to the service. This
 * sends a TERM followed by a CONT, then has runsv start the service and set it
 * to up.
 *
 * @param {Function} cb A callback called with a possible error.
 */
RunitService.prototype.restart = function(cb) {
  this._control('tcu', cb);
};

/**
 * Start the service and set it to "up".
 *
 * @param {Function} cb A callback called with a possible error.
 */
RunitService.prototype.start = function(cb) {
  this._control('u', cb);
};

/**
 * Stop the service and set it to "down".
 *
 * @param {Function} cb A callback called with a possible error.
 */
RunitService.prototype.stop = function(cb) {
  this._control('d', cb);
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
      if (self.path_available[0] === '/') {
        target = self.path_available;
      }
      else {
        target = path.join(process.cwd(), self.path_available);
      }
      return fs.symlink(target, self.path_enabled, cb);
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
      return fs.unlink(self.path_enabled, cb);
    }
    return cb();
  });
};

/**
 * Disable a service (remove a symlink) and delete the service directory.
 *
 * @param {Function} callback A callback with a possible error.
 */
RunitService.prototype.destroy = function(callback) {
  var self = this;

  this.disable(function(err) {
    fsutil.rmtree(self.path_available, callback);
  });
};

/**
 * RunitServiceManager represents a runit services directory as passed to
 * 'runsvdir'. This is lazily constructed, so the success of this constructor
 * does not necessarily indicate that the directory exists or contains any
 * services.
 *
 * @param {String} path_available The directory in which the available services reside.
 * @param {String} path_enabled The directory in which the enabled services reside.
 */
function RunitServiceManager(path_available, path_enabled) {
  SupervisedServiceManager.call(this, path_available, path_enabled);
}

sys.inherits(RunitServiceManager, SupervisedServiceManager);

/**
 * Retrieve a service within the service directory by name. This takes a
 * required callback which will receive a possible error and the RunitService
 * object (which may not represent a valid service, see {@link RunitService}).
 *
 * @param {String} name Name of the service.
 * @param {Function} callback A callback taking an error and a {@link RunitService}.
 */
RunitServiceManager.prototype.get_service = function(name, callback) {
  var self = this;
  fs.stat(path.join(self.path_available, name), function(err, stats) {
    if (err) {
      return callback(err);
    }
    else {
      return callback(null, new RunitService(self.path_available, self.path_enabled, name));
    }
  });
};

/**
 * Retrieve a list of objects containing details for all valid services in the
 * service directory.
 *
 * @param {Function} cb A callback taking an error a list of retrieved details.
 */
RunitServiceManager.prototype.list_services_details = function(cb) {
  var self = this;
  var services = [];

  fs.readdir(self.path_available, function(err, files) {
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

RunitServiceManager.prototype.get_service_template = function(service_name, service_path, entry_file, application_type,
                                                              callback) {
  var templates = require('service_management/runit/templates/base');

  templates.get_application_template(service_name, service_path, entry_file, application_type,
                                     function(error, template) {
    if (error) {
      callback(error);
      return;
    }

    callback(null, template);
  });
};

/**
 * Create a RunitService layout with the given name. This is incomplete.
 *
 * @param {String} service_name Service names.
 * @param {Object} service_template Service template object (see runit/templates/base.js for example).
 * @param {Function} callback A callback taking a possible error.
 */
RunitServiceManager.prototype.create_service = function(service_name, service_template, callback) {
  var svcpath = path.join(this.path_available, service_name);

  fs.stat(svcpath, function(err, stats) {
    if (!err) {
      return callback(new Error('Service name already in use'));
    }
    else {
      misc.template_to_tree(svcpath, service_template, true, callback);
    }
  });
};

/*
 * Return a new RunitServiceManager object.
 *
 * @param {String} path_available The directory in which the available services reside.
 * @param {String} path_enabled The directory in which the enabled services reside.
 *
 * @return {RunitServiceManager}
 */
var get_manager = function(path_available, path_enabled) {
  var _path_available = path_available || path.join(config.get().service_dir_available);
  var _path_enabled = path_enabled || path.join(config.get().service_dir_enabled);

  return new RunitServiceManager(_path_available, _path_enabled);
};

exports.config_defaults = config_defaults;
exports.get_manager = get_manager;
exports.RunitService = RunitService;
exports.RunitServiceManager = RunitServiceManager;
