
/**
 * @fileoverview This file represents the metadata of a closre class.  It
 * provides helpers to generate string representation of this class also.
 *
 * Note: This class is used by nclosure.gennode.gennode which is the entry
 * point to this application.
 *
 * @author guido@tapia.com.au (Guido Tapia)
 */
goog.provide('nclosure.gennode.clazz');

goog.require('goog.array');
goog.require('goog.string');

goog.require('nclosure.gennode.type');



/**
 * @constructor
 * @param {string} name The name of this class.
 * @param {string=} overview The fileOvervio of the class.
 * @param {Array.<nclosure.gennode.type>=} requireNamespaces The namespaces required
 *    by this class.
 */
nclosure.gennode.clazz = function(name, overview, requireNamespaces) {

  /**
   * @private
   * @type {string}
   */
  this.clazzName_ = name;

  /**
   * @private
   * @type {Array.<string>}
   */
  this.clazzNameParts_ = this.clazzName_.split('.');

  /**
   * @type {string}
   */
  this.nodeRequire = 'require("' +
      this.clazzNameParts_[this.clazzNameParts_.length - 1] + '")';

  /**
   * @private
   * @type {string|undefined}
   */
  this.overview_ = overview;

  /**
   * @private
   * @type {Array.<nclosure.gennode.type>|undefined}
   */
  this.requireNamespaces_ = requireNamespaces;

  /**
   * @private
   * @type {string}
   */
  this.constructor_ = '';

  /**
   * @private
   * @type {string}
   */
  this.namespace_ = '';

  /**
   * @private
   * @type {Array.<string>}
   */
  this.attributes_ = [];

  /**
   * @private
   * @type {Array.<string>}
   */
  this.functions_ = [];

  /**
   * @private
   * @type {Array.<string>}
   */
  this.requires_ = [];
};


/**
 * @param {string} name The name of this namespace.
 * @param {string} desc The description of this namespace.
 */
nclosure.gennode.clazz.prototype.createNamespace = function(name, desc) {
  var jsdoc = ['@name ' + name, '@namespace'];
  if (desc) jsdoc.push(desc);
  this.namespace_ = nclosure.gennode.clazz.buildJSDoc_(jsdoc);

};


/**
 * @param {string} desc The description of this constructor.
 * @param {Array.<nclosure.gennode.type>=} args Args to this constructor.
 * @param {boolean=} priv Wether the constructor is private.
 */
nclosure.gennode.clazz.prototype.createConstructor = function(desc, args, priv) {
  if (this.constructor_)
    throw new Error('A class can only have one constructor');
  var jsdoc = [];
  if (priv) jsdoc.push('@private');
  if (desc) jsdoc.push(desc);
  if (args) goog.array.forEach(args, function(t) {
    jsdoc.push(typeof(t) === 'string' ? t : t.toParamString());
  });
  jsdoc.push('@constructor');
  // TODO support function args to constructor
  this.constructor_ = nclosure.gennode.clazz.buildJSDoc_(jsdoc) +
      '\n' + this.clazzName_ + ' = function() {};';

};


/**
 * @param {string} type The type that this class depends on.  Will be
 *    required. Safe to call multiple times.
 */
nclosure.gennode.clazz.prototype.addRequires = function(type) {
  if (this.requires_.indexOf(type) >= 0) return;
  this.requires_.push(type);
};


/**
 * @param {string} type The type of this attribute.
 * @param {string} name The attribute name.
 * @param {string} desc A description of this attribute.
 * @param {boolean} isStatic wether this attribute is a static attribute (or
 *    else a class attribute).
 */
nclosure.gennode.clazz.prototype.addAttr = function(type, name, desc, isStatic) {
  var jsdoc = [];
  if (desc) jsdoc.push(desc);
  jsdoc.push('@type {' + type + '|null}');
  var attr = nclosure.gennode.clazz.buildJSDoc_(jsdoc) + '\n' + this.clazzName_;
  if (!isStatic) attr += '.prototype';
  attr += ('.' + name + ' = null;');
  this.attributes_.push(attr);
};


/**
 * @param {string} name The function name.
 * @param {string} desc A description of this function.
 * @param {Array.<nclosure.gennode.type>} args Args to this function.
 * @param {nclosure.gennode.type} returnType The return type of this function.
 * @param {boolean} isStatic wether this function is a static attribute (or
 *    else a class attribute).
 */
nclosure.gennode.clazz.prototype.addFunct =
    function(name, desc, args, returnType, isStatic) {
  var jsdoc = [];
  if (desc) jsdoc.push(desc);
  if (args) goog.array.forEach(args, function(a) {
    jsdoc.push(a.toParamString());
  });
  if (returnType) jsdoc.push(returnType.toReturnString());
  var funct = nclosure.gennode.clazz.buildJSDoc_(jsdoc) + '\n' +
      this.clazzName_ + '.';
  if (!isStatic) funct += 'prototype' + '.';
  funct += name + ' = function(';

  if (args) goog.array.forEach(args, function(a, idx) {
    if (idx > 0) funct += ', ';
    funct += a.name;
  });
  funct += ') {\n  return ' + this.clazzName_ + '.core_.' + name + '(';
  if (args) goog.array.forEach(args, function(a, idx) {
    if (idx > 0) funct += ', ';
    funct += a.name;
  });
  funct += ');\n};';
  this.functions_.push(funct);
};


/**
 * @private
 * @param {Array.<string>} parts The lines of this jsdoc.
 * @return {string} The jsdoc.
 */
nclosure.gennode.clazz.buildJSDoc_ = function(parts) {
  return '/**\n * ' + parts.join('\n * ') + '\n */';
};


/**
 * @override
 * @return {string} The string representation of this class ready to be
 *  written to disc.
 */
nclosure.gennode.clazz.prototype.toString = function() {
  var buffer = [];
  if (this.namespace_) buffer.push(this.namespace_);

  buffer.push('\ngoog.provide("' + this.clazzName_ + '");\n');
  if (this.overview_) {
    buffer.push(
        nclosure.gennode.clazz.buildJSDoc_(['@fileOverview ' + this.overview_]));
    buffer.push('');
  }


  goog.array.forEach(this.requires_, function(r) {
    buffer.push('goog.require("' + r + '");');
  });
  if (this.requires_.length > 0) {
    buffer.push('');
  }

  if (this.constructor_) {
    buffer.push(this.constructor_);
    buffer.push('');
  }

  goog.array.forEach(this.attributes_, function(a) {
    buffer.push(a.toString());
    buffer.push('');
  });
  goog.array.forEach(this.functions_, function(f) {
    buffer.push(f.toString());
    buffer.push('');
  });
  buffer.push(nclosure.gennode.clazz.CORE_PREFIX_ + this.clazzName_ +
      '.core_ = ' + this.nodeRequire + ';');
  // Remove all trailing whitespaces
  return goog.array.map(buffer.join('\n').split('\n'), goog.string.trimRight).
      join('\n');
};


/**
 * @private
 * @type {string}
 * const
 */
nclosure.gennode.clazz.CORE_PREFIX_ = '\n/**\n * @private\n * @type {*}\n */\n';
