
/**
 * @fileoverview This file provides the node.js support to handle basic google
 * closure commands such as <code>goog.require</code> and
 * <code>goog.provide</code>.  It also contains hooks and overrides that make
 * dealing with closure which is primarily a web development platform more
 * manageable when using node.js.
 *
 * To use nclosure simply initialise it before any of your code like this:
 * <pre>
 *    require('nclosure').nclosure();
 *    // Now you can use google's closure lib.
 *    goog.require("goog.array");
 *    ...
 * </pre>
 *
 * For full instructions on using the nclosure project please read the
 * README.md file.
 *
 * This file was originaly called goog.js and was written originally by
 * Hendrik Schnepel in his awesome node-goog project
 * (https://github.com/hsch/node-goog) which was the original inspiration for
 * this project. See the README.md file for a full lisk of acknowledgements
 * and licenses.
 *
 * @see <a href='http://code.google.com/p/picnet-closure-library-fork/'>Closure
 *    Library (picnet fork)</a>
 *
 * @author hendrik.schnepel@gmail.com (Hendrik Schnepel)
 * @author guido@tapia.com.au (Guido Tapia)
 */


/**
 * As soon as the module is loaded we initialise the 'closure' framework so we
 * can start using goog.provide, etc straight away.
 *
 * @type {nclosure.base}
 * @private
 */
var nclosurebase_ = require('./nclosurebase').nclosurebase;

goog.provide('nclosure.core');

goog.require('goog.Timer');
goog.require('goog.string');
goog.require('nclosure.base');
goog.require('nclosure.opts');
goog.require('nclosure.settingsLoader');


/**
 * TODO: Do we need this anymore?  This used to be for test framework but I
 *    think it may be redunant.
 *
 * @type {function(string):*}
 */
global.require = require;



/**
 * @constructor
 */
nclosure.core = function() {

  /**
   * @private
   * @type {nclosure.settingsLoader}
   */
  this.settingsLoader_ = /** @type {nclosure.settingsLoader} */
      (require('./settingsloader').settingsLoader);

  /**
   * These are the settings being currently used.
   * @type {nclosure.opts}
   */
  this.args;

  /**
   * This is the context used to inject all 'requires', if null we will
   *    use global (more efficient).
   * @type {Object}
   * @private
   */
  this.ctx_;

  /**
   * @private
   * @type {boolean}
   */
  this.initialised_ = false;

  /**
   * Sets a global 'nclosure.core.instance' poiting to 'this' which is the main
   * 'nclosure' context.  This allows anyone (especially nctest) to
   * load any additional dependencies if required
   * @type {nclosure.core}
   */
  nclosure.core.instance = this;
};


/**
 * A global 'nclosure.instance' poiting to 'this' which is the main
 * 'nclosure' context.  This allows anyone (especially nctest) to
 * load any additional dependencies if required
 *
 * @type {nclosure.core}
 */
nclosure.core.instance;


/**
 * @param {string} dir The base directory of the specified file.
 * @param {string} file This is the file (or directory) name which needs to
 *    be concatenated to the baseDir.
 * @return {string} The correctly concatenated baseDir + file which should
 *    represent the full path to the specific file/dir.
 */
nclosure.core.prototype.getPath = function(dir, file) {
  return this.settingsLoader_.getPath(dir, file);
};


/**
 * @param {string} file The file whose directory we want.
 * @return {string} The correctly directory of the specified file.
 */
nclosure.core.prototype.getFileDirectory = function(file) {
  return this.settingsLoader_.getFileDirectory(file);
};


/**
 * @param {nclosure.opts=} opts Parameters object.
 * @return {nclosure.core} This instance of this class, for fluency.
 */
nclosure.core.prototype.init = function(opts) {
  // Any class brought in by using goog.require will not have access to
  // anonymous vars in the global context so lets make them implicit.
  global.__dirname = __dirname;
  global.__filename = __filename;

  // If we are calling init again inside another context like a test then we
  // do not have to go through the full initialisation but we do need to
  // load some settings just in case the test loads additional dependencies
  this.args = this.settingsLoader_.readSettingsObject(opts);

  if (this.initialised_) {
    if (opts) { this.loadAditionalDependenciesInSettings_(this.args); }
    return this;
  }
  this.initialised_ = true;
  this.loadAditionalDependenciesInSettings_(this.args);
  return this; // Allows some 'fluent' style usage
};


/**
 * This function executes the specified file in its own context and intercepts
 * any calls to goog() to try to capture any additional settings objects.
 *
 * @param {string} file  The file to execute and intercept the goog()  call.
 * @return {nclosure.opts?} The options object represented in the
 *    specified file.
 */
nclosure.core.prototype.parseCompilerArgsFromFile = function(file) {
  return this.settingsLoader_.parseCompilerArgsFromFile(file);
};


/**
 * @param {string} dir The directory containing the dependencies file.
 * @param {string} file The file in the specified directory that has the
 *    closure dependencies.
 */
nclosure.core.prototype.loadDependenciesFile = function(dir, file) {
  nclosurebase_.loadDependenciesFile(dir, file);
};


/**
 * This function executes the specified file in its own context and intercepts
 * any calls to goog() to try to capture any additional settings objects.
 *
 * @param {string} file  The file to execute and intercept the goog()  call.
 */
nclosure.core.prototype.loadAditionalDependenciesInSettingsFile =
    function(file) {
  this.init(this.settingsLoader_.readArgsFromJSONFile(file) || undefined);
};


/**
 * @private
 * Loads all additional dependencies file found in the settings object.
 * @param {nclosure.opts} opts The options describing any additional deps.
 */
nclosure.core.prototype.loadAditionalDependenciesInSettings_ = function(opts) {
  nclosurebase_.loadAllDependencies(opts);
};


/**
 * Sets a new context which will load all subsequent requires into this
 * context.  Note: The plan for this was to load each test in its own
 * context but this did not completed.
 *
 * @param {Object} ctx The context used to inject all 'requires'.
 */
nclosure.core.prototype.setCurrentContext = function(ctx) { this.ctx_ = ctx; };


////////////////////////////////////////////////////////////////////////////////
// Shadow nclosurebase.js closureScriptLoading and closureScriptLoaded
////////////////////////////////////////////////////////////////////////////////


/**
 * If this method returns false then the loadScript_ funciton in nclosurebase.js
 * will abort the loading of a specified script.
 *
 * Allows the loading of all scripts except goog.testing.jsunit which we
 * handle in nctest.js
 *
 * @param {string} dir The directory where the file resides.
 * @param {string} file The file to load.
 * @return {boolean} Wether to continue loading this file.
 */
nclosurebase_.closureScriptLoading = function(dir, file) {
  return (file.indexOf('testing/jsunit.js') < 0);
};


/**
 * Notification after a script is loaded by nclosurebase.js.
 *
 * Every time a script is loaded we check here if any additional initialisation
 * is required to make the loaded mode function correctly.  Namely the timers
 * framework need a bit of extra work to function correctly.
 *
 * @param {string} dir The directory where the file resides.
 * @param {string} file The file to load.
 */
nclosurebase_.closureScriptLoaded = function(dir, file) {
  /*
   * If the Timer module has been loaded, provide the Node-
   * specific implementation of the *Timeout and *Interval
   * methods.
   */
  if (goog.Timer && !goog.Timer.defaultTimerObject) {
    goog.Timer.defaultTimerObject = {
      'setTimeout': setTimeout,
      'clearTimeout': clearTimeout,
      'setInterval': setInterval,
      'clearInterval': clearInterval
    };
  }
};

// Singleton
var ng_instance_ = nclosure.core.instance || new nclosure.core();


/**
 * Node.js module for nclosure.
 * @type {function(nclosure.opts):nclosure.core}
 */
exports.nclosure = goog.bind(ng_instance_.init, ng_instance_);
