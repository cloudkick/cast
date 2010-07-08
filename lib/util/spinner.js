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

var sys = require('sys');
var sprintf = require('extern/sprintf').sprintf;
var dots = ['|', '/', '-', '\\'];

function Spinner(prompter) {
  this.ticks = 0;
  this.promptstr = prompter;
}

Spinner.prototype.start = function() {
  process.stdout.write("\n"+ this.promptstr + "  ");
  this.tick();
};

Spinner.prototype.update = function(c) {
  process.stdout.write("\b"+ c);
};

Spinner.prototype.tick = function()
{
  this.ticks++;
  var c = dots[this.ticks % dots.length];
  this.update(c);
};

Spinner.prototype.end = function() {
  process.stdout.write("\n");
};

function PercentSpinner(prompter, max) {
  this.max = max
  this.current = 0;
  this.promptstr = prompter;
}

PercentSpinner.prototype.start = function() {
  process.stdout.write("\n"+ this.promptstr + "       ");
  this.tick(0);
};

PercentSpinner.prototype.update = function(c) {
  process.stdout.write("\b\b\b\b\b"+ c);
};

PercentSpinner.prototype.tick = function(value)
{
  this.current = value;
  var p = (this.current / this.max) * 100;
  this.update(sprintf("%4d%%", p));
};

PercentSpinner.prototype.end = function() {
  process.stdout.write("\n");
};

exports.spinner = function(prompter) {
  return new Spinner(prompter);
};

exports.percent = function(prompter, max) {
  return new PercentSpinner(prompter, max);
};


/*
(function() {
  sys.puts("Starting process...");
  var s = new Spinner("Dan's Demo")
  s.start();
  var inner = setInterval(function(){
    s.tick();
    if (s.ticks >= 100) {
      s.end();
      clearInterval(inner);
    }
  }, 30);
})();
*/


