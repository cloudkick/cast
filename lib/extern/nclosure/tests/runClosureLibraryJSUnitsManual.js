#!/usr/local/bin/node

/**
 * @private
 * @type {nclosure.core}
 * @const
 */
var ng_ = require('nclosure').nclosure();

goog.require('goog.testing.jsunit');

goog.require('nclosure.tests');

var fs_ = require('fs');
var path_ = require('path');

var allTestFiles;
var tmpdir = ng_.getPath(process.cwd(), 'tests/tmpclosuretests/');
var runningTmpFileCount = 0;
var results = [];
var maxTests = -1;
var maxParallels = 8;
var testsToRun;
var start = Date.now();

function setUpPage() {
  // TODO: This assumes the nctest command is running in
  // the nclosure directory.
  allTestFiles = nclosure.tests.readDirRecursiveSync
    ('third_party/closure-library/closure/goog/', '_test[\d\w_]*\.(html|js)');
  if (maxTests > 0 && maxTests < allTestFiles.length)
     allTestFiles = allTestFiles.slice(0, maxTests);

  // This line allows the tests to be limited for testing purposes
  // allTestFiles = allTestFiles.slice(10, 15);

  testsToRun = allTestFiles.length;
  asyncTestCase.stepTimeout = testsToRun * 500;
};

function tearDownPage() {  nclosure.tests.rmRfDir(tmpdir); };

function testClousreTests() {
  assertTrue('Could not find test files', allTestFiles.length > 0);
  asyncTestCase.waitForAsync();
  copyAndParseAllTestFiles(function(err) {
    if (err) {
      console.error(err.stack);
      asyncTestCase.continueTesting();
      return;
    }
    var allFilesInTmp = fs_.readdirSync(tmpdir);
    assertEquals('Expected:\n\t' + allTestFiles.join('\n\t') +
      '\nGot:\n\t' + allFilesInTmp.join('\n\t'),
      testsToRun, allFilesInTmp.length);

    var commands = goog.array.map(allFilesInTmp,
      function(f) { return 'nctest ' + ng_.getPath(tmpdir, f); });
    nclosure.tests.paralleliseExecs(
      commands,runTestCallback_, onCompleted_, maxParallels);
  });
};


function copyAndParseAllTestFiles(oncomplete) {
  var impl = function(err) {
    if (err) return oncomplete(err);
    copyAndParseAllTestFilesImpl(oncomplete)
  };
  if (path_.existsSync(tmpdir)) {
    nclosure.tests.rmRfDir(tmpdir, function(err) {
      if (err) return oncomplete(err);
      fs_.mkdir(tmpdir, 0777, impl);
    });
  } else {
    fs_.mkdir(tmpdir, 0777, impl);
  }
}

function copyAndParseAllTestFilesImpl(oncomplete) {
  var max = allTestFiles.length;
  var remaining = max;
  for (var i = 0; i < max; i++) {
    copyAndParseFile(allTestFiles[i], function(err) {
      if (err) return oncomplete(err);
      if (--remaining === 0) { oncomplete(); }
    });
  };
};

function copyAndParseFile(file, oncomplete) {
  fs_.readFile(file, 'utf-8', function(err, contents) {
    if (err) return oncomplete(err);
    var fileName = file.substring(file.lastIndexOf('/') + 1);
    var isHtml = fileName.indexOf('.js') < 0;
    var toFile = (++runningTmpFileCount) + '_' +
      (isHtml ? fileName + '.js' : fileName);
    toFile = ng_.getPath(tmpdir, toFile);
    if (isHtml) contents = convertToJS_(contents);
    fs_.writeFile(toFile, contents, 'utf-8', function(err) {
      oncomplete(err);
    });
  });
};


function convertToJS_(html)  {
  var blocks = [];
  var idx = html.indexOf('<script');
  while (idx >= 0) {
    idx = html.indexOf('>', idx);
    var endIdx = html.indexOf('</script>', idx);
    blocks.push(html.substring(idx + 1, endIdx));
    html = html.substring(endIdx + 9);
    idx = html.indexOf('<script')
  }
  return blocks.join('\n');
};

function runTestCallback_(command, err, stdout, stderr) {
  var name = command.substring(command.lastIndexOf('/') + 1, command.indexOf('.'));
  var r = {success:false,file:name,name:name.substring(name.indexOf('_') + 1)};
  if (err) r.exception = err;
  if (stdout.indexOf(', 0 failed') < 0) {
    if (stderr) { r.message = stderr; }
    else {
      var underlineIdx = stdout.indexOf('------');
      r.message = stdout.substring(stdout.indexOf('\n', underlineIdx) + 1).
        replace(/\[0\;3\dm/g, '').
        replace(/\n/g, '\<br \/\>');
    }
  } else { r.success = true; }

  if (stdout) {
    var summaryLine = goog.array.find(stdout.split('\n'),
      function(l) { return l.indexOf(' passed, ') >= 0; });
    if (summaryLine) r.summary = summaryLine.substring(7);
  };
  results.push(r);
};

function onCompleted_() {
  assertEquals('Did not run as many tests as expected.',
    testsToRun, results.length);
  var failures = 0, successes = 0;
  var reportFile = [
    '<table border="1"><tr>',
    '<th>Test</th><th>Results</th><th>Summary</th><th>' +
    'Details (Mouse Over for Code)</th>'
  ];
  for (var i = 0, len = results.length; i < len; i++) {
    var r = results[i];
    if (!r.success) { failures++; }
    else { successes++; }

    reportFile.push('<tr><td>' + r.name + '</td>' +
      '<td>' + (!r.success ? 'Fail' : 'Success') + '</td>' +
      '<td> ' + r.summary + '</td>' +
      '<td>' + (r.exception ? r.exception : (r.message || 'n/a') + '</td></tr>'));
  };
  var took = Date.now() - start;
  var summary = 'Closure Library Tests Results ' +
                    '(Success: ' + successes + '/' + testsToRun +
                    ') - Took: ' + took + 'ms.';
  fs_.writeFileSync('tests/closure_lib_tsts.html',
                    '<html><body><h1>' + summary + '</h1>' +
                    reportFile.join('\n') +
                    '</table></body></html>', 'utf-8');

  console.error(summary +
    '\nFor full details see tests/closure_lib_tsts.html');
  asyncTestCase.continueTesting();
};

var asyncTestCase = goog.testing.AsyncTestCase.createAndInstall();