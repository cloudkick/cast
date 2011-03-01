#!/usr/local/bin/node

/**
 * @fileoverview  This example will try to showcase some of the great features
 *  of the closure compiler.  Such things as:
 * <ul>
 *  <li>Encapsulisation</li>
 *  <li>Interfaces</li>
 *  <li>Type Safety</li>
 *  <li>Code Optimisation</li>
 *  <li>Compile Time Checkings</li>
 *  <li>Code Documentaion</li>
 *  <li>
 *    Provides a Scalable Framework for Enterprise JavaScript Development.
 *  </li>
 * </ul>
 */

/*
 * Does not require an opts parameter as we are providing all the options in
 * the closure.json file in this directory;
 */
require('nclosure').nclosure();

/*
 * Now that the nclosure is initialised you can use any base.js functionality
 * such as goog.require / goog.provide
 *
 * Note: At least one namespace must be provided for compilation purposes
 */

goog.provide('nclosure.examples.animals.Example');

goog.require('goog.array');
goog.require('nclosure.examples.animals.Cat');
goog.require('nclosure.examples.animals.Dog');
goog.require('nclosure.examples.animals.IAnimal');
goog.require('nclosure.examples.animals.Monkey');
goog.require('nclosure.examples.animals.Tiger');



/**
 * @constructor
 */
nclosure.examples.animals.Example = function() {
  /**
   * @private
   * @type {Array.<nclosure.examples.animals.IAnimal>}
   */
  this.animals_ = this.initRandomAnimals_();
  this.makeAnimalsTalk_();
  console.log('Bye!');
};


/**
 * @private
 * @return {Array.<nclosure.examples.animals.IAnimal>} A colleciton of
 *    random animals.
 */
nclosure.examples.animals.Example.prototype.initRandomAnimals_ = function() {
  /** @type {Array.<nclosure.examples.animals.IAnimal>} */
  var animals = [];
  var types = [
    nclosure.examples.animals.Dog,
    nclosure.examples.animals.Cat,
    nclosure.examples.animals.Tiger,
    nclosure.examples.animals.Monkey
  ];
  var len = parseInt(10 + (Math.random() * 10), 10);
  console.log('Creating ' + len + ' random animals');
  for (var i = 0; i < len; i++) {
    var t = types[parseInt(Math.random() * types.length, 10)];
    animals.push(new t());
  }
  return animals;
};


/**
 * @private
 */
nclosure.examples.animals.Example.prototype.makeAnimalsTalk_ = function() {
  /** @type {Array.<nclosure.examples.animals.IAnimal>} */
  goog.array.forEach(this.animals_, this.makeAnimalTalk_, this);

};


/**
 * @private
 * @param {nclosure.examples.animals.IAnimal} animal The animal to talkify.
 */
nclosure.examples.animals.Example.prototype.makeAnimalTalk_ =
    function(animal) {
  animal.talk();
};


/*
 * Start the demo
 */
new nclosure.examples.animals.Example();
