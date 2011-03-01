goog.provide('nclosure.examples.animals.Monkey');

goog.require('nclosure.examples.animals.IAnimal');



/**
 * @constructor
 * @implements {nclosure.examples.animals.IAnimal}
 */
nclosure.examples.animals.Monkey = function() {};


/** @inheritDoc */
nclosure.examples.animals.Monkey.prototype.talk = function() {
  console.log('MONKEY MONKEY MONKEY');
};
