
var os = require('os');

var agent = require('cast-agent/entry');
var norris = require('norris');
var http = require('services/http');
var httputil = require('util/http');
var version = require('util/version');

var route = http.route;

function info(req, res) {
  var date_started = agent.date_started;
  var current_date = new Date();
  var uptime = (current_date.getTime() / 1000) - (date_started.getTime() / 1000);

  norris.get(function(facts) {
    var info = {
      'agent_version': version.toString(),
      'node_version': process.version,
      'api_version': http.CURRENT_API_VERSION,
      'hostname': facts.hostname,
      'architecture': facts.arch,
      'os': os.release(),
      'memory': os.totalmem(),
      'os_uptime': os.uptime(),
      'agent_uptime': uptime
    };

    httputil.return_json(res, 200, info);
  });
}

exports.urls = route([
   ['GET /$', '1.0', info]
]);
