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

var util = require('util');

var swiz = require('swiz');


// Mock set of serialization defs
var def = {
  'Node' : [
    ['id' , {'src' : 'hash_id', 'type' : 'string',
      'desc' : 'hash ID for the node'}],
    ['is_active' , {'src' : 'active', 'type' : 'bool',
      'desc' : 'is the node active?'}],
    ['name' , {'src' : 'get_name', 'type' : 'string', 'desc' : 'name' }],
    ['agent_name' , {'type': 'string'}],
    ['ipaddress' , {'src' : 'get_public_address', 'type' : 'ip'}],
    ['public_ips' , {'cache_key' : 'node_addrs_public', 'type' : 'list<ip>'}],
    ['state', {'enumerated' : {inactive: 0, active: 1, full_no_new_checks: 2}}],
    ['opts', {'src': 'options', 'type': 'map<string, NodeOpts>'}]
  ],
  'NodeOpts': [
    ['opt1', {'src': 'opt1', 'type': 'string'}],
    ['opt2', {'src': 'opt2', 'type': 'string'}]
  ]
};



/** Completely mock node object.
* @constructor
*/
function Node(options) {
  this.hash_id = '15245';
  this.active = true;
  this.agent_name = 'gl<ah';
  this.public_ips = ['123.45.55.44', '122.123.32.2'];
  this.state = 1;

  if (options) {
    this.options = options;
  } else {
    this.options = {
      'opt1': 'defaultval',
      'opt2': 'defaultval'
    };
  }

  this.options.getSerializerType = function() {
    return 'NodeOpts';
  };
}


/**
 * Dummy funct
 * @param {function(*,*)} callback junk.
 */
Node.prototype.get_name = function(callback) {
  callback(null, 'gggggg');
};


/**
 * Dummy funct
 * @param {function(*,*)} callback junk.
*/
Node.prototype.get_public_address = function(callback) {
  callback(null, '123.33.22.1');
};


/**
 * Dummy funct
 * @return {string} junk.
*/
Node.prototype.getSerializerType = function() {return 'Node';};

exports['test_xml_escape_string'] = function(test, assert) {
  var sw = new swiz.Swiz(def);
  assert.deepEqual(sw.xmlEscapeString('<&blah>'), '&lt;&amp;blah&gt;');

  test.finish();
};


exports['test_build_object'] = function(test, assert) {
  var blahnode = new Node();
  var sw = new swiz.Swiz(def);
  sw.buildObject(blahnode, function(err, result) {
    assert.ifError(err);
    assert.deepEqual(result, {
      id: 15245,
      is_active: true,
      name: 'gggggg',
      agent_name: 'gl<ah',
      ipaddress: '123.33.22.1',
      public_ips: ['123.45.55.44', '122.123.32.2'],
      opts: {
        opt1: 'defaultval',
        opt2: 'defaultval'
      },
      state: 'active'
    });
    test.finish();
  });
};


exports['test_serial_xml'] = function(test, assert) {
  var blahnode = new Node();
  var sw = new swiz.Swiz(def);
  //swiz.loadDefinitions(def);
  sw.serialize(swiz.SERIALIZATION.SERIALIZATION_XML, 1, blahnode,
      function(err, results)
      {
        // need to make an appointemnt with a DOM for this one.
        assert.deepEqual(results, '<?xml version="1.0" encoding="UTF-8"?>' +
            '<Node><id>15245</id><is_active>true</' +
            'is_active><name>gggggg</name><agent_name>gl&lt;ah</' +
            'agent_name><ipaddress>123.33.22.1</ipaddress>' +
            '<public_ips>123.45.55.44</public_ips>' +
            '<public_ips>122.123.32.2</public_ips>' +
            '<state>active</state>' +
            '<opts><NodeOpts>' +
            '<opt1>defaultval</opt1>' +
            '<opt2>defaultval</opt2>' +
            '</NodeOpts></opts></Node>');

        test.finish();
      }
  );
};

exports['test_serial_json'] = function(test, assert) {
  var blahnode = new Node();
  var sw = new swiz.Swiz(def);
  //swiz.loadDefinitions(def);
  sw.serialize(swiz.SERIALIZATION.SERIALIZATION_JSON, 1, blahnode,
      function(err, results)
      {
        var rep = JSON.parse(results);
        assert.deepEqual(rep.id, 15245);
        assert.deepEqual(rep.is_active, true);
        assert.deepEqual(rep.name, 'gggggg');
        assert.deepEqual(rep.agent_name, 'gl<ah');
        assert.deepEqual(rep.ipaddress, '123.33.22.1');
        assert.deepEqual(rep.public_ips, ['123.45.55.44', '122.123.32.2']);
        assert.deepEqual(rep.opts, {
          opt1: 'defaultval',
          opt2: 'defaultval'
        });
        assert.deepEqual(rep.state, 'active');
        test.finish();
      }
  );
};

exports['test_serial_array_xml'] = function(test, assert) {
  var blahnode = new Node();
  var blahnode2 = new Node();
  blahnode2.hash_id = '444';
  blahnode2.agent_name = 'your mom';
  var blaharr = [blahnode, blahnode2];
  var sw = new swiz.Swiz(def);
  sw.serialize(swiz.SERIALIZATION.SERIALIZATION_XML, 1, blaharr,
      function(err, results)
      {

        assert.deepEqual(results, '<?xml version="1.0" encoding="UTF-8"?>' +
            '<group><Node><id>15245</id><is_active>true</' +
            'is_active><name>gggggg</name><agent_name>gl&lt;ah</' +
            'agent_name><ipaddress>123.33.22.1</ipaddress>' +
            '<public_ips>123.45.55.44</public_ips>' +
            '<public_ips>122.123.32.2</public_ips>' +
            '<state>active</state>' +
            '<opts><NodeOpts>' +
            '<opt1>defaultval</opt1><opt2>defaultval</opt2>' +
            '</NodeOpts></opts></Node>' +
            '<Node><id>444</id><is_active>true</' +
            'is_active><name>gggggg</name><agent_name>your mom</' +
            'agent_name><ipaddress>123.33.22.1</ipaddress>' +
            '<public_ips>123.45.55.44</public_ips>' +
            '<public_ips>122.123.32.2</public_ips>' +
            '<state>active</state>' +
            '<opts><NodeOpts>' +
            '<opt1>defaultval</opt1><opt2>defaultval</opt2>' +
            '</NodeOpts></opts></Node></group>');

        test.finish();
      }
  );
};

exports['test_error_type'] = function(test, assert) {
  var blah = { };
  var sw = new swiz.Swiz(def);
  blah.getSerializerType = function() {return 'monito';};
  sw.serialize(swiz.SERIALIZATION.SERIALIZATION_JSON, 1, blah,
      function(err, results)
      {
        assert.ok(err instanceof Error);

        test.finish();
      }
  );
};


exports['test_serial_array_json'] = function(test, assert) {
  var blahnode = new Node();
  var blahnode2 = new Node();
  blahnode2.hash_id = '444';
  blahnode2.agent_name = 'your mom';
  var blaharr = [blahnode, blahnode2];
  var sw = new swiz.Swiz(def);
  sw.serialize(swiz.SERIALIZATION.SERIALIZATION_JSON, 1, blaharr,
      function(err, results)
      {
        var rep = JSON.parse(results);
        assert.deepEqual(rep[0].id, 15245);
        assert.deepEqual(rep[0].is_active, true);
        assert.deepEqual(rep[0].name, 'gggggg');
        assert.deepEqual(rep[0].agent_name, 'gl<ah');
        assert.deepEqual(rep[0].ipaddress, '123.33.22.1');
        assert.deepEqual(rep[0].public_ips,
            ['123.45.55.44', '122.123.32.2']);
        assert.deepEqual(rep[0].opts, {
          opt1: 'defaultval',
          opt2: 'defaultval'
        });
        assert.deepEqual(rep[0].state, 'active');
        assert.deepEqual(rep[1].id, 444);
        assert.deepEqual(rep[1].is_active, true);
        assert.deepEqual(rep[1].name, 'gggggg');
        assert.deepEqual(rep[1].agent_name, 'your mom');
        assert.deepEqual(rep[1].ipaddress, '123.33.22.1');
        assert.deepEqual(rep[1].public_ips,
            ['123.45.55.44', '122.123.32.2']);
        assert.deepEqual(rep[1].opts, {
          opt1: 'defaultval',
          opt2: 'defaultval'
        });
        assert.deepEqual(rep[1].state, 'active');
        test.finish();
      }
  );
};
