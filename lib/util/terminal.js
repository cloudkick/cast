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

var sprintf = require('sprintf').sprintf;

var misc = require('util/misc');
var Errorf = require('util/misc').Errorf;

/* Style table taken from the Node util module */
var styles = { 'bold' : [1, 22],
               'italic' : [3, 23],
               'underline' : [4, 24],
               'inverse' : [7, 27],
               'white' : [37, 39],
               'grey' : [90, 39],
               'black' : [30, 39],
               'blue' : [34, 39],
               'cyan' : [36, 39],
               'green' : [32, 39],
               'magenta' : [35, 39],
               'red' : [31, 39],
               'yellow' : [33, 39]
};

/* An array of terminal which support ANSI escape codes */
var terminalSupportAnsiCodes = ['xterm', 'xterm-color', 'screen', 'vt100', 'vt100-color',
                                'xterm-256color'];

/* If true, formatting will be applied to all the text passed to the puts function. */
var useAnsiCodes = true;

/*
 * Return total length of all the style tags in the provided string.
 *
 * @param {Number} Length of all the style tags in the provided string.
 */
function getStylesLength(string) {
  var i, styleNames, stylesCount, style;
  var stylesLength = 0;


  styleNames = Object.keys(styles);
  stylesCount = styleNames.length;
  for (i = 0; i < stylesCount; i++) {
    style = styleNames[i];
    if (string.indexOf(sprintf('[%s]', style)) !== -1 &&
        string.indexOf(sprintf('[/%s]', style)) !== -1) {
      stylesLength += (style.length + 5);
    }
  }

  return stylesLength;
}

/**
 * Left pad the given string to the maximum width provided.
 *
 * @param  {String} str Input string.
 * @param  {Number} width Desired length.
 * @return {String} Left padded string.
 */
function lpad(str, width) {
  var n, stylesLength;

  str = String(str);
  stylesLength = getStylesLength(str);
  n = (width + stylesLength) - str.length;

  if (n < 1) {
    return str;
  }

  while (n--) {
    str = ' ' + str;
  }

  return str;
}

/**
 * Right Pad the given string to the maximum width provided.
 *
 * @param  {String} str Input string.
 * @param  {Number} width Desired Lenght.
 * @return {String} Right padded string.
 */
function rpad(str, width) {
  var n, stylesLength;

  str = String(str);
  stylesLength = getStylesLength(str);
  n = (width + stylesLength) - str.length;

  if (n < 1) {
    return str;
  }

  while (n--) {
    str = str + ' ';
  }

  return str;
}

/**
 * Print a formatted table to the standard output.
 *
 * @param {Array} columns Array of objects. Each object must contains the
 *     following properties (optional properties are marked with *):
 *     {String} title - column title
 *     {?String|?Array} valueProperty - name of the property in the rows object which
 *                                holds the value for this column.
 *                                If formatFunction is defined this value can
 *                                also be an array which will be passed to this
 *                                function.
 *     {?Number} paddingLeft - left pad the string to the width provided
 *     {?Number} paddingRight - right pad the string to the width provided
 *     {Function} formatFunction* - a function which is applied for each value
 *                                  of this column.
 *
 * @param {Array} rows Array of objects which hold the values for each column.
 * @param {String} noDataText The text which is printed to standard output if
 *                            the rows array is empty.
 */
function printTable(columns, rows, noDataText) {
  var i, valuePropertyLen, valueProperyItem;
  var string, columnTitle, valueProperty, value, paddingLeft, paddingRight;
  var _noDataText = noDataText || 'No data available';

  if (rows.length === 0) {
    sys.print(_noDataText);
  } else {
    columns.forEach(function(column) {
      columnTitle = column.title;

      if (column.hasOwnProperty('paddingLeft')) {
        paddingLeft = column.paddingLeft;
      } else {
        paddingLeft = 0;
        column.paddingLeft = 0;
      }

      if (column.hasOwnProperty('paddingRight')) {
        paddingRight = column.paddingRight;
      } else {
        paddingRight = 0;
        column.paddingRight = 0;
      }

      string = lpad(columnTitle, paddingLeft);
      string = rpad(string, column.paddingRight);

      sys.print(string);
    });

    sys.print('\n');

    rows.forEach(function(row) {
      columns.forEach(function(column) {
        columnTitle = column.title;
        valueProperty = column.valueProperty || columnTitle.toLowerCase();
        value = row[valueProperty];

        if (column.hasOwnProperty('formatFunction')) {
          if (!(valueProperty instanceof Array)) {
            value = [ value ];
          }
          else {
            value = [];
            valuePropertyLen = valueProperty.length;
            for (i = 0; i < valuePropertyLen; i++) {
              valueProperyItem = valueProperty[i];
              value.push(row[valueProperyItem]);
            }
          }

          value = column.formatFunction.apply(null, value);
        }

        string = lpad(value, column.paddingLeft);
        string = rpad(string, column.paddingRight);

        sys.print(string);
      });

      sys.print('\n');
    });
  }

  sys.print('\n');
}

/**
 * Print the provided text to stdout preceeded by the specified number of
 * spaces and wrapped, at spaces, to a maximum of the specified width.
 *
 * @param {String} text   The text to print.
 * @param {Number} width  The maximum line length, defaults to 80.
 * @param {Number} indent How many spaces to use as indent, defaults to 2.
 * @param {Function} outputFunction Output function (defaults to sys.puts).
 */
function printWrapped(text, width, indent, outputFunction) {
  var chunk, stylesLength, splitIndex, remaining, indentstr;
  width = width || 80;
  indent = indent || 2;
  outputFunction = outputFunction || sys.puts;
  stylesLength = getStylesLength(text);

  indentstr = new Array(indent + 1).join(' ');
  width = width + stylesLength;
  remaining = text;

  while (remaining.length > (width - indent)) {
    chunk = remaining.slice(0, (width - indent));
    splitIndex = chunk.lastIndexOf(' ');
    chunk = chunk.slice(0, splitIndex);
    remaining = remaining.substr(splitIndex + 1);
    outputFunction(indentstr + chunk);
  }

  outputFunction(indentstr + remaining);
}

/*
 * Ask user a question and return the input.
 *
 * @param {String} question Question which is sent to standard output
 * @param {Array} validOptions Array of valid options (e.g. ['yes', 'no'])
 * @param {String} defaultOption Option which is used as a default if empty line is received
 * @param {Function} callback Callback which is called with user input
 */
function prompt(question, validOptions, defaultOption, callback) {
  var stdin = process.openStdin();
  stdin.resume();
  var options, option, questionMark, dataString;

  if (validOptions) {
    if (defaultOption && !misc.inArray(defaultOption, validOptions)) {
      throw new Errorf('Invalid default option: %s', defaultOption);
    }

    option = (defaultOption) ? sprintf(' [%s]', defaultOption) : '';
    options = sprintf(' (%s)%s', validOptions.join('/'), option);
  }
  else {
    options = '';
  }

  if (question[question.length - 1] === '?') {
    question = question.substr(0, (question.length - 1));
    questionMark = '?';
  }
  else {
    questionMark = '';
  }

  sys.print(sprintf('%s%s%s ', question, options, questionMark));

  function handleData(data) {
    dataString = data.toString().trim();

    if (!dataString && (validOptions && defaultOption)) {
      dataString = defaultOption;
    }

    if (dataString) {
      if (validOptions && !misc.inArray(dataString, validOptions)) {
        sys.puts(sprintf('Invalid option "%s", valid options are: %s', dataString,
                         validOptions.join(', ')));
        return;
      }
      // Pause is necessary to get Node to exit without manual intervention
      stdin.pause();
      stdin.removeListener('data', handleData);
      callback(dataString);
    }
  }

  stdin.on('data', handleData);
}

/*
 * Replaces style tags with string provided by the replaceFunction.
 *
 * @param {String} string String with the formatting tags (tags can also be nested). For example:
 *                        [italic]italic text[/italic] [bold][red]bold red text[/red][/bold]
 * @param {Function} replaceFunction Function which is called with matched style tags and the
 *                                    text in-between. The function needs to return a string which
 *                                    replaces the provided text.
 *
 * @return {String} String which has been iterated over and passed to the replaceFunction.
*/
function formatTags(string, replaceFunction) {
  var stylized = string;
  var styleRegex = Object.keys(styles).join('|');
  var key, regex;

  if (!stylized) {
    return '';
  }

  for (key in styles) {
    if (styles.hasOwnProperty(key)) {
      if (stylized.indexOf(sprintf('[%s]', key)) === -1) {
        continue;
      }

      regex = new RegExp(sprintf('(\\[(%s)\\])(.*?)(\\[/(%s)\\])', key, key), 'gi');
      stylized = stylized.replace(regex, replaceFunction);
    }
  }

  return stylized;
}

/*
 * Apply formatting to the input string (replaces formatting tag with the corresponding ANSI escape codes).
 *
 * @param {String} string String with the formatting tags (tags can also be nested). For example:
 *                        [italic]italic text[/italic] [bold][red]bold red text[/red][/bold]
 *
 * @return {String} String with formatting applied.
 */
function stylize(string) {
  function replaceFunction(str, p1, p2, p3) {
    return sprintf('\033[%sm%s\033[%sm', styles[p2][0], p3, styles[p2][1]);
  }

  return formatTags(string, replaceFunction);
}

/*
 * Remove style tags from the input string.
 *
 * @param {String} string String with the formatting tags (tags can also be nested). For example:
 *                        [italic]italic text[/italic] [bold][red]bold red text[/red][/bold]
 *
 * @return {String} String without the style tags.
*/
function stripStyles(string) {
  function replaceFunction(str, p1, p2, p3) {
    return sprintf('%s', p3);
  }

  return formatTags(string, replaceFunction);
}

/*
 * Apply formatting and call Node puts function for each of the input arguments.
 *
 * @param {String}
*/
function puts() {
  var term = process.env.TERM;
  var supportsStyles = true;

  if (!useAnsiCodes || !term || !misc.inArray(term.toLowerCase(), terminalSupportAnsiCodes)) {
    supportsStyles = false;
  }

  for (var i = 0; i < arguments.length; i++) {
    if (supportsStyles) {
      sys.puts(stylize(arguments[i]));
    }
    else {
      sys.puts(stripStyles(arguments[i]));
    }
  }
}

exports.getStylesLength = getStylesLength;
exports.lpad = lpad;
exports.rpad = rpad;
exports.printTable = printTable;
exports.printWrapped = printWrapped;
exports.prompt = prompt;
exports.formatTags = formatTags;
exports.stylize = stylize;
exports.stripStyles = stripStyles;
exports.puts = puts;
