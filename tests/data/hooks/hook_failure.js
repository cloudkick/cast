#!/usr/bin/env node

process.stdout.write('test hook failure stdout');
process.stdout.write('test hook failure stderr');

process.exit(1);
