/*
 * Licensed to Cloudkick, Inc ('Cloudkick') under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * Cloudkick licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var async = require('async');

var misc = require('util/misc');
var validators = require('manifest/validators');

exports['test_validator_functions'] = function(test, assert) {
  var validator, validatorValues, validValues, invalidValues;
  var values = {
    'valid_type': {
      'valid': ['nodejs', 'shell'],
      'invalid': ['foo', 'foobar']
    },
    'valid_string': {
      'valid': ['string', 'foobar', String('foobar'), new String('foobar')],
      'invalid': [1, [1,2,3], {'a': 'b'}]
    },
    'valid_number': {
      'valid': [1, 100, Number(100), new Number('10')],
      'invalid': ['a', {'a': 'b'}, ['1', 2], Array(), new String('foobar'), String('foobar')]
    },
    'valid_object': {
      'valid': [{}, {1: 2}, {'foo': 'bar'}],
      'invalid': ['a', 1, null, undefined]
    },
    'valid_array': {
      'valid': [[], [1, 2, 3], new Array(), Array()],
      'invalid': ['a', 1, null, undefined]
    },
    'valid_port': {
      'valid': [1, 65535, 1024],
      'invalid': [-1, 65536, 'a']
    },
    'valid_template_variable': {
      'valid': [{'key': 'foobar'}, {'key': 111}],
      'invalid': [Array(), {'a': {'a': 'b'}}, 1, 'abc', [1,2,3], {'key': [1,2]}]
    }
  };

  async.forEach(Object.keys(values), function(validator, callback) {
    validatorValues = values[validator];
    validValues = validatorValues['valid'];
    invalidValues = validatorValues['invalid'];

    async.parallel([
      function testValidValues(callback) {
        async.forEach(validValues, function(value, callback) {
          validators.validateValue(value, validator, null, function onValidated(err) {
            assert.ok(!err);
            callback();
          });
        }, callback);
      },

      function testInvalidValues(callback) {
        async.forEach(invalidValues, function(value, callback) {
          validators.validateValue(value, validator, null, function onValidated(err) {
            assert.ok(err);
            assert.ok((err instanceof Error) || (err instanceof misc.Errorf));
            callback();
          });
        }, callback);
      }
    ],

    function(err) {
      callback(err);
    });
  },

  function(err){
    assert.ifError(err);
    test.finish();
  });
};
