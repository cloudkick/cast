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
var Errorf = misc.Errorf;

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
 * Retrieves the status of a service. Status is null if service is disabled.
 * @param {Function} callback A callback fired with (err, status).
 */
RunitService.prototype.getStatus = function(callback) {
  var self = this;

  self.isEnabled(function(enabled) {
    if (enabled) {
      self._readStatus(function(err, sstatus) {
        if (err) {
          callback(err);
        } else {
          callback(null, self._formatStatus(sstatus));
        }
      });
    } else {
      callback(null, null);
    }
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
 * Read the services status information.
 * @param {Function} callback A callback fired with (err, status).
 */
RunitService.prototype._readStatus = function(callback) {
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
 * @return {Object} A status object, see {@link SupervisedService.getStatus}
 */
RunitService.prototype._formatStatus = function(status) {
  return {
    'time': status.time,
    'pid': status.pid,
    'state': (status.state === 'down') ? 'down' : 'running'
  };
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
 * Send the service a kill signal.
 *
 * @param {Function} callback A callback fired with (err).
 */
RunitService.prototype.kill = function(callback) {
  this._control('k', callback);
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

      // Remove "down" file
      flowctrl.callIgnoringError(fs.unlink, null,
                                 path.join(self.pathAvailable, 'down'),
                                 async.apply(fs.symlink, target,
                                             self.pathEnabled, callback));
      return;
    }

    callback();
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
      var templateObject = {
        down: '# Down file so it doesn\'t start up automagically'
      };

      // Create a "down" file
      flowctrl.callIgnoringError(fsutil.templateToTree, null,
                                 self.pathAvailable, templateObject, true,
                                 async.apply(fs.unlink, self.pathEnabled,
                                             callback));
    } else {
      callback();
    }
  });
};

/**
 * Attempt to stop a service, first with a TERM then with a KILL. Wait up to
 * 7 seconds (the time used by 'sv' for this purpose) for either to take
 * effect (it may take runsv several seconds to even pick this up). Finally
 * proceed to remove the symlink then the service template.
 *
 * @param {Function} callback A callback with a possible error.
 */
RunitService.prototype.destroy = function(callback) {
  var self = this;

  // Disable and remove the service
  function cleanUp() {
    self.disable(function(err) {
      if (err) {
        callback(err);
        return;
      }
      fsutil.rmtree(self.pathAvailable, callback);
    });
  }

  function attemptKill() {
    self.kill(function(err) {
      // An error means the service isn't started.
      if (err) {
        cleanUp();
        return;
      }
      self._waitForDown(500, 7000, function(err, isDown) {
        // Clean up one way or another.
        cleanUp();
      });
    });
  }

  function attemptTerm() {
    self.stop(function(err) {
      // An error means the service isn't started.
      if (err) {
        cleanUp();
        return;
      }
      self._waitForDown(500, 7000, function(err, isDown) {
        if (isDown) {
          cleanUp();
          return;
        }
        attemptKill();
      });
    });
  }

  attemptTerm();
};


/**
 * Wait for a service to be in a non-running state. This is a horrible polling
 * based solution.
 *
 * @param {Number} interval Interval in ms on which to poll.
 * @param {Number} timeout  Time in ms to wait.
 * @param {Function} callback A callback fired with (err, isDown).
 */
RunitService.prototype._waitForDown = function(interval, timeout, callback) {
  var self = this;
  var timeSpent = 0;

  function doCheck() {
    self._readStatus(function(err, sstatus) {
      if (err || sstatus.state === 'down') {
        // The service is down
        callback(null, true);
      } else if (timeSpent >= timeout) {
        // We're out of time
        callback(null, false);
      } else {
        // Still running, try again
        setTimeout(doCheck, interval);
        timeSpent += interval;
      }
    });
  }

  doCheck();
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
 * Helper function which given the service name and action retrieves the
 * service object and calls the provided action function on it.
 *
 * @param {String} serviceName Service name.
 * @param {String} action Which action to run on the obtained service object.
 * @param {Function} callback A callback called with (err, ..)
 */
RunitServiceManager.prototype.runAction = function(serviceName, action, callback) {
  var validActions = ['isEnabled', 'start', 'stop', 'restart',
                      'enable', 'disable', 'destroy'];

  if (!misc.inArray(action, validActions)) {
    callback(new Errorf('Invalid action: %s', action));
    return;
  }

  this.getService(serviceName, function(err, service) {
    if (err) {
      callback(err);
      return;
    }

    service[action](callback);
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
