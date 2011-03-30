
/**
 * @fileoverview Utility class to run all specified tests in their own process
 * (isolation).
 *
 * Note: this file should not be used manually but rather through the
 * nctest command.
 *
 * @author guido@tapia.com.au (Guido Tapia)
 */

goog.provide('nclosure.NodeTestsRunner');

goog.require('goog.array');
goog.require('goog.string');



/**
 * @constructor
 * @param {Array.<string>} testFiles The test files to test.
 * @param {string} args Any args used to find appropriate tests to run.
 *
 * Note: this file should not be used manually but rather through the
 * nctest command.
 */
nclosure.NodeTestsRunner = function(testFiles, args) {
  /**
   * The test files to test, this will be 'pop'ed as these are run.
   * @private
   * @type {Array.<string>}
   */
  this.testFiles_ = goog.array.clone(testFiles);
  /**
   * @private
   * @type {string}
   */
  this.args_ = args;

  /**
   * When test instances complete the running of their test cases they get
   *  stored here so we can then use this information to display results.
   * @private
   * @type {Array.<nclosure.NodeTestsRunner.result>}
   */
  this.completedResults_ = [];
};


/** @typedef {{stdout:string,stderr:string,report:string,file:string}} */
nclosure.NodeTestsRunner.result;


/**
 * Executes the tests specified in the constructor.
 */
nclosure.NodeTestsRunner.prototype.execute = function() {
  this.runNextTest_();
};


/**
 * Runs the next test in the queue or calls displayResults_
 * @private
 */
nclosure.NodeTestsRunner.prototype.runNextTest_ = function() {
  if (this.testFiles_.length === 0) {
    this.displayResults_();
  } else {
    this.runNextTestImpl_(this.testFiles_.pop());
  }
};


/**
 * Runs the next specified test
 * @param {string} file The spricific test to run.
 * @private
 */
nclosure.NodeTestsRunner.prototype.runNextTestImpl_ = function(file) {
  console.error('Running Tests [' + file + ']');

  var fs = require('fs');
  var that = this;
  var reportFile = '.tmptestreport.json';
  var cmd = require('child_process').
      spawn('nodetestinstance', [file, this.args_]);
  var stderr = '', stdout = '', err;
  var ondata = function(d) {
    d = goog.string.trim(d.toString());
    if (!d) return;
    stderr += d;
    console.error(d);
  };
  cmd.stderr.on('data', ondata);
  cmd.stdout.on('data', ondata);
  cmd.on('exit', function(code) {
    var report = '';
    if (require('path').existsSync(reportFile)) {
      report = fs.readFileSync(reportFile).toString();
      fs.unlinkSync(reportFile);
    }

    /** @type {nclosure.NodeTestsRunner.result} */
    var results = {
      'file': file,
      'exitCode': code,
      'stdout': stdout,
      'stderr': stderr,
      'report': report
    };

    that.onTestCompleted_(results);
  });
};


/**
 * @private
 * @param {nclosure.NodeTestsRunner.result} results The results object
 *  scrapped from the NodeTestInstance process.
 */
nclosure.NodeTestsRunner.prototype.onTestCompleted_ = function(results) {
  this.completedResults_.push(results);
  this.runNextTest_();
};


/**
 * @private
 * Spits the results to the console
 */
nclosure.NodeTestsRunner.prototype.displayResults_ = function() {
  console.log('\x1B[0;34m\n=======\nRESULTS\n=======');
  var results = goog.array.map(this.completedResults_,
      nclosure.NodeTestsRunner.renderResult_, this);
  console.log(results.join('\n\n'));
};


/**
 * @private
 * Renders the test case to the console.
 * @param {nclosure.NodeTestsRunner.result} result The result to render.
 * @return {string} A string representation of this test case.
 */
nclosure.NodeTestsRunner.renderResult_ = function(result) {
  if (result.report)
    return nclosure.NodeTestsRunner.colorizeReport_(result.report);
  else {
    return '\x1B[0;31m' + result.file + ' [FAILED] - No Report Found';
  }
};


/**
 * @param {string} report The test report to colorize.
 * @return {string} The colorized report.
 * @private
 */
nclosure.NodeTestsRunner.colorizeReport_ = function(report) {
  var lines = report.replace(/\s*$/, '').split('\n');
  var isSuccess = true;
  lines = goog.array.map(lines, function(l) {
    if (l.indexOf('[FAILED]') > 0) {
      isSuccess = false;
    } else if (l.indexOf('[SUCCESS]') > 0) {
      isSuccess = true;
    }
    return (isSuccess ? '\x1B[0;32m' : '\x1B[0;31m') + l;
  });
  var titleLen = lines[0].length - 7; // 7 for the color
  var underline = nclosure.NodeTestsRunner.padString_('', titleLen, '-');
  lines[1] = underline;
  return lines.join('\n');
};


/**
 * Gets a string padded with given character to get given size.
 * @param {string} str The given string to be padded.
 * @param {number} length The target size of the string.
 * @param {string} ch The character to be padded with.
 * @return {string} The padded string.
 * @private
 */
nclosure.NodeTestsRunner.padString_ = function(str, length, ch) {
  while (str.length < length) {
    str = ch + str;
  }
  return str;
};

