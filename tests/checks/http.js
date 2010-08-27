var test = require('util/test');
var log = require('util/log');

var async = require('extern/async');

var http_check = require('health/checks/http');
var CheckResult = require('health').CheckResult;
var CheckStatus = require('health').CheckStatus;

var routes = {
  '/': {'status_code': 200, 'body': ''},
  '/test1': {'status_code': 200, 'body': 'test hello world'},
  '/test2': {'status_code': 404, 'body': 'Not found'},
  '/test3': {'status_code': 202, 'body': '...<p>test 12345 content</p>...'}
};

exports['test invalid hostname'] = function(assert, beforeExit) {
  var n = 0;
  var check = new http_check.HTTPCheck({'url': 'http://non.exis-te.nt.123', 'type': http_check.config.types.STATUS_CODE_MATCH,
                                        'match_value': 200});
                                        
  check.run(function(result) {
    assert.equal(result.status, CheckStatus.ERROR);
    assert.match(result.details, /returned exception/i);
    n++;
  });
  
  beforeExit(function() {
    assert.equal(1, n, 'Check run callback called');
  });
};

exports['test secure on non ssl'] = function(assert, beforeExit) {
  var n = 0;
  
  test.run_test_http_server('127.0.0.1', 7777, routes, function() {
    var self = this;
    var check = new http_check.HTTPCheck({'url': 'https://127.0.0.1:7777', 'type': http_check.config.types.STATUS_CODE_MATCH,
                                          'match_value': 200});

    check.run(function(result) {
      assert.equal(result.status, CheckStatus.ERROR);
      assert.match(result.details, /unknown/i);
      n++;
      
      self.close();
    });
  });
  
  beforeExit(function() {
    assert.equal(1, n, 'Check run callback called');
  });
};

exports['test check status codes match'] = function(assert, beforeExit) {
  var n = 0;
  
  test.run_test_http_server('127.0.0.1', 8888, routes, function() {
    var self = this;
    
    var check1 = new http_check.HTTPCheck({'url': 'http://127.0.0.1:8888/test1', 'type': http_check.config.types.STATUS_CODE_MATCH,
                                          'match_value': 200});
    var check2 = new http_check.HTTPCheck({'url': 'http://127.0.0.1:8888/test1', 'type': http_check.config.types.STATUS_CODE_MATCH,
                                          'match_value': 404});
                                          
    async.parallel([
    function(callback) {
      check1.run(function(result) {
        assert.equal(result.status, CheckStatus.SUCCESS);
        assert.match(result.details, /returned status code/i);
        n++;
        
       callback();
      });
    },
    function(callback) {
      check2.run(function(result) {
        assert.equal(result.status, CheckStatus.ERROR);
        assert.match(result.details, /returned status code/i);
        n++;
        
       callback();
      });
    }],
    function(error) {
      self.close();
    });
  });
    
  beforeExit(function() {
    assert.equal(2, n, 'Check run callback called');
  });
};

exports['test check response body match'] = function(assert, beforeExit) {
  var n = 0;
  
  test.run_test_http_server('127.0.0.1', 9999, routes, function() {
    var self = this;
    
    var check1 = new http_check.HTTPCheck({'url': 'http://127.0.0.1:9999/test3', 'type': http_check.config.types.BODY_REGEX_MATCH,
                                          'match_value': 'some text which wont match'});
    var check2 = new http_check.HTTPCheck({'url': 'http://127.0.0.1:9999/test3', 'type': http_check.config.types.BODY_REGEX_MATCH,
                                          'match_value': /.*test \d+ CONTENT.*/i});
                                          
    async.parallel([
    function(callback) {
      check1.run(function(result) {
        assert.equal(result.status, CheckStatus.ERROR);
        assert.match(result.details, /didn\'t match/i);
        n++;
        
       callback();
      });
    },
    function(callback) {
      check2.run(function(result) {
        assert.equal(result.status, CheckStatus.SUCCESS);
        assert.match(result.details, /matched/i);
        n++;
        
       callback();
      });
    }],
    function(error) {
      self.close();
    });
  });
    
  beforeExit(function() {
    assert.equal(2, n, 'Check run callback called');
  });
};
