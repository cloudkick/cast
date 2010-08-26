var Check = require('health').Check;
var CheckResult = require('health').CheckResult;

exports['test missing required property throws exception'] = function(assert, beforeExit) {
  var n = 0;
  
  try {
    var check = new Check('test check', ['option_1'], [], {}, {});
  }
  catch(exception) {
    n++;
  }
  
  beforeExit(function() {
    assert.equal(1, n, 'Exceptions thrown');
  });
};

exports['test format arguments worky properly'] = function(assert, beforeExit) {
  var required_arguments = ['ip_address', 'port'];
  var optional_arguments = ['use_ssl'];
  var default_values = { 'use_ssl': true };
  
  var arguments1 = { 'ip_address': '1.2.3.4', 'port': 80 };
  var arguments2 = { 'ip_address': '4.3.2.1', 'port': 80, 'use_ssl': false };
  var arguments3 = { 'ip_address': '4.3.2.1', 'port': 80, 'use_ssl': true };
  
  var check1 = new Check('test check 1', required_arguments, optional_arguments, default_values, 
                                         arguments1)
  var check2 = new Check('test check 2', required_arguments, optional_arguments, default_values, 
                                        arguments2)
  var check3 = new Check('test check 1', required_arguments, optional_arguments, default_values, 
                                        arguments3)
                                         
  assert.deepEqual(check1.check_arguments, {'ip_address': '1.2.3.4', 'port': 80, 'use_ssl': true});
  assert.deepEqual(check2.check_arguments, {'ip_address': '4.3.2.1', 'port': 80, 'use_ssl': false});
  assert.deepEqual(check3.check_arguments, {'ip_address': '4.3.2.1', 'port': 80, 'use_ssl': true});
};

exports['test class instantation'] = function(assert, beforeExit) {
  var check = new Check('test check', ['option_1'], [], {'option_1': 'test'})
  
  assert.length(check.result_history, 0);
  assert.equal(check.last_run_date, null);
};

exports['test result history'] = function(assert, beforeExit) {
  var check = new Check('test check', ['option_1'], [], {'option_1': 'test'})
  assert.length(check.result_history, 0);
  
  check.add_result(new CheckResult());
  check.add_result(new CheckResult());
  check.add_result(new CheckResult());
  assert.length(check.result_history, 3);
  
  assert.equal(check.get_last_result(), check.get_result_at_index(0));
  
  check.clear_result_history();
  assert.length(check.result_history, 0);
};
