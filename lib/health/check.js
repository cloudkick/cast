var net = require('net');
var path = require('path');

function HealthCheck(obj, len) {
  console.log("Adding a health check: " + obj.type);
  this.type = obj.type;
  this.details = obj.details;
  this.runCheck();
  this.history = [];
  this.history_length = len || 5;
};


HealthCheck.prototype.runCheck = function runCheck(callback) {
  switch (this.type) {
    case "socket":
      this.portCheck(callback);
      break;
    case "file_exists":
      this.fileExists(callback);
      break;
    default:
      throw new Error("Type " + this.type + " does not exist");
  };
};


HealthCheck.prototype.addHistory = function addHistory(item, callback) {
  item["ts"] = new Date();
  if (this.history.length > this.history_length) {
    this.history.shift();
  }
  this.history.push(item);
  if (callback) callback(item);
};

HealthCheck.prototype.portCheck = function portCheck(callback) {
  var self=this;
  this._socket = net.createConnection(this.details.port, this.details.host);
  this._socket.addListener('connect', function () {
    self.addHistory({"result": true}, callback);

    self._socket.end();
  });
  this._socket.addListener('error', function (exception) {
    self.addHistory({"result": false, "err": exception}, callback);
  });
};

HealthCheck.prototype.fileExists= function fileExists(callback) {
  var self=this;
  path.exists(self.details.path, function (exists) {
    if (exists) {
      self.addHistory({"result": true}, callback);
    } else {
      self.addHistory({"result": false, "err": "File does not exist."}, callback);
    }
  });
  
};

/**
 * 
 *  
 *
 **/
HealthCheck.prototype.lastStatus = function portCheck() {
  if (this.history.length) {
    return {"details": this.details,
      "status": this.history[this.history.length - 1]
    }
  }
  return null;
}

function loadHealthCheck(obj, callback) {
  var chk_list = [];
  if (obj["health_checks"]) {
    var chks = obj["health_checks"], key, chk;
    for (key in chks) {
      chk = chks[key];
      var hlth = new HealthCheck(chk);
      chk_list.push(hlth);
    }
    // Add to the check list 
    if (chk_list)
      callback && callback(null, chk_list);
  } else {
    callback && callback("No health_checks specified", null);
  }
};


exports.loadHealthCheck = loadHealthCheck;
exports.HealthCheck = HealthCheck;
