var spellCorrector = require('./lib/corrector');

exports.getLevenshteinDistance = spellCorrector.getLevenshteinDistance;
exports.getDistance = spellCorrector.getDistance;
exports.getCandidates = spellCorrector.getCandidates;
exports.getCorrection = spellCorrector.getCorrection;
