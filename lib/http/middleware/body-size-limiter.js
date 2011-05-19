var log = require('util/log');

function attachMiddleware(maxSize) {
  return function bodyDecoder(req, res, next) {
    var cl, bodyLen = 0;
    cl = req.headers['content-length'];

    if (cl) {
      cl = parseInt(cl, 10);
      if (cl >= maxSize) {
        log.msg('Denying client for too large content length',
            {content_length: cl, max: maxSize});
        res.writeHead(413, {Connection: 'close'});
        res.end();
        req.transport.close();
      }
    }

    req.setEncoding('utf8');
    req.on('data', function(chunk) {
      bodyLen += chunk.length;
      if (bodyLen >= maxSize) {
        log.msg('Denying client for body too large',
                  {content_length: bodyLen, max: maxSize});
        res.writeHead(413, {Connection: 'close'});
        res.end();
        req.transport.close();
      }
    });

    next();
  };
}

exports.attachMiddleware = attachMiddleware;
