function getLevenshteinDistance(word1, word2) {
  var word1Len = word1.length;
  var word2Len = word2.length;
  var i, j;
  var deletion, insertion, substitution;
  var cost, minDistance;
  var matrix = [];

  word1 = word1.toLowerCase();
  word2 = word2.toLowerCase();

  for (i = 0; i <= word1Len; i++) {
    matrix[i] = [];
    matrix[i][0] = i;
  }

  for (j = 0; j <= word2Len; j++) {
    matrix[0][j] = j;
  }

  for (i = 1; i <= word1Len; i++) {
    for (j = 1; j <= word2Len; j++) {
      cost = (word1[i - 1] === word2[j - 1]) ? 0 : 1;

      deletion = matrix[i - 1][j] + 1;
      insertion = matrix[i][j - 1] + 1;
      substitution = matrix[i - 1][j - 1] + cost;

      minDistance = Math.min(deletion, insertion, substitution);
      matrix[i][j] = minDistance;
    }
  }

  return matrix[word1Len][word2Len];
}

function getDistances(word, dictionary) {
  var i;
  var word2;
  var dictionaryLen = dictionary.length;
  var distances = {};

  for (i = 0; i < dictionaryLen; i++) {
    word2 = dictionary[i];
    distances[word2] = getLevenshteinDistance(word, word2);
  }

  return distances;
}

function getCandidates(word, dictionary, maxDistance) {
  var candidates = getDistances(word, dictionary);
  var candidatesLen = dictionary.length;
  var key, value;

  if (!maxDistance) {
    return candidates;
  }

  for (key in candidates) {
    if (candidates.hasOwnProperty(key)) {
      value = candidates[key];

      if (value > maxDistance) {
        delete candidates[key];
      }
    }
  }

  return candidates;
}

function getMinValue(values) {
  var key, value, minKey, minValue = Number.MAX_VALUE;

  for (key in values) {
    if (values.hasOwnProperty(key)) {
      value = values[key];
      if (value < minValue) {
        minKey = key;
        minValue = value;
      }
    }
  }

  return minKey;
}

function getCorrection(word, dictionary, maxDistance) {
  var candidates, candidate;

  word = word.toLowerCase();
  if (dictionary.hasOwnProperty(word)) {
    return word;
  }

  candidates = getCandidates(word, dictionary, maxDistance);

  if (Object.keys(candidates).length === 0) {
    return null;
  }

  candidate = getMinValue(candidates);
  return candidate;
}

exports.getLevenshteinDistance = getLevenshteinDistance;
exports.getDistance = getLevenshteinDistance;
exports.getCandidates = getCandidates;
exports.getCorrection = getCorrection;
