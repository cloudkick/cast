#!/usr/local/bin/node

require('nclosure').nclosure();

// This line is only required to get the nctest up and running if this
// file is exectuted without using nctest
goog.require('goog.testing.jsunit');

var suite = ['../examples/simple/'];