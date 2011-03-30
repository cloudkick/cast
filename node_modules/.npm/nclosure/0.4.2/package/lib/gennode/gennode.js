#!/usr/local/bin/node


/**
 * @fileoverview This utility reads the node source directory and parses
 * all core library objects with the help of markdown files and additional
 * metadata held in typedata.txt.  This information is used to generate
 * wrappers to these libs that provide closure friendly way of writing
 * node code.

 * TODO:
 * - node.child_process.js did not pick up the documentation in the markdown
 *    files
 *
 * @author guido@tapia.com.au (Guido Tapia)
 */

require('nclosure').nclosure();

goog.provide('nclosure.gennode.gennode');

// Ensure you do not add dependencies on the node. namespace as it may
// not exist as this is the class responsible for creating it.
goog.require('goog.array');
goog.require('goog.object');

goog.require('nclosure.gennode.processor');



/**
 * @constructor
 */
nclosure.gennode.gennode = function() {
  this.allLibFiles_ = this.getAllLibFiles_();
  this.allMarkdownFiles_ = this.getAllMarkdownFiles_();
  this.allDocs_ = this.parseAllDocs_();
  this.allTypeData_ = this.parseAllTypeData_();
  this.processGlobalObjects_();
  this.processFiles_();
};

/**
 * @private
 */
nclosure.gennode.gennode.prototype.processGlobalObjects_ = function() {
  this.writeDummyDocObjects_('node', this.allDocs_['synopsis.']);

  for (var i in nclosure.gennode.utils.REQUIRED_GLOBALS_) {
    var obj = nclosure.gennode.utils.REQUIRED_GLOBALS_[i];
    if (typeof(obj) !== 'object') continue;

    this.processObject_(i, obj, i,
                        i === 'global' ? this.allDocs_['globals.'] : '');
  }
};


/**
 * @private
 * @param {string} name The name of the class to create.
 * @param {string} overview The overview of this mock class.
 */
nclosure.gennode.gennode.prototype.writeDummyDocObjects_ = function(name, overview) {
  var dummy = new nclosure.gennode.clazz(name);
  dummy.createNamespace(name, overview);
  nclosure.gennode.processor.dumpClassFile(name, dummy);
};


/**
 * @private
 */
nclosure.gennode.gennode.prototype.processFiles_ = function() {
  this.allLibFiles_.slice(0, 1);
  goog.array.forEach(this.allLibFiles_, this.processJSFile_, this);
};


/**
 * @private
 * @param {string} f The filename to read and process.
 */
nclosure.gennode.gennode.prototype.processJSFile_ = function(f) {
  if (f.indexOf('_') === 0) return; // Ignore privates

  var js = require('fs').readFileSync(
      nclosure.gennode.utils.NODE_LIB_DIR_ + f);
  var ctx = goog.object.clone(nclosure.gennode.utils.REQUIRED_GLOBALS_);
  var fileExports = {};
  ctx.exports = fileExports;

  try { process.binding('evals').Script.runInNewContext(js, ctx, f); }
  catch (ex) { console.error('Not parsing: ' + f + ' ex: ' + ex.message); }
  this.processObject_(f, fileExports);
};


/**
 * @private
 * @param {string} name The name of this object.
 * @param {Object} obj An instance of this object.
 * @param {string=} coreRequires If specified will not use the defaule
 *  require('type') to initialise the node object.
 * @param {string=} overrideOverview Namespace documentation to override.
 */
nclosure.gennode.gennode.prototype.processObject_ =
    function(name, obj, coreRequires, overrideOverview) {
  new nclosure.gennode.processor(name, true, obj, this.allDocs_, this.allTypeData_,
      coreRequires, overrideOverview).process();
};


/**
 * @private
 * @return {Array.<string>} All the core node js files.
 */
nclosure.gennode.gennode.prototype.getAllLibFiles_ = function() {
  return require('fs').readdirSync(nclosure.gennode.utils.NODE_LIB_DIR_);
};


/**
 * @private
 * @return {Object.<string, string>} The object -> doc map for all objects in
 *    the markdown docs.
 */
nclosure.gennode.gennode.prototype.parseAllDocs_ = function() {
  var map = {};
  goog.array.forEach(this.allMarkdownFiles_, function(f) {
    var contents = require('fs').readFileSync(
        nclosure.gennode.utils.NODE_DOC_DIR_ + f).
        toString();
    var fileMap = this.parseDocContents_(f, contents);
    for (var i in fileMap) {
      if (i in map) throw new Error(i +
          ' already exists in the objects->documents map');
      map[i] = fileMap[i];
    }
  }, this);
  return map;
};


/**
 * @private
 * @param {string} name The name of the file.
 * @param {string} contents The markdown to parse for object documentation.
 * @return {Object.<string, string>} The object -> doc map for this markdown
 *    contents.
 */
nclosure.gennode.gennode.prototype.parseDocContents_ = function(name, contents) {
  var map = {};
  var classes = contents.split(/^##\s/gm);
  name = name.split('.')[0];

  goog.array.forEach(classes, function(c, i) {
    if (!c) return;
    var className = i === 1 ? name : c.substring(0, c.indexOf('\n'));
    var members = c.split(/^###\s/gm);
    goog.array.forEach(members, function(m, i) {
      var mname = m.substring(0, m.indexOf('\n'));
      if (mname.indexOf('*/') >= 0) {
        mname = mname.substring(mname.indexOf('*/') + 1);
      }
      if (mname.indexOf('(') >= 0) {
        mname = mname.substring(0, mname.indexOf('('));
      } if (mname.indexOf('.') >= 0) {
        mname = mname.split('.')[1];
      }
      m = this.formatDocs_(m);
      var id = nclosure.gennode.utils.getClassAndMemberID(
          className, i > 0 ? mname : undefined);
      map[id] = m;
    }, this);
  }, this);
  return map;
};


/**
 * @private
 * @param {string} d The document to format.
 * @return {string} The formatted document.
 */
nclosure.gennode.gennode.prototype.formatDocs_ = function(d) {
  // Remove the first line which just has the name
  d = d.substring(d.indexOf('\n')).replace(/\//g, '&#47;');
  d = d.replace(/`([^`]+)`/g,
      '<code>$1</code>');
  d = d.replace(/___([^_]+)___/g, '<em><strong>$1</strong></em>');
  d = d.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  d = d.replace(/_([^_]+)_/g, '<em>$1</em>');
  // TODO: The replace below is very inflexible
  d = d.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="node.$2">$1</a>');
  // Put code samples in <pre> tags
  var lines = d.split('\n');
  var incode = false;
  var prev;
  for (var i = 0, len = lines.length; i < len; i++) {
    var l = lines[i];
    if (!incode && l.indexOf('    ') === 0 && prev === '') {
      lines[i - 1] = '<pre>';
      incode = true;
    } else if (incode && l.indexOf('    ') !== 0 && prev === '') {
      lines[i - 1] = '</pre>';
      incode = false;
    }
    prev = l;
  }

  return goog.string.trim(lines.join('\n'));
};


/**
 * @private
 * @return {Object.<string>} All the type data in the typedata.txt file.
 */
nclosure.gennode.gennode.prototype.parseAllTypeData_ = function() {
  var contents =
      require('fs').readFileSync(__dirname + '/typedata.txt').
      toString().split('\n');
  var parsed = {};
  goog.array.forEach(contents, function(c) {
    if (!c || c.indexOf('#') === 0) return; // Ignore comments
    var idx = c.indexOf('=');
    parsed[c.substring(0, idx)] = c.substring(idx + 1);
  });
  return parsed;
};

/**
 * @private
 * @return {Array.<string>} All the markdown files in the node api dir.
 */
nclosure.gennode.gennode.prototype.getAllMarkdownFiles_ = function() {
  return require('fs').readdirSync(nclosure.gennode.utils.NODE_DOC_DIR_);
};

new nclosure.gennode.gennode();
