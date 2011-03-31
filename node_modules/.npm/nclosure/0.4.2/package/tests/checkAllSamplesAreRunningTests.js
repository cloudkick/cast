#!/usr/local/bin/node

require('nclosure').nclosure();

var fs_ = require('fs');
var path_ = require('path');

goog.require('goog.testing.AsyncTestCase');
goog.require('goog.testing.jsunit');
goog.require('goog.array');

var baseDir = '../';
var samplesDir = ['examples/'];

var sampleFiles = getAllTestFiles();


setUp = function() {
  asyncTestCase.stepTimeout = 10000;
};

function getAllTestFiles() {
  var sampleFiles = [];
  goog.array.forEach(samplesDir, function(d) {
    readFilesInDir(__dirname + '/' + baseDir + d, sampleFiles);
  });
  return sampleFiles;
}

function readFilesInDir(d, list) {
  var files = fs_.readdirSync(d);
  goog.array.forEach(files, function(f) {
    if (fs_.statSync(d + f).isDirectory()) {
      return readFilesInDir(d + f + '/', list);
    } else if (f.toLowerCase() === 'example.js') {
      list.push(d + f);
    }
  });
  return list;
};

testRunningExamples = function() {
  assertEquals('Expected 2 examples (simple and animals)',
    2, sampleFiles.length);
  runNextExample();
};

function runNextExample() {
    if (sampleFiles.length === 0) { return; }
    var test = sampleFiles.pop();
    runExampleImpl(test, function() {
      runNextExample();
    });
};

function runExampleImpl(file, callback) {
  asyncTestCase.waitForAsync();
  require('child_process').exec(file,
      function(err, stdout, stderr) {
    var shortFile = file.substring(file.lastIndexOf('/') + 1);
    assertNull('There were errors trying to run exsample: ' + shortFile, err);
    assertTrue('Some tests in file[' + shortFile + '] failed.',
      stdout.indexOf('Bye!') > 0);
    asyncTestCase.continueTesting();
    callback();
  });
};

var asyncTestCase = goog.testing.AsyncTestCase.createAndInstall();