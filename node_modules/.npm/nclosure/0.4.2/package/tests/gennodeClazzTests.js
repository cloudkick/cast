
goog.require('goog.array');
goog.require('goog.testing.jsunit');

goog.require('nclosure.gennode.clazz');
goog.require('nclosure.gennode.type');

var coreprefix = '\n\n\n/**\n * @private\n * @type {*}\n */\n';

function testBuildJSDoc_() {
  assertEquals_('/**\n * test\n */', nclosure.gennode.clazz.buildJSDoc_(['test']));
}

function testEmptyClass() {
  var c = new nclosure.gennode.clazz('ncnode.test.className');
  var exp = '\ngoog.provide("ncnode.test.className");' +
            coreprefix + 'ncnode.test.className.core_ = require("className");';

  assertEquals_(exp, c.toString());
}

function testEmptyClassWithOverview() {
  var c = new nclosure.gennode.clazz('ncnode.test.className', 'foo');
  var exp = '\ngoog.provide("ncnode.test.className");\n\n/**\n' +
            ' * @fileOverview foo\n */' +
      coreprefix + 'ncnode.test.className.core_ = require("className");';
  assertEquals_(exp, c.toString());
}

function testConstructorWithNoDescAndNoArgs() {
  var c = new nclosure.gennode.clazz('ncnode.test.className');
  c.createConstructor();
  assertEquals_('/**\n * @constructor\n' +
                ' */\nncnode.test.className = function() {};', c.constructor_);
}

function testConstructorWithNoDesc() {
  var c = new nclosure.gennode.clazz('ncnode.test.className');
  c.createConstructor('desc');
  assertEquals_('/**\n * desc\n * @constructor\n */\n' +
                'ncnode.test.className = function() {};', c.constructor_);
}

function testConstructorWithArgs() {
  var c = new nclosure.gennode.clazz('ncnode.test.className');
  c.createConstructor(null, [
    new nclosure.gennode.type('type.ns', 'arg1'),
    new nclosure.gennode.type('type.ns2', 'arg2', 'desc')
  ]);
  assertEquals_('/**\n * @param {type.ns} arg1' +
      '\n * @param {type.ns2} arg2 desc\n * @constructor\n */\n' +
      'ncnode.test.className = function() {};', c.constructor_);
}

function testConstructorWithDescAndArgs() {
  var c = new nclosure.gennode.clazz('ncnode.test.className');
  c.createConstructor('desc', [
    new nclosure.gennode.type('type.ns', 'arg1')
  ]);
  assertEquals_('/**\n * desc\n' +
                ' * @param {type.ns} arg1\n * @constructor\n */\n' +
                'ncnode.test.className = function() {};',
      c.constructor_);
}

function testAddAttribute() {
  var c = new nclosure.gennode.clazz('c');
  var exp = '\ngoog.provide("c");\n' +
            '\n/**\n * @type {type.ns|null}\n */\nc.prototype.attr1 = null;' +
            coreprefix + 'c.core_ = require("c");';
  c.addAttr('type.ns', 'attr1');
  assertEquals_(exp, c.toString());
}

function testAddMultipleAttribute() {
  var c = new nclosure.gennode.clazz('c');
  var exp = '\ngoog.provide("c");\n' +
            '\n/**\n * @type {type.ns|null}\n */\nc.prototype.attr1 = null;\n' +
            '\n/**\n * desc\n * @type {type.ns2|null}\n */\nc.prototype.attr2 = null;\n' +
            '\n/**\n * desc3\n * @type {type.ns3|null}\n */\nc.attr3 = null;' +
            coreprefix + 'c.core_ = require("c");';
  c.addAttr('type.ns', 'attr1');
  c.addAttr('type.ns2', 'attr2', 'desc');
  c.addAttr('type.ns3', 'attr3', 'desc3', true);
  assertEquals_(exp, c.toString());
}

function testAddFunct() {
  var c = new nclosure.gennode.clazz('c');
  var exp = '\ngoog.provide("c");\n' +
            '\n/**\n *\n */\nc.prototype.functName = function() {' +
            '\n  return c.core_.functName();' +
            '\n};' +
            coreprefix + 'c.core_ = require("c");';
  c.addFunct('functName');
  assertEquals_(exp, c.toString());
}

function testAddFuncts() {
  var c = new nclosure.gennode.clazz('c');
  var exp = '\ngoog.provide("c");\n' +

            '\n/**\n *\n */\nc.prototype.functName = function() {' +
            '\n  return c.core_.functName();' +
            '\n};\n' +

            '\n/**\n * desc2\n */\nc.prototype.functName2 = function() {' +
            '\n  return c.core_.functName2();' +
            '\n};\n' +

            '\n/**\n * desc3\n * @return {ret.type}\n */\n' +
            'c.prototype.functName3 = function() {' +
            '\n  return c.core_.functName3();' +
            '\n};\n' +

            '\n/**\n * @param {type.ns} arg1\n */\nc.prototype.functName4 = ' +
              'function(arg1) {' +
            '\n  return c.core_.functName4(arg1);' +
            '\n};\n' +

            '\n/**' +
              '\n * @param {type.ns} arg1' +
              '\n * @param {type.ns2} arg2 desc' +
              '\n * @return {ret.type5}' +
              '\n */\nc.functName5 = ' +
              'function(arg1, arg2) {' +
            '\n  return c.core_.functName5(arg1, arg2);' +
            '\n};' +

            coreprefix + 'c.core_ = require("c");';

  c.addFunct('functName');
  c.addFunct('functName2', 'desc2');
  c.addFunct('functName3', 'desc3', null, new nclosure.gennode.type('ret.type'));
  c.addFunct('functName4', null, [new nclosure.gennode.type('type.ns', 'arg1')]);
  c.addFunct('functName5', null, [
    new nclosure.gennode.type('type.ns', 'arg1'),
    new nclosure.gennode.type('type.ns2', 'arg2', 'desc')
  ], new nclosure.gennode.type('ret.type5'), true);

  assertEquals_(exp, c.toString());
}


function testNodeRequire() {
  var c = new nclosure.gennode.clazz('c');
  c.nodeRequire = 'alternateInitialisation()';
  var exp = '\ngoog.provide("c");' +
            coreprefix + 'c.core_ = alternateInitialisation();';
  assertEquals_(exp, c.toString());
}

function assertEquals_(exp, actual) {
  // console.error(exp.split('\n'));
  // console.error(actual.split('\n'));
  assertEquals(exp, actual);
}
