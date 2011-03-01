
goog.provide('nclosure.examples.animals.Cat');

goog.require('nclosure.examples.animals.CatLike');
goog.require('nclosure.examples.animals.IAnimal');



/**
 * @constructor
 * @extends {nclosure.examples.animals.CatLike}
 */
nclosure.examples.animals.Cat = function() {
  nclosure.examples.animals.CatLike.call(this);
};
goog.inherits(nclosure.examples.animals.Cat,
    nclosure.examples.animals.CatLike);
