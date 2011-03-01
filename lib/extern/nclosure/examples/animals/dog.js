goog.provide('nclosure.examples.animals.Dog');

goog.require('nclosure.examples.animals.IAnimal');



/**
 * @constructor
 * @implements {nclosure.examples.animals.IAnimal}
 */
nclosure.examples.animals.Dog = function() {};


/** @inheritDoc */
nclosure.examples.animals.Dog.prototype.talk = function() {
  console.log('WOOOOFF');
};
