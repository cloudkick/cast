#!/usr/local/bin/node


/**
 * @fileoverview A simple utility that compiles every file in the node wrappers
 * directory to ensure that the code generated is of decent 'closure' quality.
 *
 * @author guido@tapia.com.au (Guido Tapia)
 */

require('nclosure').nclosure();

goog.provide('nclosure.gennode.compileall');

goog.require('goog.array');

goog.require('nclosure.gennode.utils');

/**
 * @constructor
 */
nclosure.gennode.compileall = function() {
  var files = goog.array.filter(require('fs').readdirSync(
      nclosure.gennode.utils.WRAPPERS_DIR),
      function(f) { return f.indexOf('.js') > 0 && f !== 'deps.js'; });
  this.compileFiles_(files);
};

/**
 * @param {Array.<string>} files All the node wrapper files to compile
 */
nclosure.gennode.compileall.prototype.compileFiles_ = function(files) {
  if (files.length === 0) return;
  var file = files.pop();
  var that = this;
  this.compileFile_(nclosure.gennode.utils.WRAPPERS_DIR + '/' + file,
      function() {
    that.compileFiles_(files);
  });
};

/**
 * @param {string} f The file to compile
 * @param {function():undefined} callback The callback when completed
 */
nclosure.gennode.compileall.prototype.compileFile_ = function(f, callback) {
  console.error('COMPILING: ' + f);
  require('child_process').exec('nccompile ' + f,
      function(err, stdout, stderr) {
        if (stderr.indexOf('0 error(s), 0 warning(s)') >= 0) return callback();
        if (err) { console.error(err.stack); }
        if (stderr) { console.error(stderr); }
        if (stdout) { console.error(stdout); }
        callback();
      });
};

new nclosure.gennode.compileall(); // Go
