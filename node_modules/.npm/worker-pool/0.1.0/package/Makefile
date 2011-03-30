test:
	@find test/test-*.js | xargs -n 1 -t node

test-pool:
	@find test/test-worker-pool*.js | xargs -n 1 -t expresso

test-all:
	make test
	sleep 1
	make test-pool

.PHONY: test test-pool test-all
