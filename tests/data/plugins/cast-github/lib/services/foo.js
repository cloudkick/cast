function Service() {
  this.name = 'fooservice';
}

Service.prototype.start = function() {
};

Service.prototype.stop = function() {
};

exports.instance = new Service();
