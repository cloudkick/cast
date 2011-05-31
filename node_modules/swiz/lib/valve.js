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

/* @fileOverview a node-validator wrapper to allow us to build validation
 * objects.
 *
 * A validation check needs the schema of the object under validation, and the
 * object being validated. The schema consists of a key/value pair, where:
 *
 *   key: the field name
 *   value: valve object validation ruleset for a specified key
 *
 * validate.check() never throws an exception. The return value is an object
 * containing:
 *
 * rv = {
 *   cleaned = {}
 *   is_valid = true/false
 *   errors = null or {msg}
 * }
 *
 * The 'cleaned' member contains a sanitized version of the object under
 * validation. Types will be optionally converted to native javascript types if
 * the validation rules specify the conversion.
 *
 * example:
 *
 *  var schema = {
 *    a: new V().equals(123)
 *  };
 *
 *  var rv = validate.check(schema, {a: 123});
 *  if (rv.is_valid === true) {
 *    operate_on(rv.cleaned);
 *  }
 *
 *
 * Design:
 *
 * _ops is an array of OPERATIONS to perform on validation. rules are
 * pushed onto _ops on construction to define the ruleset.
 */


var net = require('net');

var Validator = require('validator').Validator;
var check = require('validator').check;
var sanitize = require('validator').sanitize;
var ipv6 = require('ipv6').v6;

var Cidr = require('./cidr').CIDR;


var ipBlacklist =
    {
      4: [
        new Cidr('192.168.0.0/16'),
        new Cidr('172.16.0.0/12'),
        new Cidr('10.0.0.0/8'),
        new Cidr('224.0.0.0/4'),
        new Cidr('127.0.0.0/8')
      ],
      6: [
        new Cidr('fc00::0/7'),
        new Cidr('ff00::0/8'),
        new Cidr('ff00::0/12')
      ]
    };


/** Filter an IP and normalize it
 *
 * @param {integer} vr IP version.
 * @param {integer} sub subnet.
 * @return {bool} normalized IP version.
 */
var checkSizeOfInternets = function(vr, sub) {
  return ((vr === 4 && sub >= 32) || (vr === 6 && sub >= 128));
};


/** monkeypatch for blacklist
 *
 * @return {object} this for chaining.
 */
Validator.prototype.notIpBlacklisted = function() {
  var vr = net.isIP(this.str), i, l, ar;
  if (vr === 0) {
    this.error(this.msg || 'Invalid IP');
  } else {
    ar = ipBlacklist[vr];
    l = ar.length;
    for (i = 0; i < l; i += 1) {
      if (ar[i].isInCIDR(this.str)) {
        this.error(this.msg || 'IP is blacklisted');
      }
    }
  }
  return this;
};


/** monkeypatch for CIDR validation in Validator lib
 *
 * @return {object} this for chaining.
 */
Validator.prototype.isCIDR = function() {
  if (this.str === undefined) {
    return this;
  }
  var arr = this.str.split('/'), vr, sub;
  if (arr.length === 2) {
    vr = net.isIP(arr[0]);
    sub = parseInt(arr[1], 10);
    if (checkSizeOfInternets(vr, sub)) {
      this.error(this.msg || 'Size of subnet exceeds size of internet');
    } else if (vr === 0) {
      this.error(this.msg || 'Invalid IP');
    }
  } else {
    this.error(this.msg || 'Not a CIDR');
  }
  return this;
};


/** Filter an IP and normalize it
 *
 * @param {string} fr IP to be normalized.
 * @return {string} normalized IP version.
 */
var filterIp = function(fr) {
  if (net.isIP(fr) === 6) {
    var addr = new ipv6.Address(fr);
    return addr.canonical_form();
  } else {
    return fr;
  }
};


/** Filter an CIDR and normalize it
 *
 * @param {string} fr CIDR to be normalized.
 * @return {string} normalized CIDR version.
 */
var filterCIDR = function(fr) {
  var arr = fr.split('/');
  return (filterIp(arr[0]) + '/' + arr[1]);
};


/**
 * custom typeOf function to return an array or null type
 * @param {value} value an object.
 * @return {String} 'array' or 'null'.
 */
function typeOf(value) {
  var t = typeof(value);
  if (t === 'object') {
    if (value) {
      if (value instanceof Array) {
        t = 'array';
      }
    }
    else {
      t = 'null';
    }
  }
  return t;
}


/*
 * Validate
 *
 * Lowest level function to perform validation. If the test doesn't return
 * sanitized data, then reset to the passed in data variable. It saves some code
 * for return statements.
 */
var validate = function(V, data) {
  var i, tmp = data, sanitized;

  // handle optional fields
  if (V._optional && data === null) {
    return data;
  }

  for (i = 0; i < V._ops.length; i++) {
    sanitized = V._ops[i].test.func(V._ops[i], tmp);
    tmp = sanitized || data;
  }
  return tmp;
};


var validateNotPresent = function(V) {
  var i, sanitized;
  for (i = 0; i < V._ops.length; i++) {
    if (V._ops[i].test.empty === false) {
      return false;
    }
  }
  return true;
};


/*
 * Validate Schema
 *
 * A schema is a map between keys and validation chains.
 * @param {boolean} full true indicates validation is performed against all fields in the schema. false indicates
 *                       validation is performed against all fields in the object parameter.
 */
var validate_schema = function(schema, object, full) {
  var cleaned = {}, data, propname, sanitized;

  for (propname in schema) {
    /* allow for incremental updates by checking to see if the schema and the
     * object under validation contains the propname.
     */
    if (object.hasOwnProperty(propname)) {
      data = object[propname];

      if (typeof schema[propname] === 'object' && !schema[propname].hasOwnProperty('_klass')) {
        cleaned[propname] = validate_schema(schema[propname], object[propname], full);
      }
      else {
        /* validate the chain, on error throw a decorated exception */
        try {
          sanitized = validate(schema[propname], data);
        } catch (e) {
          throw ({'error': e, 'field': propname});
        }
        /* place the sanitized data, if any, inside a cleaned object */
        cleaned[propname] = sanitized;
      }
    } else if (full) {
      // only validate against schema fields during full validation.
      if (!validateNotPresent(schema[propname])) {
        throw propname + ' is not present';
      }
    }
  }

  return cleaned;
};


/**
 * Performs full or partial validatio and cleanup on supplied object.
 * @param {Object} schema schema to validate against.
 * @param {Object} object hash containing values to validate.
 * @param {boolean} full flag for full or partial validation (all or some fields).
 * @return {Value} hash containing cleaned object and some meta properties.
 */
var sanitize_obj = function(schema, object, full) {
  var rv = {};

  rv.is_full = full;
  try {
    rv.cleaned = validate_schema(schema, object, full);
    rv.is_valid = true;
    rv.errors = null;
    if (!full) {
      rv.key = object.key;
    }
  } catch (e) {
    rv.cleaned = null;
    rv.is_valid = false;
    rv.errors = {msg: e};
  }

  return rv;
};

var help_string = function(V) {
  var rv = [], str, i;
  for (i = 0; i < V._ops.length; i++) {
    if (typeOf(V._ops[i].test.help) === 'function') {
      str = V._ops[i].test.help(V._ops[i]);
    }
    else {
      str = V._ops[i].test.help;
    }
    rv.push(str);
  }
  return rv;
};


var help_from_schema = function(schema) {
  var rv = {}, propname;

  for (propname in schema) {
    if (schema.hasOwnProperty(propname)) {
      rv[propname] = help_string(schema[propname]);
    }
  }

  return rv;
};



/** Valve constructor
 * @constructor
 */
function Valve() {
  this._ops = [];
  this._optional = false;
  this._klass = 'valve';
}



/* validation operations */
var OPERATIONS = {};


/**
 * Integer Validation
 */
OPERATIONS.INT = {
  func: function(op, data) { check(data).isInt(); },
  help: 'Integer'
};


/**
 * Range Validation
 */
OPERATIONS.RANGE = {
  func: function(op, data) {
    if (data < op.min || data > op.max) {
      throw 'Out of Range [' + op.min + ',' + op.max + ']';
    }
  },
  help: function(op) {
    return 'Range [' + op.min + ',' + op.max + ']';
  }
};


/**
 * Email Validation
 */
OPERATIONS.EMAIL = {
  func: function(op, data) { check(data).isEmail(); },
  help: 'Email Address'
};


/**
 * Url Validation
 */
OPERATIONS.URL = {
  func: function(op, data) { check(data).isUrl(); },
  help: 'URL'
};


/**
 * IP Validation
 */
OPERATIONS.IP = {
  /**
   * @return {String} the validated object.
   */
  func: function(op, data) {
    if (data === null) {
      return data;
    }
    check(data).isIP();
    var t = filterIp(data);
    return t;
  },
  help: 'IPv4 or IPv6 Address'
};


/**
 * IP Validation against a blacklist
 */
OPERATIONS.IP_BLACKLIST = {
  func: function(op, data) {
    check(data).notIpBlacklisted();
  },
  help: 'IPv4 or IPv6 Address not blacklisted'
};


/**
 * IP Validation
 */
OPERATIONS.CIDR = {
  /**
   * @return {String} the validated object.
   */
  func: function(op, data) {
    check(data).isCIDR();
    var t = filterCIDR(data);
    return t;
  },
  help: 'IPv4 or IPv6 CIDR'
};


/**
 * Alpha Validation
 */
OPERATIONS.ALPHA = {
  func: function(op, data) { check(data).isAlpha(); },
  help: 'Alphabetic [A-Z,a-z]'
};


/**
 * Alpha Numeric Validation
 */
OPERATIONS.ALPHANUMERIC = {
  func: function(op, data) { check(data).isAlphanumeric(); },
  help: 'Alpha Numeric [A-Z,a-z,0-9]'
};


/**
 * Numeric Validation
 */
OPERATIONS.NUMERIC = {
  func: function(op, data) { check(data).isNumeric(); },
  help: 'Numeric Only [0-9]'
};


/**
 * Lowercase Validation
 */
OPERATIONS.LOWERCASE = {
  func: function(op, data) { check(data).isLowercase(); },
  help: 'Lowercase'
};


/**
 * Uppercase Validation
 */
OPERATIONS.UPPERCASE = {
  func: function(op, data) { check(data).isUppercase(); },
  help: 'Uppercase'
};


/**
 * Decimal Validation
 */
OPERATIONS.DECIMAL = {
  func: function(op, data) { check(data).isDecimal(); },
  help: 'Decimal'
};


/**
 * Float Validation
 */
OPERATIONS.FLOAT = {
  func: function(op, data) { check(data).isFloat(); },
  help: 'Float'
};


/**
 * Not NULL Validation
 */
OPERATIONS.NOTNULL = {
  func: function(op, data) { check(data).notNull(); },
  help: 'Not Null',
  empty: false
};


/**
 * Null Validation
 */
OPERATIONS.NULL = {
  func: function(op, data) { check(data).isNull(); },
  help: 'Null'
};


/**
 * Not Empty Validation
 */
OPERATIONS.NOTEMPTY = {
  func: function(op, data) { check(data).notEmpty(); },
  help: 'not empty',
  empty: false
};


/**
 * Length Validation
 */
OPERATIONS.LEN = {
  func: function(op, data) { check(data).len(op.min, op.max); },
  help: function(op) {
    if (op.max) {
      return 'length [' + op.min + ', ' + op.max + ']';
    }
    return 'length [' + op.min + ']';
  }
};


/**
 * Equals Validation
 */
OPERATIONS.EQUALS = {
  func: function(op, data) { check(data).equals(op.arg); },
  help: function(op) { return 'Data == ' + op.arg; }
};


/**
 * Contains Validation
 */
OPERATIONS.CONTAINS = {
  func: function(op, data) { check(data).contains(op.arg); },
  help: function(op) { return 'Must contain ' + op.arg; }
};


/**
 * Not Contains Validation
 */
OPERATIONS.NOT_CONTAINS = {
  func: function(op, data) { check(data).notContains(op.arg); },
  help: function(op) { return 'Must not contain ' + op.arg; }
};


/**
 * Regex Validation
 */
OPERATIONS.REGEX = {
  func: function(op, data) { check(data).regex(op.pattern, op.modifiers); },
  help: function(op) {
    return 'Must match regular expression \'' + op.pattern +
        '\' Modifiers (' + (op.modifiers ? op.modifiers : 'none') + ')';
  }
};


/**
 * Not Regex Validation
 */
OPERATIONS.NOT_REGEX = {
  func: function(op, data) {
    check(data).notRegex(op.pattern, op.modifiers);
  },
  help: function(op) {
    return 'Must not match regular expression \'' + op.pattern +
        '\' (Modifiers=' + (op.modifiers ? op.modifiers : 'none') + ')';
  }
};


/**
 * Array Validation
 */
OPERATIONS.ARRAY = {
  /**
   * @return {Array} the return array contains converted data if requested by
   * the validation object.
   */
  func: function(op, data) {
    if (typeOf(data) !== 'array') {
      throw 'Not an array';
    }
    return data.map(function(element) {
      return validate(op.chain, element);
    });
  },

  /**
   * @return {String} help from subordinate chain.
   */
  help: function(op) {
    return 'array [' + help_string(op.chain).join(',') + ']';
  }
};


/**
 * Array Validation
 */
OPERATIONS.HASH = {
  /**
   * @return {object} the return object contains converted data if required
   *  by the validation object.
   */
  func: function(op, data) {
    var key, hash, vk, vv;
    hash = {};
    if (typeOf(data) !== 'object') {
      throw 'Not a hash';
    }
    for (key in data) {
      if (true) {
        vk = validate(op.chain1, key);
        vv = validate(op.chain2, data[key]);
        hash[vk] = vv;
      }
    }
    return hash;
  },

  /**
   * @return {String} help from subordinate chain.
   */
  help: function(op) {
    return 'hash [' + help_string(op.chain1).join(',') + ',' +
        help_string(op.chain2).join(',') + ']';
  }
};


/**
 * Array Validation
 */
OPERATIONS.ENUMERATED = {
  /**
   * @return {Array} the return array contains converted data if requested by
   * the validation object.
   */
  func: function(op, data) {
    if (op.values.hasOwnProperty(data)) {
      return op.values[data];
    } else {
      throw 'Invalid enum value';
    }
  },

  /**
   * @return {String} help from subordinate chain.
   */
  help: function(op) {
    return 'enum';
  }
};


/**
 * String Validation
 */
OPERATIONS.STRING = {
  func: function(op, data) {
    if (typeOf(data) !== 'string') {
      throw 'Not a string';
    }
  },
  help: 'string'
};


/**
 * Integer Conversion
 * @return {Number} javascript integer.
 */
OPERATIONS.TO_INT = {
  func: function(op, data) { return sanitize(data).toInt(); },
  help: ''
};


/**
 * Float Conversion
 * @return {Number} javascript float.
 */
OPERATIONS.TO_FLOAT = {
  func: function(op, data) { return sanitize(data).toFloat(); },
  help: ''
};


/** convert to float
 *
 * @return {object} this for chaining.
 */
Valve.prototype.toFloat = function() {
  this._ops.push({test: OPERATIONS.TO_FLOAT});
  return this;
};


/** convert to int
 *
 * @return {object} this for chaining.
 */
Valve.prototype.toInt = function() {
  this._ops.push({test: OPERATIONS.TO_INT});
  return this;
};


/** validate integer
 *
 * @return {object} this for chaining.
 */
Valve.prototype.isInt = function() {
  this._ops.push({test: OPERATIONS.INT});
  return this;
};


/** validate email
 *
 * @return {object} this for chaining.
 */
Valve.prototype.isEmail = function() {
  this._ops.push({test: OPERATIONS.EMAIL});
  return this;
};


/** validate url
 *
 * @return {object} this for chaining.
 */
Valve.prototype.isUrl = function() {
  this._ops.push({test: OPERATIONS.URL});
  return this;
};


/** validate alpha
 *
 * @return {object} this for chaining.
 */
Valve.prototype.isAlpha = function() {
  this._ops.push({test: OPERATIONS.ALPHA});
  return this;
};


/** validate IP
 *
 * @return {object} this for chaining.
 */
Valve.prototype.isIP = function() {
  this._ops.push({test: OPERATIONS.IP});
  return this;
};


/** validate IP against a blacklist
 *
 * @return {object} this for chaining.
 */
Valve.prototype.notIpBlacklisted = function() {
  this._ops.push({test: OPERATIONS.IP_BLACKLIST});
  return this;
};


/** validate CIDR
 *
 * @return {object} this for chaining.
 */
Valve.prototype.isCIDR = function() {
  this._ops.push({test: OPERATIONS.CIDR});
  return this;
};


/** validate url
 *
 * @return {object} this for chaining.
 */
Valve.prototype.isAlphanumeric = function() {
  this._ops.push({test: OPERATIONS.ALPHANUMERIC});
  return this;
};


/** validate numeric
 *
 * @return {object} this for chaining.
 */
Valve.prototype.isNumeric = function() {
  this._ops.push({test: OPERATIONS.NUMERIC});
  return this;
};


/** validate lowercase
 *
 * @return {object} this for chaining.
 */
Valve.prototype.isLowercase = function() {
  this._ops.push({test: OPERATIONS.LOWERCASE});
  return this;
};


/** validate uppercase
 *
 * @return {object} this for chaining.
 */
Valve.prototype.isUppercase = function() {
  this._ops.push({test: OPERATIONS.UPPERCASE});
  return this;
};


/** validate decimal
 *
 * @return {object} this for chaining.
 */
Valve.prototype.isDecimal = function() {
  this._ops.push({test: OPERATIONS.DECIMAL});
  return this;
};


/** validate float
 *
 * @return {object} this for chaining.
 */
Valve.prototype.isFloat = function() {
  this._ops.push({test: OPERATIONS.FLOAT});
  return this;
};


/** validate decimal
 *
 * @return {object} this for chaining.
 */
Valve.prototype.notNull = function() {
  this._ops.push({test: OPERATIONS.NOTNULL});
  return this;
};


/** validate decimal
 *
 * @return {object} this for chaining.
 */
Valve.prototype.notEmpty = function() {
  this._ops.push({test: OPERATIONS.NOTEMPTY});
  return this;
};


/** validate length
 *
 * @param {Number} min minimum count.
 * @param {Number} max maximum count (optional).
 * @return {object} this for chaining.
 */
Valve.prototype.len = function(min, max) {
  this._ops.push({test: OPERATIONS.LEN, min: min, max: max});
  return this;
};


/** validate range (inclusive).
 *
 * @param {Number} min minimum.
 * @param {Number} max maximum.
 * @return {object} this for chaining.
 */
Valve.prototype.range = function(min, max) {
  this._ops.push({test: OPERATIONS.RANGE, min: min, max: max});
  return this;
};


/** validate NULL
 *
 * @return {object} this for chaining.
 */
Valve.prototype.isNull = function() {
  this._ops.push({test: OPERATIONS.NULL});
  return this;
};


/** validate equals
 *
 * @param {string} e comparison object.
 * @return {object} this for chaining.
 */
Valve.prototype.equals = function(e) {
  this._ops.push({test: OPERATIONS.EQUALS, arg: e});
  return this;
};


/** validate contains
 *
 * @param {string} c comparison string.
 * @return {object} this for chaining.
 */
Valve.prototype.contains = function(c) {
  this._ops.push({test: OPERATIONS.CONTAINS, arg: c});
  return this;
};


/** validate not-contains
 *
 * @param {string} c comparison string.
 * @return {object} this for chaining.
 */
Valve.prototype.notContains = function(c) {
  this._ops.push({test: OPERATIONS.NOT_CONTAINS, arg: c});
  return this;
};


/** validate regex
 *
 * @param {regex} pattern The pattern for matching.
 * @param {string} modifiers optional regex modifiers.
 * @return {object} this for chaining.
 */
Valve.prototype.is = Valve.prototype.regex = function(pattern, modifiers) {
  this._ops.push({test: OPERATIONS.REGEX, pattern: pattern,
    modifiers: modifiers});
  return this;
};


/** validate not regex
 *
 * @param {regex} pattern The pattern for matching.
 * @param {string} modifiers optional regex modifiers.
 * @return {object} this for chaining.
 */
Valve.prototype.not = Valve.prototype.notRegex = function(pattern, modifiers) {
  this._ops.push({test: OPERATIONS.NOT_REGEX, pattern: pattern,
    modifiers: modifiers});
  return this;
};


/** validate array
 *
 * @param {Object} chain Valve object for validating an array.
 * @return {object} this for chaining.
 */
Valve.prototype.array = function(chain) {
  this._ops.push({test: OPERATIONS.ARRAY, chain: chain});
  return this;
};


/** validate enum
 *
 * @param {Object} values values that the enum can be set to.
 * @return {object} this for chaining.
 */
Valve.prototype.enumerated = function(values) {
  this._ops.push({test: OPERATIONS.ENUMERATED, values: values});
  return this;
};


/** validate hash
 *
 * @param {Object} chain1 Valve object for validating the hash key.
 * @param {Object} chain2 Valve object for validating the hash value.
 * @return {object} this for chaining.
 */
Valve.prototype.hash = function(chain1, chain2) {
  this._ops.push({test: OPERATIONS.HASH, chain1: chain1, chain2: chain2});
  return this;
};


/** validate string
 *
 * @return {object} this for chaining.
 */
Valve.prototype.string = function() {
  this._ops.push({test: OPERATIONS.STRING});
  return this;
};


/** make field optional
 *
 * @return {object} this for chaining.
 */
Valve.prototype.optional = function() {
  this._optional = true;
  return this;
};


/** Retrieve help object for schema
 * @param {Object} schema The schema object.
 * @return {Object} {key: ['Help Array']}.
 */
exports.help = function(schema) {
  return help_from_schema(schema);
};


/**
 * Performs full validation of all fields.
 * @param {Object} schema Schema to be validated against.
 * @param {Object} object The object to validate.
 * @return {Object} return Value containing is_valid, cleaned.
 */
exports.check = function(schema, object) {
  return sanitize_obj(schema, object, true);
};


/**
 * Performs partial evaluation of fields in object.
 * @param {Object} schema Schema to be validated against.
 * @param {Object} object The object to validate. Does not have to contain all fields specified in schema.
 * @return {Object} return Value containing is_valid, cleaned, possibly a key.
 */
exports.checkPartial = function(schema, object) {
  return sanitize_obj(schema, object, false);
};


/**
 * The Valve class
 */
exports.Valve = Valve;


/** Make a valve lookup off of a swiz def
 *
 * As it turns out, swiz and valve view things slightly differently.
 * Swiz should be able to assign a structure to your serialization.
 * And this can sometimes mean that you want things in a particular
 * order.
 *
 * Valve, on the other hand, should never care about order.
 *
 * Thus, here's a function that turns a swiz-style array def into a
 * less verbose valve def.
 *
 * @param {Object} def swiz-style defs.
 * @return {Object} translated structure.
 */
exports.defToValve = function(def) {
  var validity = {}, propname, group, i, l;
  for (propname in def) {
    if (true) { // *sigh* lint
      group = propname;
      l = def[group].length;
      validity[group] = {};
      for (i = 0; i < l; i += 1) {
        if (def[group][i][1].hasOwnProperty('val')) {
          validity[group][def[group][i][0]] = def[group][i][1].val;
        } else if (def[group][i][1].hasOwnProperty('enumerated')) {
          validity[group][def[group][i][0]] =
              new Valve().enumerated(def[group][i][1].enumerated);
        }
      }
    }
  }
  return validity;
};


/**
 * A Valve factory
 * @return {Object} constructed valve object.
 */
exports.V = function() {
  return new Valve();
};
