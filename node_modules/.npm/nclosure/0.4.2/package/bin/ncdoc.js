#!/usr/local/bin/node

/**
 * @fileoverview Utility to generate jsdoc style docs from your source code.
 * To use the ncdoc too just:
 * <pre>
 *  ncdoc <dir>
 * </pre>
 * This will generate all your docs and put them in the <dir>/docs/ directory.
 *
 * For full details on jsdoc see the
 * <a href='http://jsdoc.sourceforge.net/'>official docs</a>.
 *
 * @author guido@tapia.com.au (Guido Tapia)
 * @see <a href='http://jsdoc.sourceforge.net/'>official docs</a>
 */


/**
 * @private
 * @type {nclosure.core}
 * @const
 */
var ng_ = require('nclosure').nclosure();

goog.provide('nclosure.ncdoc');

goog.require('goog.array');
goog.require('nclosure.core');
goog.require('nclosure.opts');



/**
 * This constructor is called automatically once this file is parsed.  This
 * class is not intended to be used programatically.
 *
 * @constructor
 */
nclosure.ncdoc = function() {
  var args = ng_.args;
  if (!args.jsdocToolkitDir) {
    throw new Error('To run the jsdoc-toolkit documentation module please ' +
        'specify a jsdocToolkitDir property pointing to the jsdoc-toolkit ' +
        'root directory.  This setting can reside in the global closure.json ' +
        'settings file or the closure.json file in the code root dir');
  }

  /**
   * @private
   * @const
   * @type {{init:function(Array.<string>)}}
   */
  this.jsdoc_toolkit_ =
      require('../third_party/node-jsdoc-toolkit/app/noderun').jsdoctoolkit;

  /**
   * @private
   * @type {Array.<string>}
   */
  this.clArgs;

  this.init_(args);
};


/**
 * @private
 * @param {nclosure.opts} args The settings object.
 */
nclosure.ncdoc.prototype.init_ = function(args) {
  // _dirToDoc is for testing so tests can set this global before calling
  // goog.require('nclosure.ncdoc')
  this.createJSDocArgs_(args, global['_dirToDoc'] || process.argv[2]);

  // Run node-jsdoc-toolkit
  this.runJSDocToolkit_();
};


/**
 * @private
 * @param {nclosure.opts} args The settings object.
 * @param {string} entryPoint The file/directory to document.
 */
nclosure.ncdoc.prototype.createJSDocArgs_ = function(args, entryPoint) {
  var entryPointDirIdx = entryPoint.lastIndexOf('/');
  var title = entryPointDirIdx > 0 ?
      entryPoint.substring(entryPointDirIdx + 1) : entryPoint;
  var entryPointDir = entryPointDirIdx > 0 ?
      entryPoint.substring(0, entryPointDirIdx) : '.';
  var jsDocToolkitDir = args.jsdocToolkitDir;
  var template = ng_.getPath(jsDocToolkitDir, 'templates/' +
          (args.jsdocToolkitTemplate || 'codeview'));
  var outputPath = ng_.getPath(entryPointDir,
      args.jsdocToolkitTemplate === 'ctags' ? '' : '/docs');

  this.clArgs = [
    '-t=' + template,
    '-d=' + outputPath,
    '-D="title:' +
        title + '"'
  ];
  if (args.additionalJSDocToolkitOptions) {
    this.clArgs = goog.array.concat(this.clArgs,
        args.additionalJSDocToolkitOptions);
  }
  this.clArgs.push(entryPoint);
};


/**
 * @private
 */
nclosure.ncdoc.prototype.runJSDocToolkit_ = function() {
  this.jsdoc_toolkit_.init(this.clArgs);
};


/** @type {nclosure.ncdoc} */
exports.googDoc = new nclosure.ncdoc();
