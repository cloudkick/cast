#!/usr/local/bin/node

var ng_ = require('nclosure').nclosure();

var fs_ = require('fs');
var path_ = require('path');

goog.require('goog.testing.jsunit');
goog.require('goog.testing.AsyncTestCase');
goog.require('goog.array');

var baseDir = '../';
var compileDirs = ['lib/', 'bin/']
var checkDirs = ['lib/', 'bin/', 'examples/simple', 'examples/animals'];
var additionalFiles = ['examples/animals/example.js', 'examples/simple/example.js'];
var ignoreable = ['.min.js', 'deps.js', '.externs.js', '.tmp.js', 'utils.js'];
var doNotDelete = ['simple/deps.js', 'animals/deps.js', 'bin/deps.js'];

var allTestableFiles = getAllTestableFiles();

tearDownPage = deleteAllDepsAndMinFiles;

function getAllTestableFiles() {
  var allFiles = [];
  goog.array.forEach(compileDirs, function(d) {
    readFilesInDir(__dirname + '/' + baseDir + d, allFiles);
  });
  goog.array.forEach(additionalFiles, function(f) {
    allFiles.push(ng_.getPath(__dirname + '/' + baseDir, f));
  });
  return allFiles;
};

function readFilesInDir(d, allFiles) {
  var files = fs_.readdirSync(d);
  goog.array.forEach(files, function(f) {
    if (fs_.statSync(d + f).isDirectory()) {
      if (f === 'docs') { return; }
      return readFilesInDir(d + f + '/', allFiles);
    } else if (isValidTestableFile(f)) {
      allFiles.push(ng_.getPath(d, f));
    }
  });
  return allFiles;
};

function isValidTestableFile(f) {
  return goog.array.findIndex(ignoreable, function(i) {
    return f.toLowerCase().indexOf(i) >= 0 ||
      f.indexOf('.js') !== f.length - 3;
  }) < 0;
};

setUp = function() {
  asyncTestCase.stepTimeout = 20000;
};

testCompileAllFiles = function() {
  doAllFiles(compileFileImpl, allTestableFiles);
};

testCodeCheckAllFiles = function() {
  var dirs = goog.array.map(checkDirs, function(d) {
    return ng_.getPath(__dirname + '/' + baseDir, d);
  });
  doAllFiles(checkFileImpl, dirs);
};

function doAllFiles(operation, files) {
  var tmpAllFiles = goog.array.clone(files);
  doNextFile(tmpAllFiles, operation);
};

function doNextFile(files, operation, oncomplete) {
  if (files.length === 0) {
    if (oncomplete) oncomplete();
    return;
  }
  var file = files.pop();
  operation(file, function() {
    doNextFile(files, operation, oncomplete);
  });
};

function compileFileImpl(file, callback) {
  console.log('nccompile ' + file);
  asyncTestCase.waitForAsync();
  require('child_process').exec('nccompile ' + file,
      function(err, stdout, stderr) {
    stdout = stdout.replace(/\.tmp\.js/g, '.js');
    stderr = stderr.replace(/\.tmp\.js/g, '.js');
    var shortFile = file.substring(file.lastIndexOf('/') + 1);

    assertNull(err);
    var match = /([\d]+) error\(s\), ([\d]+) warning\(s\)/.exec(stderr);
    assertNotNull(stdout, match);
    var errors = parseInt(match[1], 10);
    var warnings = parseInt(match[2], 10);
    // Allow one error until lib bug fixed (goog.testing.jsunit)
    assertFalse(
      ' Error compiling: ' + shortFile + ' - ' + match[0],
      errors > 0 || warnings > 0);
    asyncTestCase.continueTesting();
    callback();
  });
};

function checkFileImpl(file, callback) {
  console.log('ncstyle ' + file);
  asyncTestCase.waitForAsync();
  require('child_process').exec('ncstyle ' + file,
      function(err, stdout, stderr) {
    stdout = stdout.replace(/\.tmp\.js/g, '.js');
    stderr = stderr.replace(/\.tmp\.js/g, '.js');

    assertNull(err);
    assertTrue(stdout, stdout.indexOf('files checked, no errors found') >= 0);
    asyncTestCase.continueTesting();
    callback();
  });
};



function deleteAllDepsAndMinFiles() {
  goog.array.forEach(checkDirs, function(d) {
    var dir = __dirname + '/' + baseDir + d;
    goog.array.forEach(fs_.readdirSync(dir), function(f) {
      if (f.indexOf('.min.js') > 0 || f.indexOf('.tmp.js') > 0 || f === 'deps.js') {
        var file = ng_.getPath(dir, f);
        if (goog.array.findIndex(doNotDelete, function (dnd) {
              return file.indexOf(dnd) >= 0;
            }) < 0) {
          fs_.unlinkSync(file);
        }
      }
    });
  });
};

var asyncTestCase = goog.testing.AsyncTestCase.createAndInstall();
