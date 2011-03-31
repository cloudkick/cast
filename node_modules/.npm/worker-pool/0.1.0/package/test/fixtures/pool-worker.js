var worker = require('../../index').worker_pool.worker;

worker.addListener('message', function(msg) {
  var result = 0;
  var return_after = msg.return_after;
  var throw_error = msg.throw_error;
  var number = msg.number;

  if (throw_error) {
    throw new Error('Worker thrown an error');
  }

  result = number + 10;

  setTimeout(function() {
    worker.postResult({'result': result});
  }, return_after);
});
