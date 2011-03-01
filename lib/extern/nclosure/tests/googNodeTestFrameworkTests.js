#!/usr/local/bin/node


require('nclosure').nclosure();

goog.require('goog.array');
goog.require('goog.testing.jsunit');
goog.require('nclosure.settingsLoader');
goog.require('nclosure.NodeTestInstance');

function testParseStackFrame() {
  var ls = [
    'Error',
    '    at Object.get (testing/stacktrace.js:463:15)',
    '    at new <anonymous> (testing/asserts.js:930:45)',
    '    at Object.raiseException_ (testing/asserts.js:904:9)',
    '    at _assert (testing/asserts.js:145:26)',
    '    at assertEquals (testing/asserts.js:289:3)',
    '    at /home/ubuntu/Dev/projects/nclosure/tests/closureUtilsTests.js:70:3',
    '    at [object Object].execute (testing/testcase.js:901:12)'
  ];

  validateStackLine(ls[0], null);
  validateStackLine(ls[1], ['Object', 'get', 'testing/stacktrace.js:463:15']);
  validateStackLine(ls[2], ['new <anonymous>', '', '(testing/asserts.js:930:45)']);
  validateStackLine(ls[3], ['Object', 'raiseException_', '(testing/asserts.js:904:9)']);
  validateStackLine(ls[4], ['', '_assert', '(testing/asserts.js:145:26)']);
  validateStackLine(ls[5], ['', 'assertEquals', '(testing/asserts.js:289:3)']);
  validateStackLine(ls[6], ['', '', '/home/ubuntu/Dev/projects/nclosure/tests/closureUtilsTests.js:70:3']);
  validateStackLine(ls[7], ['[object Object]', 'execute', '(testing/testcase.js:901:12)']);
};

function validateStackLine(line, frame) {
  var expVals = nclosure.NodeTestInstance.parseStackFrameLine_(line);

  if (!expVals) {
    assertNull('Line: ' + line + ' exptected null frame', frame);
    return;
  }
  assertNotNull('Line: ' + line + ' exptected NOT null frame', frame);

  assertEquals('Line: ' + line + ' context', expVals[0], frame.context_);
  assertEquals('Line: ' + line + ' function name', expVals[1], frame.name_);
  assertEquals('Line: ' + line + ' alias', undefined, frame.alias_);
  assertEquals('Line: ' + line + ' args', undefined, frame.args_);
  assertEquals('Line: ' + line + ' path', expVals[2], frame.path_);
}
