var log = require('util/log');

function attachMiddleware(maxSize) {
  return function bodyDecoder(req, res, next) {
    var cl, bodyLen = 0;
    cl = req.headers['content-length'];

    if (cl) {
      cl = parseInt(cl, 10);
      if (cl >= maxSize) {
        log.info('Denying client for too large content length');
        res.writeHead(413, {Connection: 'close'});
        res.end();
        req.socket.destroy();
      }
    }

    req.setEncoding('utf8');
    req.on('data', function(chunk) {
      bodyLen += chunk.length;
      if (bodyLen >= maxSize) {
        log.info('Denying client for body too large');
        res.writeHead(413, {Connection: 'close'});
        res.end();
        req.socket.destroy();
      }
    });

    next();
  };
}

exports.attachMiddleware = attachMiddleware;
