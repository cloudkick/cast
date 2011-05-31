/*
 *  Copyright 2011 Rackspace
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

var swiz = require('swiz');

exports['test_validate_int'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().isInt()
  };

  // positive case
  var obj = { a: 1 };
  var obj_ext = { a: 1, b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'integer test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  var neg = { a: 'test' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'integer test (negative case)');

  test.finish();
};

exports['test_validate_email'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().isEmail()
  };

  // positive case
  var obj = { a: 'test@cloudkick.com' };
  var obj_ext = { a: 'test@cloudkick.com', b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'email test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  var neg = { a: 'invalidemail@' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'email test (negative case)');

  test.finish();
};

exports['test_validate_url'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().isUrl()
  };

  // positive case
  var obj = { a: 'http://www.cloudkick.com' };
  var obj_ext = { a: 'http://www.cloudkick.com', b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'url test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  var neg = { a: 'invalid/' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'url test (negative case)');

  test.finish();
};

exports['test_validate_ip'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().isIP()
  };

  // positive case
  var obj = { a: '192.168.0.1' };
  var obj_ext = { a: '192.168.0.1', b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'IP test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  var neg = { a: 'invalid/' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'IP test (negative case)');

  neg = {a: '12345' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'IP test (negative case 2)');

  // IPv6 normalization
  obj_ext = { a: '2001:db8::1:0:0:1'};
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'IPv6 test and normalization');
  assert.deepEqual(rv.cleaned.a, '2001:0db8:0000:0000:0001:0000:0000:0001');

  test.finish();
};

exports['test_validate_ip_blacklist'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().isIP().notIpBlacklisted()
  };

  // positive case
  var obj_ext = { a: '173.45.245.32', b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'IP Blacklist test');

  // negative case
  var neg = { a: 'invalid/' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'IP blacklist test (negative case)');

  neg = {a: '192.168.0.1' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'IP blacklist test (negative case 2)');

  // IPv6
  obj_ext = { a: '2001:db8::1:0:0:1'};
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'IPv6 blacklist test');

  neg = {a: 'fc00:1:0:0:1' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'IPv6 blacklist test (negative case)');


  test.finish();
};

exports['test_validate_cidr'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().isCIDR()
  };

  // positive case
  var obj = { a: '192.168.0.1/2' };
  var obj_ext = { a: '192.168.0.1/2', b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'CIDR test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  var neg = { a: 'invalid/' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'CIDR test (negative case)');

  neg = { a: '192.168.0.1/128' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'CIDR test (negative case 2)');

  // IPv6 normalization
  obj_ext = { a: '2001:db8::1:0:0:1/3'};
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'IPv6 CIDR test');
  assert.deepEqual(rv.cleaned.a,
      '2001:0db8:0000:0000:0001:0000:0000:0001/3');

  neg = { a: '2001:db8::1:0:0:1/194' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'IPv6 CIDR test (negative case)');

  test.finish();
};

exports['test_validate_alpha'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().isAlpha()
  };

  // positive case
  var obj = { a: 'ABC' };
  var obj_ext = { a: 'ABC', b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'alpha test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  var neg = { a: 'invalid/' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'alpha test (negative case)');

  test.finish();
};

exports['test_validate_alphanumeric'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().isAlphanumeric()
  };

  // positive case
  var obj = { a: 'ABC123' };
  var obj_ext = { a: 'ABC123', b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'alphanumeric test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  var neg = { a: 'invalid/' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'alphanumeric test (negative case)');

  test.finish();
};

exports['test_validate_numeric'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().isNumeric()
  };

  // positive case
  var obj = { a: '123' };
  var obj_ext = { a: 123, b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'numeric test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  var neg = { a: '/' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'numeric test (negative case)');

  test.finish();
};

exports['test_validate_lowercase'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().isLowercase()
  };

  // positive case
  var obj = { a: 'abc' };
  var obj_ext = { a: 'abc', b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'lowercase test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  var neg = { a: 'ABCabc' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'lowercase test (negative case)');

  test.finish();
};

exports['test_validate_uppercase'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().isUppercase()
  };

  // positive case
  var obj = { a: 'ABC' };
  var obj_ext = { a: 'ABC', b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'uppercase test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  var neg = { a: 'ABCabc' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'uppercase test (negative case)');

  test.finish();
};

exports['test_validate_decimal'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().isDecimal()
  };

  // positive case
  var obj = { a: '123.123' };
  var obj_ext = { a: 123.123, b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'decimal test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  var neg = { a: 'ABCabc' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'decimal test (negative case)');

  test.finish();
};

exports['test_validate_float'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().isFloat()
  };

  // positive case
  var obj = { a: 123.123 };
  var obj_ext = { a: 123.123, b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'float test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  var neg = { a: 'ABCabc' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'float test (negative case)');

  test.finish();
};

exports['test_validate_notnull'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().notNull()
  };

  // positive case
  var obj = { a: '1' };
  var obj_ext = { a: '1', b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'notnull test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  var neg = { a: '' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'notnull test (negative case)');

  test.finish();
};

exports['test_validate_notempty'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().notEmpty()
  };

  // positive case
  var obj = { a: '1' };
  var obj_ext = { a: '1', b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'notempty test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  var neg = { a: '' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'notempty test (negative case)');

  test.finish();
};

exports['test_validate_regex'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().regex('^a$')
  };

  // positive case
  var obj = { a: 'a' };
  var obj_ext = { a: 'a', b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'regex test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  var neg = { a: 'b' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'regex test (negative case)');

  test.finish();
};

exports['test_validate_notregex'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().notRegex(/e/)
  };

  // positive case
  var obj = { a: 'foobar' };
  var obj_ext = { a: 'foobar', b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'notregex test');
  assert.deepEqual(rv.cleaned, obj);

  test.finish();
};

exports['test_validate_len'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().len(1)
  };

  // positive case
  var obj = { a: '1' };
  var obj_ext = { a: '1', b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'len test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  var neg = { a: '' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'len test (negative case)');

  test.finish();
};

exports['test_validate_null'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().isNull()
  };

  // positive case
  var obj = { a: null};
  var obj_ext = { a: null, b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'null test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  var neg = { a: 'not null' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'null test (negative case)');

  test.finish();
};

exports['test_validate_equals'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().equals(123)
  };

  // positive case
  var obj = { a: 123};
  var obj_ext = { a: 123, b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'equals test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  var neg = { a: 'not 123' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'equals test (negative case)');

  test.finish();
};

exports['test_validate_present'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().notEmpty()
  };

  // positive case
  var obj = { a: 123};
  var obj_ext = { a: 123, b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'validate present');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  var neg = { b: 2 };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'validate (negative case)');

  test.finish();
};

exports['test_validate_contains'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().contains('abc')
  };

  // positive case
  var obj = { a: 'abc'};
  var obj_ext = { a: 'abc', b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'contains test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  var neg = { a: '123' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'contains test (negative case)');

  test.finish();
};

exports['test_validate_not_contains'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().notContains('abc')
  };

  // positive case
  var obj = { a: '123'};
  var obj_ext = { a: '123', b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'not contains test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  var neg = { a: 'abc' };
  rv = swiz.check(schema, neg);
  assert.ok(rv.is_valid === false, 'not contains test (negative case)');

  test.finish();
};

exports['test_validate_chain'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().len(1).isNumeric()
  };

  // positive case
  var obj = { a: '1' };
  var obj_ext = { a: '1', b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'chain test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  rv = swiz.check(schema, { a: '' });
  assert.ok(rv.is_valid === false, 'chain test (negative case)');

  // negative case
  rv = swiz.check(schema, { a: 'A' });
  assert.ok(rv.is_valid === false, 'chain test (negative case)');

  test.finish();
};

exports['test_validate_nested'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().array(new swiz.Valve().isInt().toInt())
  };

  // positive case
  var obj = { a: [1] };
  var obj_ext = { a: ['1'], b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'nested test');
  assert.deepEqual(rv.cleaned, obj);

  test.finish();
};


exports['test_validate_tofloat'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().array(new swiz.Valve().toFloat())
  };

  // positive case
  var obj = { a: [3.145] };
  var obj_ext = { a: ['3.145'], b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'tofloat test');
  assert.ok(typeof rv.cleaned.a[0] === 'number', 'tofloat === number test');
  assert.deepEqual(rv.cleaned, obj);

  test.finish();
};


exports['test_validate_string'] = function(test, assert) {
  var rv, obj, obj_ext;
  var schema = {
    a: new swiz.Valve().string()
  };

  // positive case
  obj = { a: 'test' };
  obj_ext = { a: 'test', b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'string test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  obj = { a: 123 };
  obj_ext = { a: 123, b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === false, 'string test (negative case)');

  test.finish();
};


exports['test_validate_nested_array'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().array(new swiz.Valve().string())
  };

  // positive case
  var obj = { a: ['test'] };
  var obj_ext = { a: ['test'], b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'string test');
  assert.deepEqual(rv.cleaned, obj);

  test.finish();
};

exports['test_validate_nested_hash'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().hash(new swiz.Valve().string(), new swiz.Valve().string())
  };

  // positive case
  var obj = { a: {'test' : 'test'} };
  var obj_ext = { a: {'test' : 'test'}, b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'hash test');
  assert.deepEqual(rv.cleaned, obj);

  test.finish();
};


exports['test_validate_enum'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().enumerated({inactive: 0, active: 1, full_no_new_checks: 2})
  };

  // positive case
  var obj = { a: 2 };
  var obj_ext = { a: 'full_no_new_checks', b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'enum test');
  assert.deepEqual(rv.cleaned, obj);

  test.finish();
};


exports['test_validate_range'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().range(1, 65535)
  };

  // positive case
  var obj = { a: 500 };
  var obj_ext = { a: 500, b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'range test');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  obj = { a: 65536 };
  obj_ext = { a: 65536, b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === false, 'range test');

  test.finish();
};

exports['test_optional_fields'] = function(test, assert) {
  var rv;
  var schema = {
    a: new swiz.Valve().optional().range(1, 65535)
  };

  // positive case
  var obj = { a: 500 };
  var obj_ext = { a: 500, b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'optional fields');
  assert.deepEqual(rv.cleaned, obj);

  // positive case
  var obj = { a: null };
  var obj_ext = { a: null, b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'optional fields (optional)');
  assert.deepEqual(rv.cleaned, obj);


  // negative case
  obj = { a: 65536 };
  obj_ext = { a: 65536, b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === false, 'optional fields');

  test.finish();
};

exports['test_nested_schemas'] = function(test, assert) {
  var rv;
  var schema = {
    a: { b: new swiz.Valve().optional().range(1, 65535) }
  };

  // positive case
  var obj = { a: { b: 500 } };
  var obj_ext = { a: { b: 500}, b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === true, 'optional fields');
  assert.deepEqual(rv.cleaned, obj);

  // negative case
  obj = { a: { b: 65536} };
  obj_ext = { a: { b: 65536}, b: 2 };
  rv = swiz.check(schema, obj_ext);
  assert.ok(rv.is_valid === false , 'optional fields (negative)');

  test.finish();
};
