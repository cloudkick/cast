#!/usr/local/bin/node

var ng_ = require('nclosure').nclosure();

var fs_ = require('fs');
var path_ = require('path');

goog.require('goog.testing.jsunit');
goog.require('goog.testing.AsyncTestCase');
goog.require('goog.array');

var baseDir = '../';
var dirs = ['lib/', 'bin/']
var ignoreable = ['deps.js', '/node/', 'externs.js'];

var allTestableFiles = getAllTestableFiles();

function getAllTestableFiles() {
  var allFiles = [];
  goog.array.forEach(dirs, function(d) {
    readFilesInDir(__dirname + '/' + baseDir + d, allFiles);
  });
  return allFiles;
};

function readFilesInDir(d, allFiles) {
  var files = fs_.readdirSync(d);
  goog.array.forEach(files, function(f) {
    if (fs_.statSync(d + f).isDirectory()) {
      if (f === 'docs') { return; }
      return readFilesInDir(d + f + '/', allFiles);
    } else if (isValidTestableFile(d + f)) {
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

var errors = [];
function testFiles() {
  goog.array.forEach(allTestableFiles, runFileTest);
  assertTrue('\n\t' + errors.join('\n\t'), errors.length === 0);
};

function runFileTest(f) {
  var contents = fs_.readFileSync(f).toString();
  if (contents.indexOf('@fileoverview ') < 0) { errors.push(f + ' - has no @fileoverview'); }
  if (contents.indexOf('@author ') < 0) { errors.push(f + ' - has no @author'); }
};