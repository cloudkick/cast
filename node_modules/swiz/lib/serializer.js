/*
 *  Copyright 2011 Rackspace
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

/* @fileOverview swiz is the serialization framework, built on Lucy's
 *   awesome python-esque version of things.... but for node.js
 *
 *  Major design goals are:
 *  * Allow us to support multiple formats (e.g. JSON & XML)
 *  * Be node.js-esque.
 *  * Not block especially frequently.
 *
 * Writing without a XML generator pimpy thingie because most of them
 * looked to be too much of a pain in the ass.
 *
 * Things that it doesn't presently do:
 * * Prevent you from using clearly-illegal names for things.
 * * Caching
 * * Pagination (this is regarded as a feature, not a bug)
 * * It doesn't try to remap returned arrays or hashes
 * * Probably some other things...
 */

// Required libs:
var async = require('async');


/**
 * The constructor for the swiz class
 * @constructor
 *
 * Notes about the data def.
 *
 * It's first a set of object type definitions.
 *
 * Each object type definition is a list of slots, which is a pair
 * of name and an object containing the metainformation.
 *
 * The metainformation is free-form.  In a DRY fashion, it'll assume
 * that the name is the name of the object's variable.  If it isn't, you
 * can use 'src' to retrieve something else.
 *
 * 'type' is the type (I use thrift's format), 'desc' means the description.
 * These are for making things self-describing down the road.
 *
 * @param {!Object} defs data def.
 */

function Swiz(defs) {
  this.defs = defs;
}


/** Controls if you want to use JSON or XML (or, for that matter, any other
  * weird serialization format people might invent to torment you with)
  *
  * @enum {number}
  */
exports.SERIALIZATION = {
  SERIALIZATION_JSON: 0,
  SERIALIZATION_XML: 1
};


/** Escape an XML string.
 *
 * @param {string} str string to be escaped.
 * @return {string} entity-replaced version of the string.
 */
Swiz.prototype.xmlEscapeString = function(str) {
  str = str.replace(/&/g, '&amp;');
  str = str.replace(/</g, '&lt;');
  str = str.replace(/>/g, '&gt;');
  return str;
};


/**
 * Given a datastructure supported by Swiz, convert it into an Object that
 * can be serialized directly to JSON, or to XML using Swiz's serializeXml
 * method.
 *
 * @param {object} obj The datastructure to be converted.
 * @param {function} callback A callback fired with (err, result).
 */
Swiz.prototype.buildObject = function(obj, callback) {
  var self = this;
  var stype, def, result;

  // Call the function and recurse on the value passed to the callback
  if (obj instanceof Function) {
    obj(function(err, value) {
      if (err) {
        callback(err);
      } else {
        self.buildObject(value, callback);
      }
    });
  }

  // Recurse onto every element of an array
  else if (obj instanceof Array) {
    function iterArr(item, callback) {
      self.buildObject(item, callback);
    }

    async.map(obj, iterArr, callback);
  }

  // Recurse onto each property named in the definition
  else if (obj instanceof Object) {
    stype = obj.getSerializerType();
    def = this.defs[stype];
    result = {};
    Object.defineProperty(result, 'serializerType', {
      value: stype,
      enumerable: false
    });

    if (!def) {
      callback(new Error('No definition for this type; no way to serialize'));
      return;
    }

    function iterObj(item, callback) {
      var k;
      var prop = item[1];
      var dst = item[0];
      var src = prop.src || dst;

      if (prop.enumerated) {
        for (k in prop.enumerated) {
          if (prop.enumerated[k] === obj[src]) {
            result[dst] = k;
            callback();
            return;
          }
        }
      }

      self.buildObject(obj[src], function(err, value) {
        result[dst] = value;
        callback(err);
      });
    }

    async.forEach(def, iterObj, function(err) {
      callback(err, result);
    });
  }

  // Simple value, pass it back
  else {
    callback(null, obj);
  }
};


Swiz.prototype._startTag = function(name) {
  if (name) {
    return '<' + name + '>';
  } else {
    return '';
  }
};


Swiz.prototype._endTag = function(name) {
  if (name) {
    return '</' + name + '>';
  } else {
    return '';
  }
};


Swiz.prototype._serializeXml = function(obj, key) {
  var i, def, stype, item, src, result;

  // Treat each member of an array as a separate property with the same key
  if (obj instanceof Array) {
    result = '';
    for (i = 0; i < obj.length; i++) {
      result += this._serializeXml(obj[i], key);
    }
    return result;
  }

  // Look up object definitions, serialize each defined property
  else if (obj instanceof Object) {
    def = this.defs[obj.serializerType];
    if (!def) {
      throw new Error('No definition for this type; unable to serialize');
    }

    stype = this.xmlEscapeString(obj.serializerType);

    result = this._startTag(key) + this._startTag(stype);

    for (i = 0; i < def.length; i++) {
      item = def[i];
      src = item[0];
      result += this._serializeXml(obj[src], this.xmlEscapeString(src));
    }

    return result + this._endTag(stype) + this._endTag(key);
  }

  // Serialize individual values
  else {
    return this._startTag(key) + this.xmlEscapeString(obj.toString()) + this._endTag(key);
  }
};


/**
 * Convert an "object" constructed by buildObject to JSON. Currently this
 * simply calls JSON.stringify() on the object.
 */
Swiz.prototype.serializeJson = function(obj) {
  return JSON.stringify(obj);
};


/**
 * Convert an "object" constructed by buildObject to XML. If the object is an
 * Array it will be placed within <group>...</group> tags.
 *
 * @param {object|array} obj The object to be serialized.
 * @returns {string}
 */
Swiz.prototype.serializeXml = function(obj) {
  if (obj instanceof Array) {
    return '<?xml version="1.0" encoding="UTF-8"?>' +
        this._startTag('group') +
        this._serializeXml(obj, null) +
        this._endTag('group');
  } else {
    return '<?xml version="1.0" encoding="UTF-8"?>' +
        this._serializeXml(obj, null);
  }
};


/** Serialize function
  *
  * This is your primary API.  It will look through your pre-set
  * definition structure and try to "do the right thing" as necessary.
  *
  * Your object needs to have a getSerializerType() method so
  * it can know how to serialize it (so that any number of "node"
  * objects can be serialized as a Node).
  *
  * The individual slots (functions or variables) can be node-style
  * callbacks, single objects, arrays, or objects.  It will try to
  * "do the right thing"
  *
  * Version numbers are presently ignored.
  *
  * @param {enum} mode The mode of serialization.
  * @param {number} version The version number.
  * @param {Object|Array} obj The object to be serialized.
  * @param {function} callback The callback to use.
  */
Swiz.prototype.serialize = function(mode, version, obj, callback) {
  var self = this;

  this.buildObject(obj, function(err, result) {
    if (err) {
      callback(err);
      return;
    }

    if (mode === exports.SERIALIZATION.SERIALIZATION_XML) {
      callback(null, self.serializeXml(result));
    } else {
      callback(null, self.serializeJson(result));
    }
  });
};


/**
 * The swiz class
 */
exports.Swiz = Swiz;
