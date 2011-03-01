
/**
 * @fileoverview This file contains utilties that are required by the utils
 * in nclosure project.  The files using this include ncdoc.js,
 * ncstyle.js and nccompile.js in this directory and lib/goog.js.
 *
 * Since lib/goog.js is loaded without the closure scope set this file must
 * support running outside of closure scope.
 *
 * @author guido@tapia.com.au (Guido Tapia)
 */

if (typeof(goog) !== 'undefined') {
  goog.provide('nclosure.opts');
  goog.provide('nclosure.settingsLoader');
} else {
  global['nclosure'] = global['nclosure'] || {};
}



/**
 * @constructor
 */
nclosure.settingsLoader = function() {
  /**
   * @private
   * @type {nclosure.opts}
   */
  this.cached_opts_;
};


/**
 * @param {string} baseDir The base directory of the specified file.
 * @param {string} file This is the file (or directory) name which needs to
 *    be concatenated to the baseDir.
 * @return {string} The correctly concatenated baseDir + file which should
 *    represent the full path to the specific file/dir.
 */
nclosure.settingsLoader.prototype.getPath = function(baseDir, file) {
  if (baseDir && baseDir.charAt(baseDir.length - 1) !== '/') baseDir += '/';
  if (file.charAt(0) === '/') file = file.substring(1);
  var path = baseDir + file;
  var cwd = process.cwd() + '/';
  path = require('path').resolve(path);
  if (path.indexOf(cwd) >= 0) {
    path = path.replace(cwd, '');
  }
  return path;
};


/**
 * @param {string} file The file whose directory we want.
 * @return {string} The correctly directory of the specified file.
 */
nclosure.settingsLoader.prototype.getFileDirectory = function(file) {
  var didx = file.lastIndexOf('/');
  if (didx < 0) return './';
  return file.substring(0, file.lastIndexOf('/') + 1);
};


/**
 * @param {string} source The contents of a file that could have a shebang.
 * @return {string} The source without the shebang.
 */
nclosure.settingsLoader.prototype.removeShebang = function(source) {
  return source.replace(/^#![^\n]+/, '\n');
};


/**
 * This function executes the specified file in its own context and intercepts
 * any calls to goog() to try to capture any additional settings objects.
 *
 * @param {string} file  The file to execute and intercept the goog()
 *  call.
 * @return {nclosure.opts?} The options object represented in the
 *    specified file.
 */
nclosure.settingsLoader.prototype.parseCompilerArgsFromFile = function(file) {
  var contents = require('fs').readFileSync(file).toString();
  return this.parseCompilerArgsFromFileImpl_(file, contents);
};


/**
 * @param {string} path The closure.json file that holds the description of the
 *   settings.
 *
 * @return {nclosure.opts?} The settings object.
 */
nclosure.settingsLoader.prototype.readArgsFromJSONFile = function(path) {
  if (!path || !require('path').existsSync(path)) return null;
  var json = require('fs').readFileSync(path).toString();
  var dir = path.substring(0, path.lastIndexOf('/'));
  return this.getOptsObject_(dir, json);
};


/**
 * This method reads the settings object in the current directory, global
 * directory and finaly if we pass in the optional opts parameter
 * we also include that in the settings.  This method is safe and efficient
 * to call multiple times.
 *
 * @param {nclosure.opts=} opts The base options object to use.  This is
 *     used by goog.js and it passes in the init(opts) object.
 * @return {nclosure.opts} The options object in the current context.
 */
nclosure.settingsLoader.prototype.readSettingsObject = function(opts) {
  if (this.cached_opts_) {
    if (opts) {
      this.cached_opts_ =
          this.validateOpsObject_(null,
          /** @type {!nclosure.opts} */ (this.extendObject_(
          this.cached_opts_, opts)),
          false);
    }
    return this.cached_opts_;
  }

  var globalSettings =
      this.readArgsFromJSONFile(this.getPath(__dirname, '../bin/closure.json'));
  var currentDirSettings =
      this.readArgsFromJSONFile(this.getPath(process.cwd(), '/closure.json'));
  var settings = globalSettings || /** @type {!nclosure.opts} */ ({});
  this.extendObject_(settings, currentDirSettings);
  if (opts) this.extendObject_(settings, opts);
  return this.cached_opts_ =
      this.validateOpsObject_(null, settings, false);
};


/**
 * @private
 * @param {nclosure.opts} target The object to extend.
 * @param {?nclosure.opts} newData The data to add or replace in the
 *    target object.
 * @return {nclosure.opts} The modified target object.
 */
nclosure.settingsLoader.prototype.extendObject_ = function(target, newData) {
  if (!newData) { return target; }
  for (var i in newData) {
    var orig = target[i];
    var newprop = newData[i];
    if (orig && newprop && typeof(newprop) !== 'string' &&
        typeof (newprop.length) === 'number') {
      for (var i = 0, len = newprop.length; i < len; i++) {
        if (!this.arrayContains_(orig, newprop[i])) {
          orig.push(newprop[i]);
        }
      }
    } else {
      target[i] = newprop;
    }
  }
  return target;
};


/**
 * @private
 * @param {Array} arr The array to check.
 * @param {*} o The value to check for in the specified array.  Note this uses
 *    === comparison so only ref matches are found.
 * @return {boolean} Wether the specified array contains the specified value.
 */
nclosure.settingsLoader.prototype.arrayContains_ = function(arr, o) {
  for (var i = 0, len = arr.length; i < len; i++) {
    if (arr[i] === o) return true;
  }
  return false;
};


/**
 * @private
 * @param {string} file The file to try to parse settings out of.  It is also
 *    used to determine which directory to look for the closure.json settings
 *    file.
 * @param {string} code The javascript code to parse trying to find the
 *    settings object.
 * @return {nclosure.opts?} The options object represented in the
 *    specified javascript code.
 */
nclosure.settingsLoader.prototype.parseCompilerArgsFromFileImpl_ =
    function(file, code) {
  var opts;
  var ctx = {
    require: function(moduleName) {
      return {
        goog: function(innerOpts) {
          opts = innerOpts;
          throw new Error('intentional exit');
        }
      };
    }
  };
  code = this.removeShebang(code);
  try { process.binding('evals').Script.runInNewContext(code, ctx, file); }
  catch (e) {}
  var dirIdx = file.lastIndexOf('/');
  var dir = dirIdx < 0 ? '.' : file.substring(0, dirIdx);
  return this.validateOpsObject_(
      this.getPath(process.cwd(), dir), opts || {}, true);
};


/**
 * @private
 * @param {string?} dir The directory of the current settings file or
 *    executing javascript file.
 * @param {string} json JSON string representation of an options object.
 * @return {nclosure.opts} The options object.
 */
nclosure.settingsLoader.prototype.getOptsObject_ = function(dir, json) {
  process.binding('evals').Script.runInThisContext('var opts = ' + json);
  return this.validateOpsObject_(dir, opts, true);
};


/**
 * @private
 * @param {string?} currentDir The directory of the current settings file or
 *    executing javascript file.
 * @param {!nclosure.opts} opts The options object to validate.
 * @param {boolean} allowNullMandatories Wether to allow null mandatory
 *    directories.
 * @return {!nclosure.opts} The validated options object.
 */
nclosure.settingsLoader.prototype.validateOpsObject_ =
    function(currentDir, opts, allowNullMandatories) {
  if (opts.closureBasePath) {
    opts.closureBasePath = this.parseClosureBasePath_(
        this.validateDir_(currentDir,
        'closureBasePath', opts.closureBasePath, allowNullMandatories));
  } if (opts.jsdocToolkitDir) {
    opts.jsdocToolkitDir = this.validateDir_(currentDir,
        'jsdocToolkitDir', opts.jsdocToolkitDir, true);
  } if (opts.nodeDir) {
    opts.nodeDir = this.validateDir_(currentDir,
        'nodeDir', opts.nodeDir, true);
  } if (opts.compiler_jar) {
    opts.compiler_jar = this.validateDir_(currentDir,
        'compiler_jar', opts.compiler_jar, true);
  } if (opts.additionalDeps) {
    for (var i = 0, len = opts.additionalDeps.length; i < len; i++) {
      opts.additionalDeps[i] = this.validateDir_(currentDir,
          'additionalDeps', opts.additionalDeps[i], true);
    }
  } if (opts.additionalCompileRoots) {
    for (var i = 0, len = opts.additionalCompileRoots.length; i < len; i++) {
      opts.additionalCompileRoots[i] = this.validateDir_(
          currentDir, 'additionalCompileRoots',
          opts.additionalCompileRoots[i], true);
    }
  }
  return opts;
};


/**
 * @private
 * @param {string} dir The directory specified as the closure base path.
 *    This allows any directory below or including the closure-library/
 *    directory.
 * @return {string} The /closure-library directory.
 */
nclosure.settingsLoader.prototype.parseClosureBasePath_ = function(dir) {
  var tokens = dir.split(/[\/\\]/);
  var pathToClosure = [];
  for (var i = 0, len = tokens.length; i < len; i++) {
    var t = tokens[i];
    if (t === '..') {
      pathToClosure.pop();
      continue;
    }
    pathToClosure.push(t);
    if (t.toLowerCase() === 'closure-library') { break; }
  }
  var path = require('path').normalize(pathToClosure.join('/'));
  return path;
};


/**
 * @private
 * @param {string?} currentDir The directory of the current settings file or
 *    executing javascript file.
 * @param {string} name The name or description of the directory.
 * @param {string} dir The directory to validate.
 * @param {boolean} allowNull Wether we can have null.
 * @return {string} The valid directory (turned into absolute).
 */
nclosure.settingsLoader.prototype.validateDir_ =
    function(currentDir, name, dir, allowNull) {
  if (!dir) {
    if (allowNull) return dir;
    throw new Error('Directory/File: ' + name + ' must be specified.');
  }
  if (dir.charAt(0) !== '/' && dir.charAt(0) !== '\\' && currentDir) {
    dir = this.getPath(currentDir, dir);
  }
  dir = require('path').normalize(dir);
  if (!this.checkDirExists_(dir)) {
    throw new Error('The directories/files specified in nclosure ' +
        'configuration could not be found: ' + dir);
  }
  return dir;
};


/**
 * @private
 * @param {string} dir The directory to check wether exists.
 * @return {boolean} Wether the specified directory exists.
 */
nclosure.settingsLoader.prototype.checkDirExists_ = function(dir) {
  return require('path').existsSync(dir);
};



/**
 * @constructor
 */
nclosure.opts = function() {
  /**
   * @type {string}
   */
  this.closureBasePath;

  /**
   * @type {Array.<string>}
   */
  this.additionalDeps;

  /**
   * @type {string}
   */
  this.jsdocToolkitDir;

  /**
   * @type {string}
   */
  this.nodeDir;

  /**
   * @type {string}
   */
  this.compiler_jar;

  /**
   * @type {Array.<string>}
   */
  this.additionalCompileRoots;

  /**
   * @type {Array.<string>}
   */
  this.additionalCompileOptions;

  /**
   * @type {Array.<string>}
   */
  this.additionalJSDocToolkitOptions;

  /**
   * @type {string}
   */
  this.jsdocToolkitTemplate;

  /**
   * @type {Array.<string>}
   */
  this.additionalLinterOptions;
};


/**
 * @type {nclosure.settingsLoader}
 */
exports.settingsLoader = new nclosure.settingsLoader();
