/*
 * predictor.js
 * Two small machine learning models that learn while the app is running.
 *
 * 1. A naive Bayes classifier that scores how likely each action is given the
 *    current context (time of day and weekday vs. weekend).
 * 2. A first order Markov chain that guesses the next action from the last one.
 *
 * Both are trained online. There is no training set and no server. Every click
 * updates the counts in model.js and the next prediction uses them.
 */
(function (global) {
  "use strict";

  var ACTIONS = (global.UserModel || require("./model.js")).ACTIONS;

  // Laplace smoothing constant. Without it, an action the user has never taken
  // in the current context would get probability zero and could never recover.
  var ALPHA = 1;

  var Predictor = {};

  /* P(action | context) with add-one smoothing. */
  Predictor.contextProbabilities = function (model, when) {
    var key = model.contextKey(when || new Date());
    var row = model.context[key] || {};
    var total = 0;
    ACTIONS.forEach(function (a) {
      total += (row[a] || 0) + ALPHA;
    });
    var out = {};
    ACTIONS.forEach(function (a) {
      out[a] = ((row[a] || 0) + ALPHA) / total;
    });
    return out;
  };

  /* Overall popularity, also smoothed. */
  Predictor.frequencyProbabilities = function (model) {
    var total = 0;
    ACTIONS.forEach(function (a) {
      total += (model.counts[a] || 0) + ALPHA;
    });
    var out = {};
    ACTIONS.forEach(function (a) {
      out[a] = ((model.counts[a] || 0) + ALPHA) / total;
    });
    return out;
  };

  /*
   * Blended score used to order the Quick Actions bar.
   * Frequency answers "what does this person use a lot".
   * Context answers "what do they use at this time of day".
   * The 60/40 split was picked after testing; frequency alone was too slow to
   * react and context alone jumped around too much on little data.
   */
  Predictor.rankActions = function (model, when) {
    var freq = Predictor.frequencyProbabilities(model);
    var ctx = Predictor.contextProbabilities(model, when);
    return ACTIONS.map(function (a) {
      return { action: a, score: 0.6 * freq[a] + 0.4 * ctx[a] };
    }).sort(function (x, y) {
      return y.score - x.score;
    });
  };

  /*
   * Markov guess for the next action.
   * Returns null unless there is enough evidence, which keeps the interface
   * quiet instead of guessing wildly during the first minute of use.
   */
  Predictor.predictNext = function (model, minObservations, minConfidence) {
    minObservations = minObservations || 5;
    minConfidence = minConfidence || 0.4;

    var prev = model.lastAction;
    if (!prev) return null;
    var row = model.transitions[prev];
    if (!row) return null;

    var total = 0, best = null, bestCount = 0;
    Object.keys(row).forEach(function (a) {
      total += row[a];
      if (row[a] > bestCount) {
        bestCount = row[a];
        best = a;
      }
    });

    if (total < minObservations) return null;
    var confidence = bestCount / total;
    if (confidence < minConfidence) return null;

    return { action: best, confidence: confidence, observations: total };
  };

  /*
   * Plain English reason for a suggestion. Explanations are shown in the UI so
   * the adaptation is not a black box to the user.
   */
  Predictor.explain = function (model, action, when) {
    var freq = Math.round((model.counts[action] || 0) * 10) / 10;
    var key = model.contextKey(when || new Date());
    var ctxCount = (model.context[key] || {})[action] || 0;
    return (
      "Used about " + freq + " times recently, including " +
      Math.round(ctxCount * 10) / 10 + " time(s) during " +
      key.replace("|", " on a ") + "."
    );
  };

  global.Predictor = Predictor;
  if (typeof module !== "undefined" && module.exports) module.exports = Predictor;
})(typeof window !== "undefined" ? window : globalThis);
