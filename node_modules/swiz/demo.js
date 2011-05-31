var validate = require('swiz');
var V = require('swiz').V;

// Note: There's one set of definitions that control both serialization
// and validation
var def = {
'Node': [
  ['key', {'val' : new V()}],
  ['ip_address_v4', {'val' : new V().isIP()}]
]};

var validity = validate.defToValve(def);

// Generic payload
var CreatePayload = {
  key: '1234',
  ip_address_v4: '1.2.0.4'
};

console.log('validate a payload:\n');
// Validate the generic payload
var rv = validate.check(validity['Node'], CreatePayload);

console.log(rv);

console.log('\n\nserialize an object\n');
var sw = new validate.Swiz(def);

var obj = rv.cleaned;
obj.getSerializerType = function() {return 'Node';};

sw.serialize(validate.SERIALIZATION.SERIALIZATION_JSON, 1, obj,
  function(err, results) {
    console.log(results);
  });