var http = require('http');

var sprintf = require('extern/sprintf').sprintf;
var log = require('util/log');

/**
 * Run a HTTP server which is used for testing purposes.
 *
 * @param {String} ip_address IP address on which to listen
 * @param {Integer} port  Port on which to listen
 * @param {Object} routes Routes for the server. For example:
 *
 * { '/test': {'status_code': 200, 'body': 'Some content'},
 *   '/test2': {'status_code': 302, 'body': 'Test response'}
 * }
 * 
 * @param {Function} callback Callback which is called when the server has been bound to the port
 */
var run_test_http_server = function(ip_address, port, routes, callback) {
  var _ip_address = ip_address || '127.0.0.1';
  var _port = port || 8888;
  var _routes = routes || {};
  var _callback = callback;
  
  var http_server = http.createServer(function(request, response) {
    var path = request.url;

    var route;
    
    if (!_routes.hasOwnProperty(path)) {
      response.writeHead(404, {'Content-Type': 'text-plain'});
      response.end('Not found');
      
      return;
    }
    
    route = _routes[path];
    response.writeHead(route.status_code, {'Content-Type': 'text-plain'})
    response.end(route.body);
  }).listen(_port, _callback);
  
  log.info(sprintf('Test HTTP server listening on IP %s port %s', _ip_address, _port));
};

exports.run_test_http_server = run_test_http_server;
