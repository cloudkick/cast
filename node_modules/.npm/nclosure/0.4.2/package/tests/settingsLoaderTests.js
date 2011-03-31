#!/usr/local/bin/node

require('nclosure').nclosure();

goog.require('goog.testing.jsunit');
goog.require('nclosure.settingsLoader');

/**
 * @private
 * @type {nclosure.settingsLoader}
 */
var settingsLoader;

function setUpPage() {
  settingsLoader = /** @type {nclosure.settingsLoader} */ (
    require('../lib/settingsloader').settingsLoader);
};

function testExtendObject() {
  var o1 = {prop1:1}

  assertEquals(2, settingsLoader.extendObject_(o1, {prop1:2}).prop1);
  settingsLoader.extendObject_(o1, {prop2:3});
  assertEquals(2, o1.prop1);
  assertEquals(3, o1.prop2);
  settingsLoader.extendObject_(o1, {});
  assertEquals(2, o1.prop1);
  assertEquals(3, o1.prop2);

  var o1 = {prop:[1]};
  settingsLoader.extendObject_(o1, {prop:[2, 3]});
  assertArrayEquals([1, 2, 3], o1.prop);
};


function testGetPath() {
  assertEquals('/dir/file.ext', settingsLoader.getPath('/dir', 'file.ext'));
  assertEquals('/dir/file.ext', settingsLoader.getPath('/dir/', 'file.ext'));
  assertEquals('/dir/file.ext', settingsLoader.getPath('/dir/', '/file.ext'));
  assertEquals('dir1/dir2/file.ext',
    settingsLoader.getPath('dir1/dir2', '/file.ext'));
};


function testValidateOpsObject_DirectoriesMadeAbsolute() {
  // Mock
  settingsLoader.checkDirExists_ = function() { return true; }

  var settings = {
    additionalDeps: ['relDir1', '/absolute/dir2'],
    jsdocToolkitDir:'relDir1',
    nodeDir:'relDir1',
    compiler_jar:'relDir1/compiler.jar',
    additionalCompileRoots: ['relDir1', '/absolute/dir2'],
    closureBasePath: 'relDir1'
  };

  settingsLoader.validateOpsObject_('/root', settings, true);
  assertEquals('additionalDeps', '/root/relDir1', settings.additionalDeps[0]);
  assertEquals('additionalDeps', '/absolute/dir2', settings.additionalDeps[1]);
  assertEquals('jsdocToolkitDir', '/root/relDir1', settings.jsdocToolkitDir);
  assertEquals('nodeDir', '/root/relDir1', settings.nodeDir);
  assertEquals('compiler_jar', '/root/relDir1/compiler.jar', settings.compiler_jar);
  assertEquals('additionalCompileRoots', '/root/relDir1', settings.additionalCompileRoots[0]);
  assertEquals('additionalCompileRoots', '/absolute/dir2', settings.additionalCompileRoots[1]);
  assertEquals('closureBasePath', '/root/relDir1', settings.closureBasePath);
};

function testParseClosureBasePath_() {
  var alias = settingsLoader.parseClosureBasePath_;
  assertEquals('1', '/test1/test2/closure-library', alias('/test1/test2/closure-library/test3/test4'));
  assertEquals('2', 'test1/test2/closure-library', alias('test1/test2/closure-library/test3/test4'));
  assertEquals('3', '/test1/test2/closure-library', alias('\\test1/test2\\closure-library\\test3/test4'));
  assertEquals('4', 'test1/test2/closure-library', alias('test1/test2\\closure-library\\test3/test4'));
};