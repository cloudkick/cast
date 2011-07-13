function handler(req, res) {
  res.writeHead(200, {});
  res.end('ponnies!');
}

var routes = [
  // 'method', 'path', middleware1, middleware2, ..., handler
  ['GET', '/foobar', handler]
];
 
exports.routes = routes;
