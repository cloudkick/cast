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

var misc = require('util/misc');

/**
 * Print a formatted table to standard output.
 *
 * @param {Array} columns Array of objects. Each object must contains the following properties (optional properties are marked with *):
 *                        {String} title - column title
 *                        {String} value_property - name of the property in the rows object which holds the value for this column
 *                        {Number} padding_left* - left pad the string to the width provided
 *                        {Number} padding_right* - right pad the string to the width provided,
 *                        {Function} format_function* - a function which is applied for each value of this column
 *
 * @param {Array} rows Array of objects which hold the values for each column
 * @param {String} no_data_text The text which is printed to standard output if the rows array is empty
 */
var print_table = function(columns, rows, no_data_text) {
  var string, column_title, value_property, value, padding_left, padding_right;
  var _no_data_text = no_data_text || 'No data available';

  if (rows.length === 0) {
    sys.print(_no_data_text);
  }
  else
  {
    columns.forEach(function(column) {
      column_title = column.title;

      if (column.hasOwnProperty('padding_left')) {
        padding_left = column.padding_left;
      }
      else {
        padding_left = 0;
        column.padding_left = 0;
      }

      if (column.hasOwnProperty('padding_right')) {
        padding_right = column.padding_right;
      }
      else {
        padding_right = 0;
        column.padding_right = 0;
      }

      string = misc.lpad(column_title, padding_left);
      string = misc.rpad(string, column.padding_right);

      sys.print(string);
    });

    sys.print('\n');

    rows.forEach(function(row) {
      columns.forEach(function(column) {
        column_title = column.title;
        value_property = column.value_property || column_title.toLowerCase();
        value = row[value_property];

        if (column.hasOwnProperty('format_function')) {
          value = column.format_function.call(null, value);
        }

        string = misc.lpad(value, column.padding_left);
        string = misc.rpad(string, column.padding_right);

        sys.print(string);
      });

      sys.print('\n');
    });
  }

  sys.print('\n');
};

exports.print_table = print_table;
