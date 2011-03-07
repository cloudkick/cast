#!/usr/bin/env node

process.stdout.write('test hook timeout stdout');
process.stdout.write('test hook timeout stderr');

setTimeout(function() {
  process.exit(2);
}, 20000);
