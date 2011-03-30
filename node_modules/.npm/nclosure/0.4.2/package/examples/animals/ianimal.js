
goog.provide('nclosure.examples.animals.IAnimal');



/**
 * This is the base animal interface that will be inherited by all animals.
 *
 * @interface
 */
nclosure.examples.animals.IAnimal = function() {};


/**
 * Makes the animal talk in its own special way
 */
nclosure.examples.animals.IAnimal.prototype.talk = goog.abstractMethod;
