#!/usr/local/bin/node

/**
 * @fileoverview Utility to compile a specific JS project. To use the compiler:
 * <pre>
 *  ncompile [options] <file>
 * </pre>
 * Supported options are:
 * <ul>
 *  <li>-c Creates a minified file.</li>
 *  <li>-d Creates a dependecy file (deps.js).  You can then reference this
 *    file in other projects to use the libraries defined in you librayr.</li>
 * </ul>
 * For full details on the compiler see the
 * <a href='http://code.google.com/closure/compiler/'>official docs</a> and
 * the
 * <a href='http://code.google.com/closure/compiler/docs/js-for-compiler.html'>
 *  annotation docs</a>.
 *
 * @author guido@tapia.com.au (Guido Tapia)
 * @see <a href='http://code.google.com/closure/compiler/'>official docs</a>
 * @see
 *  <a href='http://code.google.com/closure/compiler/docs/js-for-compiler.html'>
 *    annotation docs</a>.
 */


/**
 * @private
 * @const
 * @type {nclosure.core}
 */
var ng_ = require('nclosure').nclosure();

goog.provide('nclosure.nccompile');

goog.require('nclosure.core');

// nccompile should not require any node. namespace stuff as its required
// to generate the deps for this namespace and hence cannot rely on it.



/**
 * @constructor
 * This compiler is automatically run once this file has been parsed.  It is
 * not intended to be used programatically.
 *
 * This constructor starts the compilation process.
 */
nclosure.nccompile = function() {

  /**
   * @private
   * @type {boolean}
   */
  this.compile_ = false;

  /**
   * @private
   * @type {boolean}
   */
  this.deps_ = false;

  /**
   * @private
   * @type {boolean}
   */
  this.verbose_ = false;

  /**
   * @private
   * @type {string}
   */
  this.fileToCompile_;

  /**
   * @private
   * @type {string}
   */
  this.tmpFileName_;

  /**
   * @private
   * @type {string}
   */
  this.compiledFileName_;

  /**
   * @private
   * @type {string}
   */
  this.fileToCompileIgnore_;


  var cli = require('cli');
  var options = cli.parse({
    'compile': ['c', 'Produces the <filename>.min.js file. If ommitted the ' +
          ' code is still compiled and warnings shown, the compiled file is ' +
          'just NOT written'],
    'deps': ['d', 'Produces a deps.js file.'],
    'verbose': ['v', 'Verbose output.']
  });

  var that = this;
  cli.main(function(args, options) { that.init_(args, options); });
};


/**
 * @private
 * @param {Array.<string>} cliArgs The command line args.
 * @param {Object.<string>} options The parsed options.
 */
nclosure.nccompile.prototype.init_ = function(cliArgs, options) {
  var that = this;
  var onexit = function(err) { that.onExit_.call(that, err); };
  process.on('exit', onexit);
  process.on('SIGINT', onexit);
  process.on('uncaughtException', onexit);

  this.compile_ = options.compile;
  this.verbose_ = options.verbose;
  this.deps_ = options.deps;
  this.fileToCompile_ = cliArgs[cliArgs.length - 1];

  if (!this.fileToCompile_) {
    throw new Error('No file specified, usage nccompile <filetocompile>');
  }
  if (this.compile_) {
    console.log('The -c [compile] flag is not fully operational yet.  Please ' +
                'use cauting when running .min.js files as they are not yet ' +
                'fully compatible with Node\'s require(...) syntaxt.');
  }

  this.tmpFileName_ = this.fileToCompile_.replace('.js', '.tmp.js');

  this.compiledFileName_ = this.tmpFileName_.replace('.tmp.js', '.min.js');
  this.fileToCompileIgnore_ = this.fileToCompile_.replace('.js', '.ignorejs');

  var additionalSettingsFile = ng_.getPath(
      ng_.getFileDirectory(this.fileToCompile_), 'closure.json');
  ng_.loadAditionalDependenciesInSettingsFile(additionalSettingsFile);
  this.runCommands_();
};


/**
 * @private
 */
nclosure.nccompile.prototype.runCommands_ = function() {
  var command = this.deps_ ? this.runDependencies_ : this.runCompilation_;
  command.call(this);
};


/**
 * @private
 */
nclosure.nccompile.prototype.runDependencies_ = function() {
  var that = this;
  var fileDir = ng_.getFileDirectory(this.fileToCompile_);
  var depsFile = this.deps_ ? ng_.getPath(fileDir, 'deps.js') : '';
  this.runCommand_(this.getDepsClArgs_(), 'depswriter.py',
      depsFile, '', null, function(err) {
        if (err) {
          console.error(err.stack);
          throw err;
        }
        that.runCompilation_();
      });
};


/**
 * @private
 */
nclosure.nccompile.prototype.runCompilation_ = function() {
  var fileContents = require('fs').readFileSync(this.fileToCompile_).toString();

  var bashInst = this.createTmpFile_(fileContents);
  require('fs').
      renameSync(this.fileToCompile_, this.fileToCompileIgnore_);
  var clArgs = this.getCompilerClArgs_();
  var verbose = this.verbose_;
  this.runCommand_(clArgs, 'closurebuilder.py',
      this.compile_ ? this.compiledFileName_ : '', bashInst, function(output) {
        var lastArg = clArgs[clArgs.length - 1];
        if (lastArg.lastIndexOf('--') < 0) {
          return output.replace(/ --/g, '\n  --');
        }
        lastArg = lastArg.substring(lastArg.lastIndexOf('--'));
        if (output.indexOf(lastArg) < 0) { return output; }
        return output.substring(output.indexOf('\n', output.indexOf(lastArg)));
      });
};


/**
 * @private
 * @param {Error=} err An optional error.
 */
nclosure.nccompile.prototype.onExit_ =
    function(err) {
  if (require('path').existsSync(this.tmpFileName_)) {
    require('fs').unlinkSync(this.tmpFileName_);
  }
  if (require('path').existsSync(this.fileToCompileIgnore_)) {
    require('fs').renameSync(this.fileToCompileIgnore_, this.fileToCompile_);
  }
  if (err) { console.error(err.stack); }
};


/**
 * @private
 * @param {string} contents The original file contents.
 * @return {string} Any bash shell instructions that need to be copied into
 *    the compiled file.
 */
nclosure.nccompile.prototype.createTmpFile_ = function(contents) {
  var bashInstIdx = contents.indexOf('#!');
  var hasInst = bashInstIdx === 0; // Must be top line
  var bashInst = '';

  if (hasInst) {
    var endIdx = contents.indexOf('\n') + 1;
    bashInst = contents.substring(bashInstIdx, endIdx);
    contents = contents.substring(endIdx);
  }
  var newCode = //'goog.require(\'nclosure\');' +
      (hasInst ? '\n' : '') +
      contents;
  require('fs').writeFileSync(this.tmpFileName_, newCode);
  return bashInst;
};


/**
 * @private
 * @param {Array.<string>} clArgs Any additional arguments to the command.
 * @param {string} command The command to run.
 * @param {string} targetFile The name of the file to produce.
 * @param {string} bashInstructions Any bash shell instructions that are
 *    required in the compiled file.
 * @param {(function(string):string)?} formatOutput A function to use to format
 *    the output of the command.
 * @param {function(Error=):undefined=} callback The callback to call on exit.
 */
nclosure.nccompile.prototype.runCommand_ = function(clArgs, command,
    targetFile, bashInstructions, formatOutput, callback) {

  var exec = ng_.getPath(ng_.args.closureBasePath,
                         'closure/bin/build/' + command);
  exec += ' ' + clArgs.join(' ');
  var that = this;
  if (this.verbose_) console.error(exec.replace(/ --/g, '\n  --'));
  require('child_process').exec(exec, [],
      function(err, stdout, stderr) {
    if (that.verbose_) console.error('Command completed');
    if (err) {
      err.stack = err.stack.replace(/\.tmp\.js/g, '.js');
      console.error('\nError in command:\n' +
                    exec.replace(/ --/g, '\n  --') + '\n' + err.stack);
    }

    if (stderr) {
      if (formatOutput) stderr = formatOutput(stderr);
      console.error(stderr.replace(/\.tmp\.js/g, '.js'));
    }
    if (stdout && targetFile) {
      if (that.verbose_) console.error('Writing file to: ' + targetFile);
      stdout = stdout.replace(/\.tmp\.js/g, '.js');
      stdout = (bashInstructions || '') + stdout;
      require('fs').writeFileSync(targetFile, stdout);
    }
    if (callback) callback(err);
  });
};


/**
 * @private
 * @return {Array.<string>} Any additional compiler args for the compilation
 *   operation.
 */
nclosure.nccompile.prototype.getCompilerClArgs_ =
    function() {
  var path = ng_.getFileDirectory(this.fileToCompile_);
  var addedPaths = [];
  var clArgs = [];
  this.addRoot_(addedPaths, clArgs, ng_.args.closureBasePath, false);
  this.addRoot_(addedPaths, clArgs, path, false);
  var libPath = ng_.getPath(__dirname, '../lib');
  var binPath = ng_.getPath(__dirname, '../bin');
  this.addRoot_(addedPaths, clArgs, libPath, false);
  this.addRoot_(addedPaths, clArgs, binPath, false);
  clArgs = this.addAdditionalRoots_(addedPaths, clArgs, false);

  clArgs.push('--input=' + this.tmpFileName_);
  clArgs.push('--output_mode=compiled');
  clArgs.push('--compiler_jar=' + (ng_.args.compiler_jar ||
      ng_.getPath(__dirname,
      '../third_party/ignoregoogcompiler.jar')));

  clArgs.push(
      '--compiler_flags=--js=' +
          ng_.getPath(ng_.args.closureBasePath,
      'closure/goog/deps.js'),
      '--compiler_flags=--externs=' +
          ng_.getPath(libPath, 'externs.js'),
      '--compiler_flags=--compilation_level=ADVANCED_OPTIMIZATIONS',
      '--compiler_flags=--output_wrapper=' +
      '"(function() {this.window=this;%output%})();"'
  );

  if (ng_.args.additionalCompileOptions) {
    ng_.args.additionalCompileOptions.forEach(function(opt) {
      clArgs.push('--compiler_flags=' + opt);
    });
  }


  return clArgs;
};


/**
 * @private
 * @param {Object.<number>} addedPaths A cache of all loaded files, for
 *    duplicate checking.
 * @param {Array.<string>} clArgs The array to add any additional deps to.
 * @param {boolean}  wPrefix Wether to use root_with_prefix.
 * @return {Array.<string>} A filterd argument list with no duplicate root
 *    paths
 */
nclosure.nccompile.prototype.addAdditionalRoots_ =
    function(addedPaths, clArgs, wPrefix) {

  if (ng_.args.additionalCompileRoots) {
    goog.array.forEach(ng_.args.additionalCompileRoots, function(root) {
      this.addRoot_(addedPaths, clArgs, root, wPrefix);
    }, this);
  } else if (ng_.args.additionalDeps) {
    // Only try to guess roots if additionalCompileRoots not specified
    goog.array.forEach(ng_.args.additionalDeps, function(dep) {
      var path = dep.substring(0, dep.lastIndexOf('/'));
      this.addRoot_(addedPaths, clArgs, path, wPrefix);
    }, this);
  }
  // Now we sort in length order (shortest path first) and see if we have
  // included duplicates. TODO: This is not nice code.  It assumes that
  // roots are the first thing added to the command line args array.
  // However not doing it like this would require 2 passes and not up
  // for it right now.
  clArgs.sort();
  var noDuplicates = [];
  goog.array.forEach(clArgs, function(a) {
    if (!goog.array.find(noDuplicates,
                           function(d) { return a.indexOf(d) >= 0 })) {
      noDuplicates.push(a);
    }
  });
  return noDuplicates;
};


/**
 * @private
 * @param {Array.<string>} addedPaths A cache of all loaded files, for
 *    duplicate checking.
 * @param {Array.<string>} clArgs The array to add any additional deps to.
 * @param {string} path The path to add as a root or root_with_prefix.
 * @param {boolean}  wPrefix Wether to use root_with_prefix.
 */
nclosure.nccompile.prototype.addRoot_ =
    function(addedPaths, clArgs, path, wPrefix) {
  var realpath = this.isPathInMap_(addedPaths, path);
  if (!goog.isDefAndNotNull(realpath)) { return; }
  var realClosureBaseDir = require('fs').realpathSync(
      ng_.getPath(ng_.args.closureBasePath, 'closure/goog'));
  var root = wPrefix ?
      ('"--root_with_prefix=' + path + ' ' +
      this.getPathToDir_(realpath, realClosureBaseDir) + '"') :
      ('--root=' + realpath);
  clArgs.push(root);
};


/**
 * @private
 * @param {string} realFrom The absolute from path.
 * @param {string} realTo The absolute destination path.
 * @return {string} The path to take between the directories.
 */
nclosure.nccompile.prototype.getPathToDir_ = function(realFrom, realTo) {
  var from = realFrom.split('/').reverse(),
      to = realTo.split('/').reverse(),
      fl = from.length - 1,
      tl = to.length - 1,
      path = [];

  // first eliminate common root
  while ((fl >= 0) && (tl >= 0) && (from[fl] === to[tl])) {
    fl--;
    tl--;
  }

  // for each remaining level in the home path, add a ..
  for (; tl >= 0; tl--) { path.push('..'); }

  // for each level in the file path, add the path
  for (; fl >= 0; fl--) { path.push(from[fl]); }

  return path.join('/');
};


/**
 * @private
 * @return {Array.<string>} Any additional compiler args for the compilation
 *   dependency check operation.
 */
nclosure.nccompile.prototype.getDepsClArgs_ = function() {
  var path = ng_.getFileDirectory(this.fileToCompile_);
  var addedPaths = [];
  var clArgs = [];
  this.addRoot_(addedPaths, clArgs, path, true);
  return this.addAdditionalRoots_(addedPaths, clArgs, true);
};


/**
 * @private
 * @param {Array.<string>} map Already added roots.
 * @param {string} s The string to check in the map.
 * @return {string?} null if the string is already in the map.  If not it is
 *    then added to the specified map and we return the real path of the file;.
 */
nclosure.nccompile.prototype.isPathInMap_ = function(map, s) {
  var real = require('fs').realpathSync(s);
  if (goog.array.find(map, function(m) {
    return real.indexOf(m) >= 0;
  })) { return null; }
  map.push(real);
  return real;
};


/**
 * @private
 * @param {string} file The file whose parent directory we are trying to find.
 * @return {string} The parent directory of the soecified file.
 */
nclosure.nccompile.prototype.getDirectory_ = function(file) {
  var pathIdx = file.lastIndexOf('/');
  var path = pathIdx > 0 ? file.substring(0, pathIdx) : '.';
  return path;
};

// Go!
new nclosure.nccompile();
