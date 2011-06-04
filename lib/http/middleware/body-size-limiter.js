var sprintf = require('sprintf').sprintf;

var log = require('util/log');

var MAX_BUFFER_SIZE = 10 * 1024 * 1024;

function attachMiddleware(maxSize) {
  if (maxSize > MAX_BUFFER_SIZE) {
    throw new Error(sprintf('Buffering more then %d bytes of data in memory is a bad idea',
                            MAX_BUFFER_SIZE));
  }

  return function bodyDecoder(req, res, next) {
    var cl, bodyLen = 0;
    req.buffer = '';
    cl = req.headers['content-length'];

    if (cl) {
      cl = parseInt(cl, 10);
      if (cl >= maxSize) {
        log.info('Denying client for too large content length');
        res.writeHead(413, {Connection: 'close'});
        res.end();
      }
    }

    function onData(chunk) {
      req.buffer += chunk;
      bodyLen += chunk.length;
      if (bodyLen >= maxSize) {
        log.info('Denying client for body too large');
        res.writeHead(413, {Connection: 'close'});
        res.end();
        req.removeListener('data', onData);
      }
    }

    req.setEncoding('utf8');
    req.on('data', onData);
    req.on('end', next);
  };
}

exports.attachMiddleware = attachMiddleware;
