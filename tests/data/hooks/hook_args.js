#!/usr/bin/env node

var args = process.argv.splice(2).join(', ');
process.stdout.write('test hook args stdout: ' + args);
process.stdout.write('test hook args stderr');

process.exit(0);
