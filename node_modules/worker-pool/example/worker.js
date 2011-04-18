// the actual web worker

var worker = require('../lib/worker').worker;

worker.onmessage = function (msg) {
  worker.postMessage({
    hello: 'mother'
  });
};
