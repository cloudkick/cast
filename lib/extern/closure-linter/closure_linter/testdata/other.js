// Copyright 2007 The Closure Linter Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Miscellaneous style errors.
 *
 * @author robbyw@google.com (Robby Walker)
 */

goog.require('goog.events.EventHandler');

var this_is_a_really_long_line = 100000000000000000000000000000000000000000000000; // LINE_TOO_LONG

// http://this.comment.should.be.allowed/because/it/is/a/URL/that/can't/be/broken/up

/**
 * Types are allowed to be long even though they contain spaces.
 * @type {function(ReallyReallyReallyReallyLongType, AnotherExtremelyLongType) : LongReturnType}
 */
x.z = 1000;

/**
 * Params are also allowed to be long even though they contain spaces.
 * @param {function(ReallyReallyReallyReallyLongType, AnotherExtremelyLongType) : LongReturnType} fn
 *     The function to call.
 */
x.z = function(fn) {
};

// +2: LINE_TOO_LONG
var x =
    a.b.c.d.a.b.c.d.a.b.c.d.a.b.c.d.a.b.c.d.a.b.c.d.a.b.c.d.a.b.c.d.a.b.c.d.a.b.c.d.a.b.c.d.tooLongEvenThoughNoSpaces;

// +1: LINE_TOO_LONG
getSomeExtremelyLongNamedFunctionWowThisNameIsSoLongItIsAlmostUnbelievable().dispose();

// +4: MISSING_JSDOC_TAG_DESCRIPTION
// +4: MISSING_JSDOC_TAG_DESCRIPTION
// +4: MISSING_JSDOC_TAG_DESCRIPTION
/**
 * @param {number|string|Object|Element|Array.<Object>|null} aReallyReallyReallyStrangeParameter
 * @param {number|string|Object|Element|goog.a.really.really.really.really.really.really.really.really.long.Type|null} shouldThisParameterWrap
 * @return {goog.a.really.really.really.really.really.really.really.really.long.Type}
 */
x.y = function(aReallyReallyReallyStrangeParameter, shouldThisParameterWrap) {
  return something;
};

/**
 * @type {goog.a.really.really.really.really.really.really.really.really.long.Type?}
 */
x.y = null;

function doesEndWithSemicolon() {
}; // ILLEGAL_SEMICOLON_AFTER_FUNCTION

function doesNotEndWithSemicolon() {
}

doesEndWithSemicolon = function() {
};

doesNotEndWithSemicolon = function() {
} // MISSING_SEMICOLON_AFTER_FUNCTION

doesEndWithSemicolon['100'] = function() {
};

doesNotEndWithSemicolon['100'] = function() {
} // MISSING_SEMICOLON_AFTER_FUNCTION

if (some_flag) {
  function doesEndWithSemicolon() {
  }; // ILLEGAL_SEMICOLON_AFTER_FUNCTION

  function doesNotEndWithSemicolon() {
  }

  doesEndWithSemicolon = function() {
  };

  doesNotEndWithSemicolon = function() {
  } // MISSING_SEMICOLON_AFTER_FUNCTION
}

/**
 * Regression test for function expressions treating semicolons wrong.
 * @bug 1044052
 */
goog.now = Date.now || function() {
  //...
};

/**
 * Regression test for function expressions treating semicolons wrong.
 * @bug 1044052
 */
goog.now = Date.now || function() {
  //...
} // MISSING_SEMICOLON_AFTER_FUNCTION

/**
 * Function defined in ternary operator
 * @bug 1413743
 * @param {string} id The ID of the element.
 * @return {Element} The matching element.
 */
goog.dom.$ = document.getElementById ?
    function(id) {
      return document.getElementById(id);
    } :
    function(id) {
      return document.all[id];
    };

/**
 * Test function in object literal needs no semicolon.
 * @type {Object}
 */
x.y = {
  /**
   * @return {number} Doc the inner function too.
   */
  a: function() {
    return 10;
  }
};

var testRegex = /(\([^\)]*\))|(\[[^\]]*\])|({[^}]*})|(&lt;[^&]*&gt;)/g;
var testRegex2 = /abc/gimsx;

var x = 100 + 100 + 100 + 100 + 100 + 100 + 100 + 100 + 100 + 100 + 100 + 100
    + 20; // LINE_STARTS_WITH_OPERATOR

var x = 100 + 100 + 100 + 100 + 100 + 100 + 100 + 100 + 100 + 100 + 100 + 100 +
    -20; // unary minus is ok

var x = z++
    + 20; // LINE_STARTS_WITH_OPERATOR

// Regression test: This line was incorrectly not reporting an error
var marginHeight = x.layout.getSpacing_(elem, 'marginTop')
    + x.layout.getSpacing_(elem, 'marginBottom');
// -1: LINE_STARTS_WITH_OPERATOR

// Regression test: This line was correctly reporting an error
x.layout.setHeight(elem, totalHeight - paddingHeight - borderHeight
    - marginHeight); // LINE_STARTS_WITH_OPERATOR

// Regression test: This line was incorrectly reporting spacing and binary
// operator errors
if (i == index) {
}
++i;

var twoSemicolons = 10;; // REDUNDANT_SEMICOLON

twoSemicolons = 10;
// A more interesting example of two semicolons
    ; // EXTRA_SPACE, WRONG_INDENTATION, REDUNDANT_SEMICOLON

/** @bug 1598895 */
for (;;) {
  // Do nothing.
}

for (var x = 0, foo = blah(), bar = {};; x = update(x)) {
  // A ridiculous case that should probably never happen, but I suppose is
  // valid.
}

var x = "allow'd double quoted string";
var x = "unnecessary double quotes string"; // UNNECESSARY_DOUBLE_QUOTED_STRING
// +1: MULTI_LINE_STRING, UNNECESSARY_DOUBLE_QUOTED_STRING,
var x = "multi-line unnecessary double quoted \
         string.";

// Regression test: incorrectly reported missing doc for variable used in global
// scope.
/**
 * Whether the "Your browser isn't fully supported..." warning should be shown
 * to the user; defaults to false.
 * @type {boolean}
 * @private
 */
init.browserWarning_ = false;

init.browserWarning_ = true;

if (someCondition) {
  delete this.foo_[bar];
}

x = [1, 2, 3,]; // COMMA_AT_END_OF_LITERAL
x = [1, 2, 3, /* A comment */]; // COMMA_AT_END_OF_LITERAL
x = [
  1,
  2,
  3, // COMMA_AT_END_OF_LITERAL
];
x = {
  a: 1, // COMMA_AT_END_OF_LITERAL
};

// Make sure we don't screw up typing for Lvalues and think b:c is a type value
// pair.
x = a ? b : c = 34;
x = a ? b:c; // MISSING_SPACE, MISSING_SPACE
x = (a ? b:c = 34); // MISSING_SPACE, MISSING_SPACE

if (x) {
  x += 10;
}; // REDUNDANT_SEMICOLON

/**
 * Bad assignment of array to prototype.
 * @type {Array}
 */
x.prototype.badArray = []; // ILLEGAL_PROTOTYPE_MEMBER_VALUE

/**
 * Bad assignment of object to prototype.
 * @type {Object}
 */
x.prototype.badObject = {}; // ILLEGAL_PROTOTYPE_MEMBER_VALUE

/**
 * Bad assignment of class instance to prototype.
 * @type {goog.events.EventHandler}
 */
x.prototype.badInstance = new goog.events.EventHandler();
// -1: ILLEGAL_PROTOTYPE_MEMBER_VALUE

// Check that some basic structures cause no errors.
x = function() {
  try {
  } finally {
    y = 10;
  }
};

switch (x) {
  case 10:
    break;
  case 20:
    // Fallthrough.
  case 30:
    break;
  case 40: {
    break;
  }
  default:
    break;
}

do {
  x += 10;
} while (x < 100);

do {
  x += 10;
} while (x < 100) // MISSING_SEMICOLON

// Missing semicolon checks.
x = 10 // MISSING_SEMICOLON
x = someOtherVariable // MISSING_SEMICOLON
x = fnCall() // MISSING_SEMICOLON
x = {a: 10, b: 20} // MISSING_SEMICOLON
x = [10, 20, 30] // MISSING_SEMICOLON
x = (1 + 2) // MISSING_SEMICOLON
x = {
  a: [
    10, 20, (30 +
        40)
  ]
} // MISSING_SEMICOLON
x = a.
    b.
    c().
    d;

// Test that blocks without braces don't generate incorrect semicolon and
// indentation errors.  TODO: consider disallowing blocks without braces.
if (x)
  y = 10;

if (x)
  y = 8 // MISSING_SEMICOLON

// We used to erroneously report a missing semicolon error.
if (x)
{
}

while (x)
  y = 10;

for (x = 0; x < 10; x++)
  y += 10;
  z += 10; // WRONG_INDENTATION

var x = 100 // MISSING_SEMICOLON

/* comment not closed  // FILE_MISSING_NEWLINE, FILE_IN_BLOCK