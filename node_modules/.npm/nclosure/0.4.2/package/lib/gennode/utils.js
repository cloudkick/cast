

/**
 * @fileoverview Utilties and constatnts used by both processor.js and
 * gennode.js.
 *
 * @author guido@tapia.com.au (Guido Tapia)
 */

goog.provide('nclosure.gennode.utils');


/**
 * @const
 * @type {string}
 */
nclosure.gennode.utils.WRAPPERS_DIR = require('path').resolve(
    __dirname, '../third_party/node');


/**
 * @private
 * @const
 * @type {string}
 */
nclosure.gennode.utils.NODE_DIR_ = require('path').resolve(
    __dirname, '../../../../lib/node/');


/**
 * @private
 * @const
 * @type {string}
 */
nclosure.gennode.utils.NODE_LIB_DIR_ = nclosure.gennode.utils.NODE_DIR_ + '/lib/';


/**
 * @private
 * @const
 * @type {string}
 */
nclosure.gennode.utils.NODE_DOC_DIR_ = nclosure.gennode.utils.NODE_DIR_ + '/doc/api/';


/**
 * @private
 * @const
 * @type {Object.<Object>}
 */
nclosure.gennode.utils.REQUIRED_GLOBALS_ = {
  global: global,
  require: require,
  process: process,
  module: module,
  __filename: __filename,
  __dirname: __dirname
};



/**
 * @param {string} clazz The class name.
 * @param {string=} member The member name.
 * @return {string} The id to uniquely identify the class and the member.
 */
nclosure.gennode.utils.getClassAndMemberID = function(clazz, member) {
  return clazz + '.' + (member || '');
};

