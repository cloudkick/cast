
goog.require('goog.array');

goog.require('goog.testing.jsunit');
goog.require('nclosure.gennode.type');

function testToTypeStringIgnoresVarName() {
  var t = new nclosure.gennode.type('ncnode.test.type', 'varname', 'desc');
  assertEquals('@type {ncnode.test.type} desc', t.toTypeString());
}

function testToTypeStringWithNoDesc() {
  var t = new nclosure.gennode.type('ncnode.test.type');
  assertEquals('@type {ncnode.test.type}', t.toTypeString());
}

function testToParamStringWithDesc() {
  var t = new nclosure.gennode.type('ncnode.test.type', 'varname', 'desc');
  assertEquals('@param {ncnode.test.type} varname desc', t.toParamString());
}

function testToParamStringWithoutDesc() {
  var t = new nclosure.gennode.type('ncnode.test.type', 'varname');
  assertEquals('@param {ncnode.test.type} varname', t.toParamString());
}
