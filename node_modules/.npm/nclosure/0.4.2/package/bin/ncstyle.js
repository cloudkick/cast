#!/usr/local/bin/node

/**
 * @fileoverview This file runs fixjsstyle and gjslint on a directory
 * recursively checking and trying to fix as many style issues as possible.
 * These tools run agains Google's coding
 * <a
 * href='http://google-styleguide.googlecode.com/svn/trunk/javascriptguide.xml'>
 *  style guide</a>.
 *
 * To use ncstyle:
 * <pre>
 *  ncstyle <directory>
 * </pre>
 *
 * It is also important to note that <em>"You should back up your files or store
 * them in a source control system before using fixjsstyle, in case the script
 * makes changes that you don't want."</em>
 *
 * For full details on the linter tools see the
 * <a href='http://code.google.com/closure/utilities/docs/linter_howto.html'>
 *  official docs<a/>.
 * @author guido@tapia.com.au (Guido Tapia)
 * @see
 *  <a href='http://code.google.com/closure/utilities/docs/linter_howto.html'>
 *  official docs<a/>.
 * @see
 * <a
 * href='http://google-styleguide.googlecode.com/svn/trunk/javascriptguide.xml'>
 *    Google's JavaScript Style Guide</a>
 */


/**
 * @private
 * @type {nclosure.core}
 * @const
 */
var ng_ = require('nclosure').nclosure();

goog.provide('nclosure.ncstyle');

goog.require('goog.array');
goog.require('goog.string');

goog.require('node.fs');

goog.require('nclosure.core');
goog.require('nclosure.opts');



/**
 * This constructor is called automatically once this file is parsed.  This
 * class is not intended to be used programatically.
 * @constructor
 */
nclosure.ncstyle = function() {

  /**
   * @private
   * @type {nclosure.opts}
   */
  this.settings_;

  var dir = process.argv[2];
  var isDir = nclosure.ncstyle.isDir_(dir);
  if (!isDir) {
    dir = dir.substring(0, dir.lastIndexOf('/') + 1);
  }
  var that = this;
  var onexit = function(err) {
    that.fixBashInstructionsOnDir_.call(that, dir);
    if (err) { console.error(err.stack); }
  };
  process.on('exit', onexit);
  process.on('SIGINT', onexit);
  process.on('uncaughtException', onexit);

  this.runFixStyle_(dir, function() {
    that.runGSJLint_(dir);
  });
};


/**
 * @private
 * @param {string} f The file or directory path.
 * @return {boolean} Wether the specified path is a directory.
 */
nclosure.ncstyle.isDir_ = function(f) {
  return node.fs.statSync(f).isDirectory();
};


/**
 * @private
 * @param {string} dir The directory to recursively fix the bash instructions
 *    on.
 */
nclosure.ncstyle.prototype.fixBashInstructionsOnDir_ = function(dir) {
  goog.array.forEach(node.fs.readdirSync(dir),
      function(f) {
        var path = ng_.getPath(dir, f);
        if (nclosure.ncstyle.isDir_(path)) {
          return this.fixBashInstructionsOnDir_(path);
        }
        this.fixBashInstructions_(dir, f);
      }, this);
};


/**
 * @private
 * @param {string} dir The directory to code check.
 * @param {string} file The file to check.
 */
nclosure.ncstyle.prototype.fixBashInstructions_ = function(dir, file) {
  if (this.isIgnorableFile_(dir, file)) return;
  var fileContents = node.fs.readFileSync(ng_.getPath(dir, file)).toString();
  var m = /^# !([^;]+)\;/g.exec(fileContents);
  if (!m) { return; }
  var fixed = m[1].replace(/ /g, '');
  fileContents = fileContents.replace(m[0], '#!' + fixed);
  node.fs.writeFileSync(ng_.getPath(dir, file), fileContents);
};


/**
 * @private
 * @param {string} dir The directory to code check.
 * @param {function():undefined} callback The exit callback.
 */
nclosure.ncstyle.prototype.runFixStyle_ = function(dir, callback) {
  this.runProcess_('fixjsstyle', this.getLinterArgs_(dir), callback);
};


/**
 * @private
 * @param {string} dir The directory to code check.
 * @param {function():undefined=} callback The exit callback.
 */
nclosure.ncstyle.prototype.runGSJLint_ = function(dir, callback) {
  this.runProcess_('gjslint', this.getLinterArgs_(dir), callback);
};


/**
 * @private
 * @param {string} dir The directory to style.
 * @return {Array.<string>} The array of arguments for the gjslint and
 *    fixjsstyle calls.
 */
nclosure.ncstyle.prototype.getLinterArgs_ = function(dir) {
  if (!this.settings_) {
    this.settings_ = ng_.args;
  }
  var excludes = this.getLinterExcludeFiles_(dir);
  var excludesDir = this.getLinterExcludeDir_(dir);
  var args = [];
  if (excludes.length) args.push('-x ' + excludes.join(','));
  if (excludesDir.length) args.push('-e ' + excludesDir.join(','));

  if (this.settings_.additionalLinterOptions) {
    args = goog.array.concat(args, this.settings_.additionalLinterOptions);
  }
  args.push(dir);
  return args;
};


/**
 * @private
 * @param {string} dir The directory to code check.
 * @return {Array.<string>} An array of all files to ignore.
 */
nclosure.ncstyle.prototype.getLinterExcludeFiles_ = function(dir) {
  if (!nclosure.ncstyle.isDir_(dir)) return [];
  return this.getAllIgnoreableFilesIn_([], dir);
};


/**
 * @private
 * @param {Array.<string>} allFiles The array containing all files
 *    to exclude.
 * @param {string} dir The directory to parse recursiverly for other
 *  ignoreable files.
 * @return {Array.<string>} An array of all ignoreable files to in the
 *    specified directory.
 */
nclosure.ncstyle.prototype.getAllIgnoreableFilesIn_ =
    function(allFiles, dir) {
  goog.array.forEach(node.fs.readdirSync(dir),
      function(f) {
        var path = ng_.getPath(dir, f);
        if (!nclosure.ncstyle.isDir_(path)) {
          if (this.isIgnorableFile_(dir, f)) { allFiles.push(path); }
        } else {
          this.getAllIgnoreableFilesIn_(allFiles, path);
        }
      }, this);
  return allFiles;
};


/**
 * @private
 * @param {string} dir The directory of the files we are checking.
 * @param {string} f If this file can be ignored from the checks.
 * @return {boolean} Wether the specified file can be safely ignored.
 */
nclosure.ncstyle.prototype.isIgnorableFile_ = function(dir, f) {
  if (nclosure.ncstyle.isDir_(
      ng_.getPath(dir, f))) return false;

  var ignore =
      f === 'goog.js' ||
      f.indexOf('.min.js') >= 0 ||
      f.indexOf('.tmp.js') >= 0 ||
      f.indexOf('_') === 0 ||
      f.indexOf('deps.js') >= 0 ||
      f.indexOf('.extern.js') >= 0 ||
      f.indexOf('.externs.js') >= 0;

  return ignore;
};


/**
 * @private
 * @param {string} dir The directory to code check.
 * @return {Array.<string>} An array of all directories to ignore.
 */
nclosure.ncstyle.prototype.getLinterExcludeDir_ = function(dir) {
  if (!nclosure.ncstyle.isDir_(dir)) return [];
  return this.getAllIgnoreableDirectoriesIn_([], dir);
};


/**
 * @private
 * @param {Array.<string>} allDirs The array containing all directories
 *    to exclude.
 * @param {string} dir The directory to parse recursiverly for other
 *  ignoreable directories.
 * @return {Array.<string>} An array of all ignoreable directories to in the
 *    specified directory.
 */
nclosure.ncstyle.prototype.getAllIgnoreableDirectoriesIn_ =
    function(allDirs, dir) {
  goog.array.forEach(node.fs.readdirSync(dir),
      function(d) {
        var path = ng_.getPath(dir, d);
        if (!nclosure.ncstyle.isDir_(path)) return;
        if (d === 'docs' || d === 'tests') { allDirs.push(path); return; }
        this.getAllIgnoreableDirectoriesIn_(allDirs, path);
      }, this);
  return allDirs;
};


/**
 * @private
 * @param {string} command The command to execute.
 * @param {Array.<string>} args The arguments to pass to the command.
 * @param {function():undefined=} callback The exit callback.
 */
nclosure.ncstyle.prototype.runProcess_ =
    function(command, args, callback) {
  command += ' ' + args.join(' ');

  var cmd = require('child_process').exec(command,
      function(err, stdout, stderr) {
        if (callback) { callback(); }
        if (err) {
          if (stderr) console.error(stderr);
          if (stdout) {
            var idx = stdout.indexOf('\nSome of the errors reported by');
            if (idx >= 0) stdout = goog.string.trim(stdout.substring(0, idx));
            console.error(stdout);
          }
          return;
        }

        console.log('\nSuccessfully Executed ' + command +
            (stderr ? '\n\tstderr:' + stderr : '') +
            (stdout ? '\n\tstdout: ' + stdout : ''));
      });
};

// Go!!!
new nclosure.ncstyle();
