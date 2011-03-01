#!/usr/local/bin/node

/**
 * @fileoverview
 * This file is used to generate the externs that will allow basic support for
 * node.js core libs.  This is far from complete and requires much more careful
 * parsing and also the examination of the markdown files to try to pull out
 * examples, additional docuentation and where possible type inference
 * information.  Ideally all of node code libs should be closure documented for
 * better type support.
 *
 * @author guido@tapia.com.au (Guido Tapia)
 */


/**
 * @private
 * @type {nclosure.core}
 * @const
 */
var ng_ = require('nclosure').nclosure();

goog.provide('nclosure.genexterns');

goog.require('goog.array');
goog.require('nclosure.core');



/**
 * Note: This class is only used for nclosure development and should not be
 * used programatically or for any reason at all ;)
 *
 * @constructor
 */
nclosure.genexterns = function() {
  var opts = ng_.args;

  /**
   * @private
   * @const
   * @type {string}
   */
  this.nodeDir_ = opts.nodeDir;
  if (!this.nodeDir_)
    throw new Error('To run the genextens.js script you must declare ' +
        'a nodeDir property in the global closure.json settings file located ' +
        'in the bin directory of nclosure');

  /**
   * This is the buffer holding the text that will at the end of the parsing
   * process be written to an externs file.
   *
   * @private
   * @type {Array.<string>}
   */
  this.buffer_ = [];

  /**
   * Anything that has a name like the ones declared below will not be
   * processed as this object keeps a record of all items processed regardless
   * of what type of item it is.  I.e. This can be property names, function
   * names, namespaces, class names, etc
   *
   * @private
   * @type {Object.<number>}
   */
  this.done_ = {
    'setTimeout': 1,
    'setInterval': 1,
    'clearTimeout': 1,
    'clearInterval': 1,
    'COMPILED': 1,
    'goog': 1,
    'window': 1,
    'node': 1,
    'top': 1
  };

  this.run_();
};


/**
 * @private
 * @const
 * @type {extern_fs}
 */
nclosure.genexterns.fs_ = /** @type {extern_fs} */ (require('fs'));


/**
 * Run the externs generation operation.
 *
 * @private
 */
nclosure.genexterns.prototype.run_ = function() {
  this.initialiseDoneExterns_();
  this.doAllGlobalObjects_();
  this.doAllFiles_(
      ng_.getPath(this.nodeDir_, 'lib'));

  nclosure.genexterns.fs_.writeFileSync(
      ng_.getPath(__dirname, '/node.externs.js'),
      this.buffer_.join('\n\n')); // Flush the buffer
};


/**
 * @private
 */
nclosure.genexterns.prototype.initialiseDoneExterns_ = function() {
  var staticExterns = nclosure.genexterns.fs_.readFileSync(__dirname +
      '/node.static.externs.js', encoding = 'utf8');
  var m, regex = /var\s*([^\s]+)|(^[\w_\.^;]+)/gm;
  while (m = regex.exec(staticExterns)) {
    var extern = m[1] === undefined ? m[2] : m[1];
    this.done_[extern] = 1;
  }
};


/**
 * @private
 */
nclosure.genexterns.prototype.doAllGlobalObjects_ = function() {
  this.writeObjectFromMarkdown_('globals', '');
  this.writeObject_('', global);
  this.writeObject_('process', process);
};


/**
 * @private
 * @param {string} dir The directory to process
 */
nclosure.genexterns.prototype.doAllFiles_ = function(dir) {
  var files = nclosure.genexterns.fs_.readdirSync(dir);
  goog.array.forEach(files, function(f) { this.doFile_(f); }, this);
};


/**
 * @private
 * @param {string} f The file to process
 */
nclosure.genexterns.prototype.doFile_ = function(f) {
  var name = f.replace('.js', '');

  try {
    var o = require(name);
    this.writeObject_(name, o);
  } catch (ex) {
    console.log('Could not extern ' + name +
        ' as it does not successfully "require".');
    return;
  }
};


/**
 * @private
 * @param {string} markdownFileName The name of the markdown documentation
 *    file to parse
 * @param {string} namespace The namespace of the current object
 */
nclosure.genexterns.prototype.writeObjectFromMarkdown_ =
    function(markdownFileName, namespace) {
  var contents = nclosure.genexterns.fs_.readFileSync(
      ng_.getPath(this.nodeDir_,
      '/doc/api/' + markdownFileName + '.markdown'),
      encoding = 'utf8');

  if (namespace && !this.writeObjectNS_(namespace)) { return; }

  var m, regex = /### (.*)/g;
  while (m = regex.exec(contents)) {
    this.writeMarkdownProp_(namespace, m[1]);
  }
};


/**
 * @private
 * @param {string} prefix The current running prefix (can be
 *        cascading namespaces)
 * @param {string} prop The property to document
 */
nclosure.genexterns.prototype.writeMarkdownProp_ = function(prefix, prop) {
  var isFunction = prop.indexOf('()') >= 0;
  if (isFunction) prop = prop.replace('()', '');
  this.writePropImpl_(prefix, prop, isFunction, false, null);
};


/**
 * @private
 * @param {string} name The name of the object to document
 * @param {*} o The instance of the object
 */
nclosure.genexterns.prototype.writeObject_ = function(name, o) {
  if (name) {
    name = 'extern_' + name;
    if (!this.writeObjectNS_(name)) { return; }
  }
  this.writeObjectProps_(!name ? name : name + '.prototype', o);
};


/**
 * @private
 * @param {string} name The namespace of the object
 */
nclosure.genexterns.prototype.writeObjectNS_ = function(name) {
  if (this.isDone_(name)) { return false; }

  this.buffer_.push('/**\n @constructor\n */\nvar ' + name + ';');
  return true;
};


/**
 * @private
 * @param {string} prefix The current running prefix (can be
 *        cascading namespaces)
 * @param {*} obj An instance of the object to inspect for properties
 */
nclosure.genexterns.prototype.writeObjectProps_ = function(prefix, obj) {
  this.writeObjectPropsImpl_(prefix, obj);
  if (obj.super_) this.writeObjectPropsImpl_(prefix, obj.super_);
};


/**
 * @private
 * @param {string} prefix The current running prefix (can be
 *        cascading namespaces)
 * @param {*} obj An instance of the object to inspect for properties
 */
nclosure.genexterns.prototype.writeObjectPropsImpl_ = function(prefix, obj) {
  for (var prop in obj) {
    this.writeProp_(prefix, prop, obj[prop]);
  }
};


/**
 * @private
 * @param {string} prefix The current running prefix (can be
 *        cascading namespaces)
 * @param {string} prop The property to document
 * @param {*} val The value of the current property, used for type
 *    detection
 */
nclosure.genexterns.prototype.writeProp_ = function(prefix, prop, val) {
  if (prop.indexOf('_') === prop.length - 1 || prop.indexOf('_') === 0 ||
      prop === 'throws') return; // assume private

  var isFunction = typeof (val) === 'function';
  var isObject = isFunction &&
      prop.charAt(0).toUpperCase() == prop.charAt(0);
  this.writePropImpl_(prefix, prop, isFunction, isObject, val);
};


/**
 * @private
 * @param {string} prefix The current running prefix (can be
 *        cascading namespaces)
 * @param {string} prop The property to document
 * @param {boolean} isFunction Wether the property is a function
 * @param {boolean} isObject Wether the property is an object
 * @param {*} val The value of the current property, used for type
 *    detection
 */
nclosure.genexterns.prototype.writePropImpl_ =
    function(prefix, prop, isFunction, isObject, val) {
  if (this.isDone_(prop)) { return; }
  var type = (prefix ? prefix + '.' : '') + prop;
  var typeAndVar = type.indexOf('.') < 0 ? ('var ' + type) : type;

  var desc;
  if (isFunction) {
    desc = '/**\n * @type {Function}\n */\n' + typeAndVar;
  } else { desc = typeAndVar; }

  if (isFunction) {
    desc += ' = function() {};';
  } else {
    desc += ';';
  }
  this.buffer_.push(desc);
  if (isObject) {
    this.writeObjectProps_(type + '.prototype', val);
  }
};


/**
 * @private
 * @param {string} name This is the object, nanmespace or property name to
 *    check if it has already been processed
 * @return {boolean} Wether the specified 'name' has already been processed.
 */
nclosure.genexterns.prototype.isDone_ = function(name) {
  if (this.done_[name]) { return true; }
  this.done_[name] = 1;

  return false;
};

new nclosure.genexterns();
