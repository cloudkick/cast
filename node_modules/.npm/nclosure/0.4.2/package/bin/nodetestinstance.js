#!/usr/local/bin/node

/**
 * @fileoverview Utility class to run tests in their own process (isolation)
 * Note: this file should not be used manually but rather through the
 * nctest command.
 *
 * @author guido@tapia.com.au (Guido Tapia)
 */


/**
 * @private
 * @const
 * @type {nclosure.core}
 */
var ng_ = require('nclosure').nclosure();

goog.provide('nclosure.NodeTestInstance');


/**
 * goog/testing/testcase.js Reads this property as soon as it's 'required' so
 * set it now before the goog.requires below
 * @type {{userAgent:string}}
 */
global.navigator = { userAgent: 'node.js' };

goog.require('goog.testing.AsyncTestCase');
goog.require('goog.testing.TestCase');
goog.require('goog.testing.stacktrace');
goog.require('goog.testing.stacktrace.Frame');

goog.require('node.fs');

goog.require('nclosure.core');



/**
 * @constructor
 * @param {string} file The filename holding the test that we will be
 *    responsible for.
 * @param {string} args The search args that are passed to the test case for
 *    test lookups.
 *
 * Note: this file should not be used manually but rather through the
 * nctest command.
 */
nclosure.NodeTestInstance = function(file, args) {

  /**
   * @private
   * @type {string}
   */
  this.file_ = file;

  /**
   * @private
   * @type {string}
   */
  this.args_ = args;

  /**
   * @private
   * @type {string}
   */
  this.shortName_ = file.substring(file.lastIndexOf('/') + 1);

  /**
   * @private
   * @type {goog.testing.TestCase}
   */
  this.testCase_;

  // Some require overrides to make stack traces properly visible
  goog.testing.stacktrace.parseStackFrame_ =
      nclosure.NodeTestInstance.parseStackFrameLine_;
  goog.testing.stacktrace.framesToString_ =
      nclosure.NodeTestInstance.stackFramesToString_;


  this.loadAdditionalTestingDependencies_();
  this.setUpTestCaseInterceps_(args || '');
  this.overwriteAsyncTestCaseProblemPoints_();

  process.on('uncaughtException', goog.bind(this.onTestComplete_, this));

  this.run();
};


/**
 * @private
 */
nclosure.NodeTestInstance.prototype.loadAdditionalTestingDependencies_ =
    function() {
  var dir = this.file_.substring(0, this.file_.lastIndexOf('/'));
  ng_.loadAditionalDependenciesInSettingsFile(ng_.getPath(dir, 'closure.json'));
  ng_.loadDependenciesFile(dir, 'deps.js');
};


/**
 * Sets up any interceptions required into AsyncTestCase to stop any async style
 * problems emerging in these tests.
 * @private
 * @suppress {visibility}
 */
nclosure.NodeTestInstance.prototype.overwriteAsyncTestCaseProblemPoints_ =
    function() {
  // The default createAndInstall relies on TestRunners and other internal
  // goog.testing package which are not available in this context
  goog.testing.AsyncTestCase.createAndInstall =
      goog.bind(this.createAsyncTestCase_, this);

  // The AsyncTestCase pump_ method throws
  // AsyncTestCase.ControlBreakingException which causes all sorts of problems
  // in this context.  Using object 'pump_' notation because
  // @suppress {visibility} is being ignored by the libs compiler
  var opump = goog.testing.AsyncTestCase.prototype.pump_;
  var that = this;
  goog.testing.AsyncTestCase.prototype.pump_ = function(opt_doFirst) {
    try {
      opump.call(this, opt_doFirst);
    } catch (ex) {
      // Safe to ignore
      if (ex.isControlBreakingException) {
        that.onTestComplete_();
      } else {
        throw ex;
      }
    }
  };
};


/**
 * Sets up the test filter to use when auto detecting tests.
 * @param {string} filter The filter to apply to the running tests.
 * @private
 * @suppress {visibility}
 */
nclosure.NodeTestInstance.prototype.setUpTestCaseInterceps_ =
    function(filter) {
  // Crazy jibber jabber from goog.testing.TestCase. Ugly code here but little
  // alternative other than re implementing TestCase which is 95% there

  // TODO: Implement better 'testsToRun' support. @see goog.testing.TestCase
  // for details, it should be pretty straight forward, as the testsToRun_
  // map quite flexible.

  global.window = {
    location: {
      search: (this.args_ ? '?runTests=' + this.args_ : ''),
      href: ''
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };

  // Ignore this, return 1
  goog.testing.TestCase.prototype.countNumFilesLoaded_ =
      function() { return 1; }

  goog.testing.TestCase.Result.prototype.isStrict = function() { return true; }
};


/**
 * Runs the test
 */
nclosure.NodeTestInstance.prototype.run = function() {
  var contents = this.loadTestContents_();
  this.loadTestContentsIntoMemory_(contents);
  this.createAndRunTestCase_();
};


/**
 * @private
 * @return {goog.testing.AsyncTestCase} The async test case created.
 */
nclosure.NodeTestInstance.prototype.createAsyncTestCase_ = function() {
  return this.testCase_ = new goog.testing.AsyncTestCase(this.shortName_);
};


/**
 * @private
 * @return {string} The test file contents.
 */
nclosure.NodeTestInstance.prototype.loadTestContents_ = function() {
  return node.fs.readFileSync(this.file_).toString();
};


/**
 * @private
 * @param {string} contents The test file contents.
 */
nclosure.NodeTestInstance.prototype.loadTestContentsIntoMemory_ =
    function(contents) {
  if (this.shortName_.indexOf('.js') < 0) {
    contents = this.convertHtmlTestToJS_(contents);
  }
  contents = contents.replace(/^#![^\n]+/, '\n'); // remove shebang
  process.binding('evals').Script.
      runInThisContext(contents, this.shortName_);
};


/**
 * @private
 */
nclosure.NodeTestInstance.prototype.createAndRunTestCase_ = function() {
  var async = goog.isDefAndNotNull(this.testCase_);
  if (!async) { this.testCase_ = new goog.testing.TestCase(this.shortName_); }
  this.testCase_.autoDiscoverTests();
  this.testCase_.setCompletedCallback(goog.bind(this.onTestComplete_, this));
  this.testCase_.runTests();
};


/**
 * Called when the test case is completed. This method just passes the test
 *    case to the test runner which passes in a handler when creating this
 *    instance.
 * @private
 */
nclosure.NodeTestInstance.prototype.onTestComplete_ = function() {
  var data = this.testCase_.getReport(false);
  var reportFile = '.tmptestreport.json';
  node.fs.writeFileSync(reportFile, data);
};


/**
 * @private
 * @param {string} html The html file contents.
 * @return {string} The JavaScript contents.
 */
nclosure.NodeTestInstance.prototype.convertHtmlTestToJS_ = function(html) {
  var blocks = [];
  var idx = html.indexOf('<script');
  while (idx >= 0) {
    idx = html.indexOf('>', idx);
    var endIdx = html.indexOf('</script>', idx);
    blocks.push(html.substring(idx + 1, endIdx));
    html = html.substring(endIdx + 9);
    idx = html.indexOf('<script');
  }
  return blocks.join('\n');
};


/**
 * For each raw text line find an appropriate 'goog.testing.stacktrace.Frame'
 * object which constructs with these args:
 *  {string} context Context object, empty in case of global functions
 *    or if the browser doesn't provide this information.
 *  {string} name Function name, empty in case of anonymous functions.
 *  {string} alias Alias of the function if available. For example the
 *    function name will be 'c' and the alias will be 'b' if the function is
 *    defined as <code>a.b = function c() {};</code>.
 *  {string} args Arguments of the function in parentheses if available.
 *  {string} path File path or URL including line number and optionally
 *   column number separated by colons
 *
 * @private
 * @param {string} line A line in the stack trace.
 * @return {goog.testing.stacktrace.Frame} The parsed frame.
*/
nclosure.NodeTestInstance.parseStackFrameLine_ = function(line) {
  if (!line || line.indexOf('    at ') !== 0) { return null; }
  line = line.substring(line.indexOf(' at ') + 4);
  // return new goog.testing.stacktrace.Frame('', line, '', '', line);

  if (line.charAt(0) === '/') { // Path to test file
    return new goog.testing.stacktrace.Frame('', '', '', '', line);
  }
  var contextAndFunct = line.substring(0, line.lastIndexOf(' ')).split('.');
  var context = '';
  var funct = '';
  if (contextAndFunct.length === 1) {
    funct = contextAndFunct[0];
  } else {
    context = contextAndFunct[0];
    funct = contextAndFunct[1];
  }
  var path = line.substring(line.indexOf('(') + 1);

  return new goog.testing.stacktrace.Frame(context, funct, '', '',
      path.substring(0, path.length - 1));
};


/**
 * @private
 * @type {Array.<string>}
 * @const
 */
nclosure.NodeTestInstance.IGNOREABLE_LINES_ = [
  'testing/asynctestcase.js',
  'testing/testcase.js',
  'testing/asserts.js',
  'testing/stacktrace.js',
  '.createAndRunTestCase_',
  'nodetestinstance.js',
  'ChildProcess.'
];


/**
 * Converts the stack frames into canonical format. Chops the beginning and the
 * end of it which come from the testing environment, not from the test itself.
 * @param {!Array.<goog.testing.stacktrace.Frame>} frames The frames.
 * @return {string} Canonical, pretty printed stack trace.
 * @private
 */
nclosure.NodeTestInstance.stackFramesToString_ = function(frames) {
  var stack = [];
  for (var i = 0, len = frames.length; i < len; i++) {
    var f = frames[i];
    if (!f && typeof(f) !== 'string') continue;

    var str = f.toCanonicalString();
    if (goog.array.find(nclosure.NodeTestInstance.IGNOREABLE_LINES_,
        function(l) { return str.indexOf(l) >= 0; }
        )) { continue; }

    stack.push('> ');
    stack.push(str);
    stack.push('\n');
  }
  return stack.join('');
};

new nclosure.NodeTestInstance(process.argv[2], process.argv[3]);
