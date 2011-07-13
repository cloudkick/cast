TESTS := \
	tests/test-cidr.js \
	tests/test-bitbuffer.js \
	tests/test-valve.js \
	tests/test-swiz.js

WHISKEY := $(shell test -x whiskey && echo whiskey || echo node_modules/.bin/whiskey )

export NODE_PATH = lib/

default: test

test:
	${WHISKEY} --print-stdout --print-stderr --tests "${TESTS}"

.PHONY: default test
