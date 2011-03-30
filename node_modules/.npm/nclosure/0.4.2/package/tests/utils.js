
goog.require('nclosure.core');
goog.require('goog.array');

goog.provide('nclosure.tests.utils');



nclosure.tests.utils.fs_ = require('fs');
nclosure.tests.utils.path_ = require('path');
nclosure.tests.utils.child_process_ = require('child_process');

/**
 * @param {string} dir The directory to read all files for
 * @param {string|RegExp=} filter An optional regex filter that the full file
 *    name must match
 * @return {Array.<string>} A list of all files in the specified directory
 *    (recursive) that optionally match the specified filter regex.
 */
nclosure.tests.utils.readDirRecursiveSync = function(dir, filter) {
  var files = [];
  nclosure.tests.utils.readDirRecursiveSyncImpl_(dir, files);
  if (filter) {
    filter = typeof(filter) === 'string' ? new RegExp(filter) : filter;
    files = goog.array.filter(files, function(f) {
      return f.match(filter);
    });
  }
  return files;
};

/**
 * @private
 */
nclosure.tests.utils.readDirRecursiveSyncImpl_ = function(dir, allFiles) {
  var files = nclosure.tests.utils.fs_.readdirSync(dir);
  goog.array.forEach(files, function(f) {
    var path = nclosure.core.instance.getPath(dir, f);
    if (nclosure.tests.utils.fs_.statSync(path).isDirectory()) {
      return nclosure.tests.utils.readDirRecursiveSyncImpl_(path, allFiles);
    } {
      allFiles.push(path);
    }
  });
};

/**
 * Removes a specified directory and all its contents.
 */
nclosure.tests.utils.rmRfDir = function (dir, callback) {
  nclosure.tests.utils.child_process_.exec('rm -rf ' + dir, callback);
};

/**
 * @param {Array.<string>} execCommands Commands to execute
 * @param {function(string, Error, string, string):undefined} callback
 *    The callback to call when the exec command completes this command. The
 *    Arguments are: command, Error, stderr and stdout
 * @param {function():undefined} oncomplete Called when all commands are
 *    finnished
 * @param {number=} max The maximum number of separate processes to create
 */
nclosure.tests.utils.paralleliseExecs =
    function(execCommands, callback, oncomplete, max) {
  if (!max || max <= 0 || max >= execCommands.length) {
    var remaining = execCommands.length;
    goog.array.forEach(execCommands, function(c) {
      nclosure.tests.utils.child_process_.exec(c,
          function(err, stderr, stdout) {
        if (callback) callback(c, err, stderr, stdout);
        if (--remaining === 0) oncomplete();
      });
    });
  } else {
    var commands = goog.array.clone(execCommands);
    nclosure.tests.utils.runNextCommandImpl_(
      commands, callback, oncomplete, max);
  }
};

/**
 * @private
 * @type {number}
 */
nclosure.tests.utils.runningCommands_ = 0;

/**
 * @private
 * @param {Array.<string>} execCommands Commands to execute
 * @param {function(string, Error, string, string):undefined} callback
 *    The callback to call when the exec command completes this command. The
 *    Arguments are: command, Error, stderr and stdout
 * @param {function():undefined} oncomplete Called when all commands are
 *    finnished
 * @param {number=} max The maximum number of separate processes to create
 */
nclosure.tests.utils.runNextCommandImpl_ =
    function(execCommands, callback, oncomplete, max) {
  if (execCommands.length <= 0 ||
      nclosure.tests.utils.runningCommands_ >= max) return;

  nclosure.tests.utils.runningCommands_++;
  var command = execCommands.pop();
  nclosure.tests.utils.child_process_.exec(command,
      function(err, stderr, stdout) {
    nclosure.tests.utils.runningCommands_--;
    nclosure.tests.utils.runNextCommandImpl_(
        execCommands, callback, oncomplete, max);
    if (callback) callback(command, err, stderr, stdout);
    if (nclosure.tests.utils.runningCommands_ === 0 &&
        execCommands.length === 0) {
      return oncomplete();
    }
  });

  if (nclosure.tests.utils.runningCommands_ < max - 1) {
    nclosure.tests.utils.runNextCommandImpl_(
        execCommands, callback, oncomplete, max);
  }
};