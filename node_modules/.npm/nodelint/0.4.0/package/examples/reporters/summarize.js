// example usage:
//
//     $ nodelint path/to/file.js --reporter examples/reporters/summarize.js

var sys = require('sys');

function reporter(results) {
  var len = results.length;
  sys.puts(len + ' error' + ((len === 1) ? '' : 's'));
}