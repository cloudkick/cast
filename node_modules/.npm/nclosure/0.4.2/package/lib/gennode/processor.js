
/**
 * @fileoverview This file processes an individual node type.  Using the actual
 * object instance returned by require("xxx"), the markdown docs and
 * some additional metadata in typedata.txt we try to generate a wrapper
 * for the type specified in the constructor.
 *
 * Note: This class is used by nclosure.gennode.gennode which is the entry
 * point to this application.
 *
 * @author guido@tapia.com.au (Guido Tapia)
 */

goog.provide('nclosure.gennode.processor');

goog.require('goog.array');

goog.require('nclosure.gennode.utils');
goog.require('nclosure.gennode.clazz');
goog.require('nclosure.gennode.type');



/**
 * @constructor
 * @param {string} name The name of the object/file we are processing.
 * @param {boolean} isNamespace Wether the current type is a namespace.
 * @param {Object} obj An instance of the node object to scrutinize.
 * @param {Object.<string, string>} docs All the documents to search for extra
 *    information.  This is a object name -> documentaiton map.
 * @param {Object.<string, string>} typedata All the type data information.
 * @param {string=} coreRequires If specified will not use the defaule
 *  require('type') to initialise the node object.
 * @param {string=} overrideOverview Override documentation to use for
 *    namespace overview.
 */
nclosure.gennode.processor =
    function(name, isNamespace, obj, docs, typedata, coreRequires, overrideOverview) {
  this.name_ = name.replace('.js', '');
  this.isNamespace_ = isNamespace;
  this.obj_ = obj;
  this.docs_ = docs;
  this.typedata_ = typedata;
  this.class_ = new nclosure.gennode.clazz('node.' + this.name_);
  if (typeof(coreRequires) !== 'string') coreRequires = null;
  this.coreRequires_ = coreRequires || 'require("' + this.name_ + '")';
  this.class_.nodeRequire = this.coreRequires_;
  if (this.isNamespace_) {
    this.class_.createNamespace('node.' + this.name_,
        overrideOverview || this.getClassOverview_());
  } else {
    this.class_.createConstructor(overrideOverview || this.getClassOverview_());
  }
};


/**
 */
nclosure.gennode.processor.prototype.process = function() {
  for (var i in this.obj_) {
    if (i.charAt(0) === '_' || i.charAt(i.length - 1) === '_')
    { continue; } // Ignore privates

    var val = this.obj_[i];
    var isObject = i.charAt(0) === i.charAt(0).toUpperCase() &&
        i.toUpperCase() !== i; // Ignore caps constants
    var isFunction = !isObject && typeof(val) === 'function';
    var className = this.name_ + '.' + i;
    if (isObject) {
      var req = this.coreRequires_ + '.' + i;
      try {
        if (
            className.indexOf('events.EventEmitter') < 0 &&
            className.indexOf('repl.') < 0) {
          val = val();
        }
      } catch (e) {
        console.error('Failed to construct: ' + className + ' e: ' + e.message);
      }
      new nclosure.gennode.processor(className, false, val, this.docs_,
                               this.typedata_, req).
          process();
    } else if (isFunction) {
      this.documentFunction_(i, val);
    } else {
      this.documentAttribute_(i, val);
    }
  }
  nclosure.gennode.processor.dumpClassFile('node.' + this.name_, this.class_);
};


/**
 * Writes the wrapper file to disk
 * @param {string} name The name of the class to write out.
 * @param {nclosure.gennode.clazz} clazz The clas to dump to disk.
 */
nclosure.gennode.processor.dumpClassFile = function(name, clazz) {
  require('fs').writeFileSync(
      nclosure.gennode.utils.WRAPPERS_DIR + '/' + name + '.js',
      clazz.toString());
};


/**
 * Adds the funciton description to this class descriptor.
 * @private
 * @param {string} name The name of the function.
 * @param {Function} val The actual value of this function (the function
 *    itself).
 */
nclosure.gennode.processor.prototype.documentFunction_ = function(name, val) {
  if (name === 'throws') return; // keyword
  this.class_.addFunct(name, this.evalFunctionDesc_(name, val),
                       this.evalFunctionArgs_(name, val),
                       this.evalFunctionReturnType_(name, val),
                       this.isNamespace_);
};


/**
 * Adds the attribute description to this class descriptor.
 * @private
 * @param {string} name The name of the attribute.
 * @param {*} val The actual value of thisattribute.
 */
nclosure.gennode.processor.prototype.documentAttribute_ = function(name, val) {
  this.class_.addAttr(this.evalAttrType_(name, val), name,
                      this.evalAttrDesc_(name, val),
                      this.isNamespace_);
};


/**
 * Attempts to work out the args of the specified function
 * @private
 * @param {string} name The name of the function.
 * @param {*} val The actual value of this function.
 * @return {Array.<nclosure.gennode.type>} The type of this function args.
 */
nclosure.gennode.processor.prototype.evalFunctionArgs_ = function(name, val) {
  var str = val.toString();
  str = str.substring(str.indexOf('(') + 1);
  str = str.substring(0, str.indexOf(')'));
  var args = [];
  goog.array.forEach(str.split(','), function(arg) {
    arg = goog.string.trim(arg);
    if (!arg) return;
    var optional = arg.indexOf('/*optional*/') >= 0;
    if (optional) { arg = arg.replace('/*optional*/', ''); }
    if (arg.indexOf('/*') >= 0) { arg = arg.substring(0, arg.indexOf('/*')); }
    if (arg.indexOf('*/') >= 0) { arg = arg.substring(0, arg.indexOf('*/')); }
    arg = goog.string.trim(arg);
    args.push(this.getTypeData_(name, arg, optional));
  }, this);
  // TODO: We should look at the typedata file
  // and read any implicitly declared args to this function
  // (like http.Server#listen)
  //
  // if (args.length === 0) { };
  return args;
};


/**
 * Attempts to work out the return type of the specified function
 * @private
 * @param {string} name The name of the function.
 * @param {*} val The actual value of this function.
 * @return {nclosure.gennode.type} The type of this function.
 */
nclosure.gennode.processor.prototype.evalFunctionReturnType_ = function(name, val) {
  return this.getTypeData_(name, 'returns');
};


/**
 * Attempts to work out the type of the specified attribute
 * @private
 * @param {string} name The name of the attribute.
 * @param {*} val The actual value of this attribute.
 * @return {string} The type of this attribute.
 */
nclosure.gennode.processor.prototype.evalAttrType_ = function(name, val) {
  return this.getTypeData_(null, name).type;
};


/**
 * Gets the type data for the specified function and argument
 * @private
 * @param {string?} functionName The name of the funciton.
 * @param {string} argName The name of the function argument or 'returns' for
 *    the returns type.
 * @param {boolean=} optionalOverride If not specified we will try to
 *    determine from the markdown wether this is optional.
 * @return {nclosure.gennode.type} The return type information.
 */
nclosure.gennode.processor.prototype.getTypeData_ =
    function(functionName, argName, optionalOverride) {
  var key = 'node.' + this.name_ + '#';
  if (functionName) { key += functionName + ':'; }
  key += argName;
  var type = this.typedata_[key] || this.evaluateType_(functionName, argName);
  if (!type) return null;
  var idx = type.indexOf(' ');
  var desc = '';
  if (idx >= 0) {
    desc = type.substring(idx + 1);
    type = type.substring(0, idx);
  }

  if (type.indexOf('.') >= 0 &&
      type.indexOf('(') < 0 &&
      type.indexOf('<') < 0 &&
      type.indexOf('{') < 0) { this.class_.addRequires(type); } // Is namespaced
  if (type.indexOf('function(') >= 0) {
    var args = type.substring(type.indexOf('function(') + 9);
    args = args.substring(0, args.indexOf(')'));
    goog.array.forEach(args.split(','), function(a) {
      if (a.indexOf('..') >= 0 || a.indexOf('.') < 0) { return; }
      if (goog.string.endsWith(a, '?') || goog.string.endsWith(a, '=')) {
        a = a.substring(0, a.length - 1);
      }
      this.class_.addRequires(a);
    }, this);
  }

  if (optionalOverride === true && type.indexOf('=') !== type.length - 1) {
    type += '=';
  }

  return new nclosure.gennode.type(type, argName, desc);
};


nclosure.gennode.processor.prototype.evaluateType_ =
    function(functionName, argName) {
  switch (argName) {
    case 'returns': return null; // If no returns specified assume no returns
    case 'message': return 'string';
    case 'err': return 'Error';
    case 'cb':
    case 'callback': return 'function(Error?,...[*]):undefined=';
    case 'operator': return 'function(*,*):boolean';
    case 'actual':
    case 'expected': return '*';
    case 'obj':
    case 'options': return 'Object';
    case 'args': return 'Array.<*>';
    case 'cache':
    case 'encoding': return 'string=';
  }
  if (functionName && functionName.toLowerCase().indexOf('deepequal') >= 0) {
    return 'Object';
  }
  if (argName.toLowerCase().indexOf('ctor') >= 0) { return 'Function'; }
  if (argName.toLowerCase().indexOf('buffer') >= 0) {
    return 'node.buffer.Buffer';
  }
  if (argName.toLowerCase().indexOf('stream') >= 0) {
    return 'node.stream.Stream';
  }
  if (argName.toLowerCase().indexOf('length') >= 0 ||
      argName.toLowerCase().indexOf('size') >= 0 ||
      argName.toLowerCase().indexOf('offset') >= 0 ||
      argName.toLowerCase().indexOf('position') >= 0 ||
      argName.toLowerCase().indexOf('depth') >= 0) {
    return 'number';
  }
  if (argName.indexOf('is') === 0) { return 'boolean'; }

  //console.log('Could not "guess" type (assuming "string") for: ' +
  // this.name_ + '.' + functionName + '#' + argName);
  return 'string';
};


/**
 * Attempts to work out the description of the specified function
 * @private
 * @param {string} name The name of the function.
 * @param {*} val The actual value of this function.
 * @return {string} The description of this function.
 */
nclosure.gennode.processor.prototype.evalFunctionDesc_ = function(name, val) {
  return this.getDocs_(this.name_, name);
};


/**
 * Attempts to work out the description of the specified attribute
 * @private
 * @param {string} name The name of the attribute.
 * @param {*} val The actual value of this attribute.
 * @return {string} The description of this attribute.
 */
nclosure.gennode.processor.prototype.evalAttrDesc_ = function(name, val) {
  return this.getDocs_(this.name_, name);
};


/**
 * @private
 * @return {string} The overview of this class parsed from the markdown node
 *    docs.
 */
nclosure.gennode.processor.prototype.getClassOverview_ = function() {
  var d = this.getDocs_(this.name_);
  return d;
};


/**
 * @private
 * @param {string} clazz The name of the class whose docs we are after.
 * @param {string=} member The name of the class memeber we are after.
 * @return {string} The docs or null for the specified class and member.
 */
nclosure.gennode.processor.prototype.getDocs_ = function(clazz, member) {
  var id = nclosure.gennode.utils.getClassAndMemberID(clazz, member);
  var raw = this.docs_[id];
  return !raw ? raw : raw.replace(/\n/g, '\n * ');
};
