goog.provide('nclosure.examples.animals.CatLike');

goog.require('nclosure.examples.animals.IAnimal');



/**
 * @constructor
 * @implements {nclosure.examples.animals.IAnimal}
 */
nclosure.examples.animals.CatLike = function() {};


/**
  * This is a default implementaion of talk for cat like animals, special cats
  * may want to override this.
  *
  * @inheritDoc
  */
nclosure.examples.animals.CatLike.prototype.talk = function() {
  console.log('MEEEAWWW');
};
