
goog.provide('nclosure.gennode.type');

/**
 * @fileoverview Type metadata for closure generated node libs.
 *
 * Note: This class is used by nclosure.gennode.gennode which is the entry
 * point to this application.
 *
 * @author guido@tapia.com.au (Guido Tapia)
 */

/**
 * @constructor
 * @param {string} type The namespace.
 * @param {string} name The name of this type.
 * @param {string} desc The description of this type.
 */
nclosure.gennode.type = function(type, name, desc) {
  if (!type) throw new Error('type is required');

  this.type = type;
  this.name = name;
  this.desc = desc;
};


/**
 * @return {string} A closure annotation param description of this type.
 */
nclosure.gennode.type.prototype.toParamString = function() {
  var str = '@param {' + this.type + '} ' + this.name;
  if (this.desc) str += ' ' + this.desc;
  return str;
};


/**
 * @return {string} A closure annotation type description of this type.
 */
nclosure.gennode.type.prototype.toTypeString = function() {
  var str = '@type {' + this.type + '}';
  if (this.desc) str += ' ' + this.desc;
  return str;
};


/**
 * @return {string} A closure annotation return description of this type.
 */
nclosure.gennode.type.prototype.toReturnString = function() {
  var str = '@return {' + this.type + '}';
  if (this.desc) str += ' ' + this.desc;
  return str;
};
