#!/usr/bin/env node

process.stdout.write('test hook failure stdout');
process.stderr.write('test hook failure stderr');

process.exit(1);
