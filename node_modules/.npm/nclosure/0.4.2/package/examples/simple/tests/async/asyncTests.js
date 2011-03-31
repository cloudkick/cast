#!/usr/local/bin/node

require('nclosure').nclosure();

goog.require('goog.testing.AsyncTestCase');
goog.require('goog.testing.jsunit');
goog.require('nclosure.examples.simple.Example');

goog.provide('nclosure.examples.simple.tests.asyncTests');

function testFunction1() {
  assertFalse(example_.completed);
  asyncTestCase.waitForAsync();
  setTimeout(function() {
    assertNotEquals(typeof(example_), 'undefined');
    assertTrue(example_.completed);
    asyncTestCase.continueTesting();
  }, 500);
};

var asyncTestCase = goog.testing.AsyncTestCase.createAndInstall();
