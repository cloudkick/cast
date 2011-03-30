#!/usr/local/bin/node

/**
 * @fileoverview This is an inernal utiltiy used for development purposes only.
 * This utility will in the future update all third party dependencies.
 * Currently only updates the closure library from the CLOSURE_LIB_URL svn
 * repo.
 *
 * The libraries that this tool should upgrade are (* = already done).
 * <ul>
 *   <li>Closure Libraries *</li>
 *   <li>Linter</li>
 *   <li>Closure Compiler</li>
 *   <li>jsdoc-toolkit</li>
 * </ul>
 * @see <a href='http://code.google.com/p/picnet-closure-library-fork/'>Closure
 *    Library (picnet fork)</a>
 * @see <a href='http://code.google.com/closure/utilities/'>Closure Linter</a>
 * @see <a href='http://code.google.com/closure/compiler/'>Closure Compiler</a>
 * @see <a href='http://code.google.com/p/jsdoc-toolkit/'>jsdoc-toolkit</a>
 * @author guido@tapia.com.au (Guido Tapia)
 */


/**
 * A reference to the nclosure utiltity object.  This object provides common
 * utilities that should only be used internally in the nclosure project.
 *
 * @private
 * @type {nclosure.core}
 * @const
 */
var ng_ = require('nclosure').nclosure();

goog.provide('nclosure.updatedeps');

goog.require('goog.array');
goog.require('nclosure.core');



/**
 * This constructor is automatically run after this file is loaded.  This
 * starts the whole process off.
 *
 * @constructor
 */
nclosure.updatedeps = function() {
  var opts = ng_.args;
  this.chdirToThirdPartiesDir_();
  this.updateClosureLibrary_();
};

/**
 * The directory that the closure library resides in (inside the third_party
 *    folder).
 *
 * @private
 * @const
 * @type {string}
 */
nclosure.updatedeps.CLOSURE_LIB_DIR = 'closure-library';

/**
 * The url for the svn repo of the closure library.  This should point to the
 * 'closure-library' directory in the repository.
 *
 * @private
 * @const
 * @type {string}
 */
nclosure.updatedeps.CLOSURE_LIB_URL =
  'http://picnet-closure-library-fork.googlecode.com/svn/trunk/closure-library';

/**
 * The directorin containing all third party libraries.
 *
 * @private
 * @const
 * @type {string}
 */
nclosure.updatedeps.THIRD_PARTIES_DIR = '../third_party';

/**
 * Updates the closure library from the CLOSURE_LIB_URL repository.
 *
 * @private
 */
nclosure.updatedeps.prototype.updateClosureLibrary_ = function() {
  var that = this;
  var tmp = this.moveDirToTmp_(nclosure.updatedeps.CLOSURE_LIB_DIR,
      function() {
    var command =
      'svn export ' + nclosure.updatedeps.CLOSURE_LIB_URL + ' ' +
      nclosure.updatedeps.CLOSURE_LIB_DIR;
    that.runCommand_(command,
      goog.bind(that.updateClosureLibraryCallback_, that));
  });
};

/**
 * This is the callback to the svn checkout that we use to get the latest
 *    closure library.
 *
 * @private
 * @param {Error} err Any error that occurred whilst trying to load the
 *    closure-library repository.
 */
nclosure.updatedeps.prototype.updateClosureLibraryCallback_ = function(err) {
  var tmp = nclosure.updatedeps.CLOSURE_LIB_DIR + '.tmp';
  if (err) {
    return this.revertDirMove_(tmp, function() {
      console.error('Error running command: ' + command +
        '\nChange reverted');
    });
  }
  try {
    require('fs').chmodSync(nclosure.updatedeps.CLOSURE_LIB_DIR +
      '/closure/bin/build/depswriter.py', 0755);
    require('fs').chmodSync(nclosure.updatedeps.CLOSURE_LIB_DIR +
      '/closure/bin/build/closurebuilder.py', 0755);
  } catch (err) {
    console.error(err);
  };

  require('child_process').exec('rm -rf ' + tmp, function() {
    console.log('Successfuly updated the closure library');
  });
};

/**
 * Runs process.chdir into the specified directory.  Makes update commands
 * much easier if we are working in this directory.
 *
 * @private
 */
nclosure.updatedeps.prototype.chdirToThirdPartiesDir_ = function() {
  process.chdir(ng_.getPath(__dirname, nclosure.updatedeps.THIRD_PARTIES_DIR));
};

/**
 * Runs a specified command with the specified callback. All output and errors
 * are logged to the console.
 *
 * @private
 * @param {string} command The command to execute
 * @param {function(Error):undefined} callback The oncomplete callback
 */
nclosure.updatedeps.prototype.runCommand_ = function(command, callback) {
  var cmd = require('child_process').exec(command,
    function(err, stdout, stderr) {
      if (stderr) console.error(stderr);
      if (stdout) console.log(stdout);
      callback(err);
  });
};


/**
 * Moves a directory to a temporary name (<dirname>.tmp). However if the
 * tmp directory already exists this will remove that directory.
 *
 * @private
 * @param {string} dir the directory to move to a tmp location
 * @param {function():undefined} callback The oncomplete callback
 * @return {string} The new tmp directory
 */
nclosure.updatedeps.prototype.moveDirToTmp_ = function(dir, callback) {
  if (!require('path').existsSync(dir)) { return; }

  var tmp = dir + '.tmp';
  if (require('path').existsSync(tmp)) {
    require('child_process').exec('rm -rf ' + tmp, function() {
      require('fs').renameSync(dir, tmp);
      callback();
    });
  } else {
    require('fs').renameSync(dir, tmp);
    callback();
  }
  return tmp;
};

/**
 * Undoes the tmp directory move.  It first removes the real (untmp) directory
 * if it exists then moves the tmp directory back to its original location.
 *
 * @private
 * @param {string} dir the directory to move un tmp
 * @param {function():undefined} callback The oncomlete callback
 */
nclosure.updatedeps.prototype.revertDirMove_ = function(dir, callback) {
  var untmp = dir.replace('.tmp', '');
  var that = this;
  if (require('path').existsSync(untmp)) {
    require('child_process').exec('rm -rf ' + untmp, function() {
      that.revertDirMoveImpl_(dir, untmp, callback);
    });
  } else {
    this.revertDirMoveImpl_(dir, untmp, callback);
  };
};

/**
 * Undoes the tmp directory move.
 *
 * @private
 * @param {string} from the directory to move un tmp
 * @param {string} to the directory to move un tmp
 * @param {function():undefined} callback The oncomlete callback
 */
nclosure.updatedeps.prototype.revertDirMoveImpl_ = function(from, to, callback) {
  require('fs').rename(from, to, callback);
};

// Go!!
new nclosure.updatedeps();