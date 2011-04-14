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
var constants = require('constants');

var sprintf = require('sprintf').sprintf;
var async = require('async');
var jspack = require('extern/jspack/jspack').jspack;

var SupervisedService = require('service_management/base').SupervisedService;
var SupervisedServiceManager = require('service_management/base').SupervisedServiceManager;
var Buffer = require('buffer').Buffer;
var log = require('util/log');
var misc = require('util/misc');
var config = require('util/config');
var fsutil = require('util/fs');
var flowctrl = require('util/flow_control');

/* Default config values for the Runit service manager. */
var configDefaults = {
  'service_user': null,
  'svlogd_daemon_user': null,   // @TODO: Change back to syslog when we can retrieve the username
  'log_directory': 'main',      //        for the specified uid (getpwuid?)
  'max_log_size': 10 * 1024 * 1024,
  'max_log_num': 10
};

/**
 * RunitService represents a runit service control directory (as passed to
 * runsv).  These are lazily constructed, so its possible that a RunitService's
 * doesn't corresponding directory doesn't actually exist, and you won't know
 * until you attempt to read the details, etc.
 *
 * @param {String} basedir  The directory in which the service resides.
 * @param {String} name     The name of the service, corresponds to the name of
 *                          the service's control directory.
 * @constructor
 */
function RunitService(pathAvailable, pathEnabled, name) {
  SupervisedService.call(this, pathAvailable, pathEnabled, name);

  this.pathAvailable = path.join(this._basePathAvailable, this.name);
  this.pathEnabled = path.join(this._basePathEnabled, this.name);
}

sys.inherits(RunitService, SupervisedService);

/**
 * Return a path to the service main log file.
 *
 * @return {String} Path to the service log file.
 */
RunitService.prototype.getLogPath = function() {
  return path.join(this.pathAvailable, 'log', 'main', 'current');
};

/**
 * Retrieves the details of a service. Potential errors and the details object
 * are passed to a required callback
 *
 * @param {Function} callback A required callback taking (err, details).
 */
RunitService.prototype.getDetails = function(callback) {
  var self = this;
  var status;
  var details = {};
  var downPath = path.join(this.pathAvailable, 'down');

  path.exists(downPath, function(exists) {
    details.name = self.name;

    self.isEnabled(function(enabled) {
      details.enabled = enabled;

      if (enabled) {
        self._getStatus(function(err, sstatus) {
          status = err ? err : sstatus;
          details = self._formatDetails(self.name, enabled, status);

          callback(null, details);
          return;
        });
      }
      else {
        details = self._formatDetails(self.name, enabled, null);

        callback(null, details);
        return;
      }
    });
  });
};

/**
 * Checks whether a service is enabled by looking for it in the avaiable
 * directory.
 *
 * @param {Function} callback A callback that takes a boolean.
 */
RunitService.prototype.isEnabled = function(callback) {
  path.exists(this.pathEnabled, callback);
};

/**
 * Get status information about a service
 *
 * @param {Function} callback A callback that takes a possible error and
 *                      a status object.
 */
RunitService.prototype._getStatus = function(callback) {
  var sstatus = {};
  var sstatusPath = path.join(this.pathAvailable, 'supervise', 'status');
  fs.open(sstatusPath, 'r', 0644, function(err, fd) {
    if (err) {
      return callback(err, sstatus);
    }
    /**
     * The 'status' file binary format is:
     *   Start time is stored as:
     *     Seconds in a uint64T in indices 0 - 7
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
        return callback(err, sstatus);
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
      return callback(err, sstatus);
    });
  });
};

/**
 * Format the service details.
 *
 * @param {String} name Service name.
 * @param {Boolean} enabled true if the service is enabled, false otherwise.
 * @param {Object} status Object as returned by the _GetStatus method method.
 * @returned {Object} Object with the following keys: name, time, pid, state.
 *                    For more info, see {@link SupervisedService.getDetails}
 */
RunitService.prototype._formatDetails = function(name, enabled, status) {
  var detailsFormatted, state;

  detailsFormatted = {
    'name': name,
    'enabled': enabled
  };

  if (status instanceof Error) {
    detailsFormatted.status = {
      'time': null,
      'pid': -1,
      'state': 'unknown',
      'err': status.message
    };
  }
  else if (status) {
    detailsFormatted.status = {
      'time': status.time,
      'pid': status.pid,
      'state': (status.state === 'down') ? 'down' : 'running'
    };
  }
  else {
    detailsFormatted.status = null;
  }

  return detailsFormatted;
};

/**
 * Pipe characters into the runsv control pipe to control the service. For a
 * list of available control characters and their corresponding signals, see
 * the runsv man page.
 *
 * @param {String} cchar The control character to write to the pipe.
 * @param {Function} callback A callback called with a possible error.
 */
RunitService.prototype._control = function(cchar, callback) {
  var self = this;
  this.isEnabled(function(enabled) {
    if (!enabled) {
      return callback(new Error('Service disabled'));
    }
    var cpath = path.join(self.pathAvailable, 'supervise', 'control');
    // Node's syntax is a little annoying on this, we have to specify a mode
    // in order to provide a callback
    fs.open(cpath, constants.O_WRONLY, 0700, function(err, fd) {
      if (err) {
        return callback(new Error('control file not yet created'));
      }
      var buf = new Buffer(cchar, 'ascii');
      fs.write(fd, buf, 0, buf.length, null, function(err, writen) {
        return callback(err);
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
 * @param {Function} callback A callback called with a possible error.
 */
RunitService.prototype.restart = function(callback) {
  this._control('tcu', callback);
};

/**
 * Start the service and set it to "up".
 *
 * @param {Function} callback A callback called with a possible error.
 */
RunitService.prototype.start = function(callback) {
  this._control('u', callback);
};

/**
 * Stop the service and set it to "down".
 *
 * @param {Function} callback A callback called with a possible error.
 */
RunitService.prototype.stop = function(callback) {
  this._control('d', callback);
};

/**
 * Enable a service by symlinking to it from the enabled directory
 *
 * @param {Function} callback A callback with a possible error.
 */
RunitService.prototype.enable = function(callback) {
  var self = this;
  self.isEnabled(function(enabled) {
    if (!enabled) {
      var target;
      if (self.pathAvailable[0] === '/') {
        target = self.pathAvailable;
      }
      else {
        target = path.join(process.cwd(), self.pathAvailable);
      }
      return fs.symlink(target, self.pathEnabled, callback);
    }
    return callback();
  });
};

/**
 * Disable a service by removing the symlink to it from the enabled directory
 *
 * @param {Function} callback A callback with a possible error.
 */
RunitService.prototype.disable = function(callback) {
  var self = this;
  self.isEnabled(function(enabled) {
    if (enabled) {
      return fs.unlink(self.pathEnabled, callback);
    }
    return callback();
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
    fsutil.rmtree(self.pathAvailable, callback);
  });
};

/**
 * RunitServiceManager represents a runit services directory as passed to
 * 'runsvdir'. This is lazily constructed, so the success of this constructor
 * does not necessarily indicate that the directory exists or contains any
 * services.
 *
 * @param {String} pathAvailable The directory in which the available services reside.
 * @param {String} pathEnabled The directory in which the enabled services reside.
 */
function RunitServiceManager(pathAvailable, pathEnabled) {
  SupervisedServiceManager.call(this, pathAvailable, pathEnabled);
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
RunitServiceManager.prototype.getService = function(name, callback) {
  var self = this;
  fs.stat(path.join(self.pathAvailable, name), function(err, stats) {
    if (err) {
      callback(err);
      return;
    }
    else {
      callback(null, new RunitService(self.pathAvailable, self.pathEnabled, name));
      return;
    }
  });
};

/**
 * Retrieve a list of objects containing details for all valid services in the
 * service directory.
 *
 * @param {Function} callback A callback taking an error a list of retrieved details.
 */
RunitServiceManager.prototype.listServicesDetails = function(callback) {
  var self = this;
  var services = [];

  fs.readdir(self.pathAvailable, function(err, files) {
    // If the services directory can't be read, just return error now
    if (err) {
      callback(err);
      return;
    }

    async.forEach(files, function(file, callback) {
      self.getService(file, function(err, service) {
        if (err) {
          callback(err);
          return;
        }

        service.getDetails(function(err, details) {
          if (!err) {
            services.push(details);
          }
          callback(err);
          return;
        });

      });
    },
    function(err) {
      callback(err, services);
      return;
    });
  });
};

RunitServiceManager.prototype.getServiceTemplate = function(templateArgs, callback) {
  var templates = require('service_management/runit/templates/base');

  templates.getApplicationTemplate(templateArgs, function(error, template) {
    callback(error, template);
  });
};

/**
 * Create a RunitService layout with the given name. This is incomplete.
 *
 * @param {String} serviceName Service names.
 * @param {Object} serviceTemplate Service template object (see runit/templates/base.js for example).
 * @param {Function} callback A callback taking a possible error.
 */
RunitServiceManager.prototype.createService = function(serviceName, serviceTemplate, callback) {
  var svcpath = path.join(this.pathAvailable, serviceName);

  fs.stat(svcpath, function(err, stats) {
    if (!err) {
      callback(new Error('Service name already in use'));
      return;
    }
    else {
      fsutil.templateToTree(svcpath, serviceTemplate, true, callback);
    }
  });
};

/*
 * Return a new RunitServiceManager object.
 *
 * @param {String} pathAvailable The directory in which the available services reside.
 * @param {String} pathEnabled The directory in which the enabled services reside.
 *
 * @return {RunitServiceManager}
 */
function getManager(pathAvailable, pathEnabled) {
  var _pathAvailable = pathAvailable || path.join(config.get()['service_dir_available']);
  var _pathEnabled = pathEnabled || path.join(config.get()['service_dir_enabled']);

  return new RunitServiceManager(_pathAvailable, _pathEnabled);
}

exports.configDefaults = configDefaults;
exports.getManager = getManager;
exports.RunitService = RunitService;
exports.RunitServiceManager = RunitServiceManager;
