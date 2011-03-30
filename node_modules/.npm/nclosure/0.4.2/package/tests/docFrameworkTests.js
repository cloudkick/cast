#!/usr/local/bin/node

/**
 * @private
 * @type {nclosure.core}
 * @const
 */
var ng_ = require('nclosure').nclosure();

var fs_ = require('fs');
var path_ = require('path');
var testDir;
var googDoc;

goog.require('goog.testing.jsunit');
goog.require('goog.testing.AsyncTestCase');
goog.require('goog.array');

var tearDownPage = clearDir;


function testSimpleDocs() { runImpl(getDirectory()); };
function testDocsInExternalDirectory() { runImpl('/tmp/_docTests'); };

function runImpl(dir) {
  testDir = dir;
  setJSDOCOpts();
  asyncTestCase.waitForAsync();
  clearDir(function() {
    writeOutFile('simplefile.js', [
      '/** @fileoverview This is the fileoverview */',
      '/** @constructor\nThis is the constructor */',
      'var Constt = function() {}',
    ]);
    runDoc();
    assertClassInIndex(['Constt']);
    clearDir(function() { asyncTestCase.continueTesting() }); // Clean up
  });
};

var setJSDOCOpts = function() {
 var jsdto = ng_.args.additionalJSDocToolkitOptions;
  jsdto = goog.array.filter(jsdto, function(o) {
    return o.indexOf('/tests') < 0 && o.indexOf('-d=') < 0;
  });
  jsdto.push('-d=' + ng_.getPath(testDir, 'docs'));
  ng_.args.additionalJSDocToolkitOptions = jsdto;
};


function assertClassInIndex(files) {
  var indexContents = fs_.readFileSync(
    ng_.getPath(testDir, 'docs') + '/index.html').toString();
  goog.array.forEach(files, function(f) {
    assertTrue(indexContents.indexOf('>' + f + '<') > 0);
  });
};

function writeOutFile(file, contents) {
  if (!path_.existsSync(testDir)) { fs_.mkdirSync(testDir, 0777); }
  var path = ng_.getPath(testDir, file)
  fs_.writeFileSync(path, contents.join('\n'), encoding = 'utf8');
};

function runDoc() {
  global._dirToDoc = testDir;
  if (googDoc) {
    googDoc.init_(ng_.args);
  } else {
    googDoc = require('../bin/ncdoc').googDoc;
  }
};

function getDirectory() {
  var file = process.argv[2];
  var idx = file.lastIndexOf('/');
  var dir = idx > 0 ? file.substring(0, idx) : file;
  var d = ng_.getPath(dir, '_docTests');;
  return d;
};

function clearDir(callback) {
  if (!testDir || !path_.existsSync(testDir)) {
    if (callback) callback();
    return
  }
  require('child_process').exec('rm -rf ' + testDir, callback);
};

var asyncTestCase = goog.testing.AsyncTestCase.createAndInstall();
asyncTestCase.stepTimeout = 2000;