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
var Errorf = require('util/misc').Errorf;

/* Style table taken from the Node util module */
var styles = { 'bold'      : [1,  22],
               'italic'    : [3,  23],
               'underline' : [4,  24],
               'inverse'   : [7,  27],
               'white'     : [37, 39],
               'grey'      : [90, 39],
               'black'     : [30, 39],
               'blue'      : [34, 39],
               'cyan'      : [36, 39],
               'green'     : [32, 39],
               'magenta'   : [35, 39],
               'red'       : [31, 39],
               'yellow'    : [33, 39]
};

/* An array of terminal which support ANSI escape codes */
var terminal_support_ansi_codes =  [ 'xterm', 'xterm-color', 'screen', 'vt100', 'vt100-color' ];

/* If true, formatting will be applied to all the text passed to the puts function. */
var use_ansi_codes = true;

/**
 * Print a formatted table to standard output.
 *
 * @param {Array} columns Array of objects. Each object must contains the following properties (optional properties are marked with *):
 *                        {String} title - column title
 *                        {String} value_property - name of the property in the rows object which holds the value for this column
 *                        {Number} padding_left* - left pad the string to the width provided
 *                        {Number} padding_right* - right pad the string to the width provided
 *                        {Function} format_function* - a function which is applied for each value of this column.
 *
 * @param {Array} rows Array of objects which hold the values for each column.
 * @param {String} no_data_text The text which is printed to standard output if the rows array is empty.
 */
exports.print_table = function(columns, rows, no_data_text) {
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

/**
 * Print the provided text to stdout preceeded by the specified number of
 * spaces and wrapped, at spaces, to a maximum of the specified width.
 *
 * @param {String} text   The text to print
 * @param {Number} width  The maximum line length, defaults to 80
 * @param {Number} indent How many spaces to use as indent, defaults to 2
 * @param {Function} output_function Output function (defaults to sys.puts)
 */
exports.print_wrapped = function(text, width, indent, output_function) {
  var chunk, split_index, remaining, indentstr;
  width = width || 80;
  indent = indent || 2;
  output_function = output_function || sys.puts;
  indentstr = new Array(indent + 1).join(' ');
  remaining = text;

  while (remaining.length > (width - indent)) {
    chunk = remaining.slice(0, (width - indent));
    split_index = chunk.lastIndexOf(' ');
    chunk = chunk.slice(0, split_index);
    remaining = remaining.substr(split_index + 1);
    output_function(indentstr + chunk);
  }

  output_function(indentstr + remaining);
};

/*
 * Ask user a question and return the input.
 *
 * @param {String} question Question which is sent to standard output
 * @param {Array} valid_options Array of valid options (e.g. ['yes', 'no'])
 * @param {String} default_option Option which is used as a default if empty line is received
 * @param {Function} callback Callback which is called with user input
 */
exports.prompt = function(question, valid_options, default_option, callback) {
  var stdin = process.openStdin();
  stdin.resume();
  var options, option, question_mark, data_string;

  if (valid_options) {
    if (default_option && !misc.in_array(default_option, valid_options)) {
      throw new Errorf('Invalid default option: %s', default_option);
    }

    option = (default_option) ? sprintf(' [%s]', default_option) : '';
    options = sprintf(' (%s)%s', valid_options.join(', '), option);
  }
  else {
    options = '';
  }

  if (question[question.length - 1] === '?') {
    question = question.substr(0, (question.length - 1));
    question_mark = '?';
  }
  else {
    question_mark = '';
  }

  sys.print(sprintf('%s%s%s ', question, options, question_mark));

  function handle_data(data) {
    data_string = data.toString().trim();

    if (!data_string && (valid_options && default_option)) {
      data_string = default_option;
    }

    if (data_string) {
      if (valid_options && !misc.in_array(data_string, valid_options)) {
        sys.puts(sprintf('Invalid option "%s", valid options are: %s', data_string,
                         valid_options.join(', ')));
        return;
      }
      // Pause is necessary to get Node to exit without manual intervention
      stdin.pause();
      stdin.removeListener('data', handle_data);
      callback(data_string);
    }
  }

  stdin.on('data', handle_data);
};

/*
 * Apply formatting to the input string (replaces formatting tag with the corresponding ANSI escape codes).
 *
 * @param {String} string String with the formatting tags (tags can also be nested). For example:
 *                        [italic]italic text[/italic] [bold][red]bold red text[/red][/bold]
 *
 * @return {String} String with formatting applied.
 */
exports.stylize = function(string) {
  var stylized = string;
  var style_regex = Object.keys(styles).join('|');
  var key, regex;

  var replace_function = function(str, p1, p2, p3) {
    return sprintf('\033[%sm%s\033[%sm', styles[p2][0], p3, styles[p2][1]);
  };

  for (key in styles) {
    if (styles.hasOwnProperty(key)) {
      if (stylized.indexOf(sprintf('[%s]', key)) === -1) {
        continue;
      }

      regex = new RegExp(sprintf('(\\[(%s)\\])(.*?)(\\[/(%s)\\])', key, key), 'gi');
      stylized = stylized.replace(regex, replace_function);
    }
  }

  return stylized;
};

/*
 * Apply formatting and call Node puts function for each of the input arguments.
 *
 * @param {String}
*/
exports.puts = function() {
  var term = process.env.TERM;

  if (!use_ansi_codes || !term || !misc.in_array(term.toLowerCase(), terminal_support_ansi_codes)) {
    sys.puts.apply(this, arguments);
    return;
  }

  for (var i = 0; i < arguments.length; i++) {
    sys.puts(exports.stylize(arguments[i]));
  }
};
