#!/usr/local/bin/node

/**
 * @fileoverview This is a utility for running all test in a specified
 * directory. To use nctest:
 * <pre>
 *  nctest <directory>
 *  nctest <file>
 *  nctest <file> specific directory name.
 * </pre>
 *
 * When running tests or test suites in a directory nctest will look for
 * all files named *test* or *suite* recursively.  nctest also supports testing
 * html files which wil be scraped for all script tags.  This allows your
 * existing closure jsunit tests to be run without having to turn them
 * into js files.
 *
 * nctest also supports test suite files.  If a test suite file is encountered
 * in a directory or specified in using <code>nctest <file></code> then it will
 * parse any variable named suite and run all tests specified in this variable.
 * <pre>
 *  var suite = [file1, file2, suite1, ...];
 * </pre>
 * Closure's jsunit support is built ontop of jsunit.  For more information
 * see the <a href='http://www.jsunit.net/'>jsunit official docs.</a>.
 *
 * @author guido@tapia.com.au (Guido Tapia)
 * @see <a href='http://www.jsunit.net/'>jsunit official docs.</a>
 */


/**
 * @private
 * @const
 * @type {nclosure.core}
 */
var ng_ = require('nclosure').nclosure();

goog.provide('nclosure.nctest');

goog.require('goog.array');

goog.require('node.fs');
goog.require('node.path');

goog.require('nclosure.NodeTestsRunner');
goog.require('nclosure.core');



/**
 * The nclosure.nctest class runs all tests (files case insensitive
 * named *test* and *suite*) in a directory.
 *
 * This constructor is called automatically once this file is parsed.  This
 * class is not intended to be used programatically.
 *
 * @constructor
 */
nclosure.nctest = function() {
  /**
   * @private
   * @type {nclosure.NodeTestsRunner}
   */
  this.tr_ = new nclosure.NodeTestsRunner(
      this.getAllTestFiles_(process.argv[2]), this.getTestArgs_());

  process.on('uncaughtException', goog.bind(this.onException_, this));

  this.tr_.execute();
};


/**
 * @private
 * @param {string} dirOrFile The directory to check for tests files (or
 *    test file).
 * @return {Array.<string>} All tests files in this directory (recursive).
 */
nclosure.nctest.prototype.getAllTestFiles_ = function(dirOrFile) {
  if (!node.fs.statSync(dirOrFile).isDirectory()) {
    return this.getTestSuiteFiles_(dirOrFile) || [dirOrFile];
  }

  return this.readDirRecursiveSyncImpl_(dirOrFile, []);
};


/**
 * @private
 * @param {string} file The file to check if its a test suite.
 * @return {Array.<string>} If this is a test suite, which is a file that
 *    goog.require('goog.testing.jsunit') and has a suite variable then
 *    return the test suite files relative to this file's directory.
 */
nclosure.nctest.prototype.getTestSuiteFiles_ = function(file) {
  var contents = node.fs.readFileSync(file).toString();
  var suiteJsRegex = /var\s+suite\s*\=\s*\[([^;]+)\]/gim;

  var m = suiteJsRegex.exec(contents);
  if (!m) { return null; }
  var suittests = goog.array.map(m[1].split(','), function(s) {
    s = goog.string.trim(s);
    return s.substring(1, s.length - 1);
  });
  var dir = ng_.getFileDirectory(file);
  var alltests = [];
  if (!suittests) { return null; }

  var filesOrDirs = goog.array.map(suittests, function(t) {
    var dirOrFile = ng_.getPath(dir, t);
    alltests = goog.array.concat(alltests, this.getAllTestFiles_(dirOrFile));
  }, this);
  return alltests;
};


/**
 * @private
 * @return {string} The arguments we will pass to all tests to filter
 *    test results.
 */
nclosure.nctest.prototype.getTestArgs_ = function() {
  return process.argv.length > 2 ? process.argv.slice(3).join(',') : '';
};


/**
 * @param {string} dir The directory to read recursively.
 * @param {Array.<string>} allFiles The array containing all the files read.
 * @return {Array.<string>} The allFiles array for fluency.
 * @private
 */
nclosure.nctest.prototype.readDirRecursiveSyncImpl_ =
    function(dir, allFiles) {
  var files = node.fs.readdirSync(dir);
  goog.array.forEach(files, function(f) {
    var path = ng_.getPath(dir, f);
    if (node.fs.statSync(path).isDirectory()) {
      return this.readDirRecursiveSyncImpl_(path, allFiles);
    } else if (f.toLowerCase().indexOf('suite') >= 0) {
      var suiteFiles = this.getTestSuiteFiles_(path);
      if (suiteFiles) allFiles = goog.array.concat(allFiles, suiteFiles);
    } else if (f.toLowerCase().indexOf('test') >= 0) {
      allFiles.push(path);
    }
  }, this);
  return allFiles;
};


/**
 * @private
 * @param {Error} err The exception thrown by tests.
 */
nclosure.nctest.prototype.onException_ = function(err) {
  if (!err) return;

  if (err.stack) console.error(err.stack);
  else if (err.message) console.error(err.message);
  else if (typeof(err) === 'string') console.error(err);
};

new nclosure.nctest();
