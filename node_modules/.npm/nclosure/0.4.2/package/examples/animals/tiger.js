goog.provide('nclosure.examples.animals.Tiger');

goog.require('nclosure.examples.animals.CatLike');
goog.require('nclosure.examples.animals.IAnimal');



/**
 * @constructor
 * @extends {nclosure.examples.animals.CatLike}
 */
nclosure.examples.animals.Tiger = function() {
  nclosure.examples.animals.CatLike.call(this);
};
goog.inherits(nclosure.examples.animals.Tiger,
    nclosure.examples.animals.CatLike);


/**
 * @override
 * Don't use te default implementation of CatLike.talk as tigers are very
 *    special and deserve respect.
 */
nclosure.examples.animals.Tiger.prototype.talk = function() {
  console.log('SCARY TIGGGGER NOISE!!!');
};
