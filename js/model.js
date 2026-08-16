/*
 * model.js
 * The user model. This is the "memory" of the adaptive system.
 * It records every interaction and keeps running statistics that the
 * predictor and the adaptation rules read from.
 *
 * Nothing here talks to the DOM on purpose, so the model can be unit tested
 * in Node without a browser.
 */
(function (global) {
  "use strict";

  // Actions the user can take. The adaptive layer only ever promotes
  // items from this list, so the interface can never invent a control.
  var ACTIONS = [
    "addTask",
    "completeTask",
    "deleteTask",
    "searchTask",
    "filterTasks",
    "startTimer",
    "openNotes",
    "viewStats",
    "exportData"
  ];

  // How fast old behavior stops counting. After HALF_LIFE new events,
  // an old event is worth half of what it was worth before.
  var HALF_LIFE = 20;
  var DECAY = Math.pow(0.5, 1 / HALF_LIFE);

  function timeBucket(date) {
    var h = date.getHours();
    if (h < 12) return "morning";
    if (h < 17) return "afternoon";
    if (h < 22) return "evening";
    return "night";
  }

  function dayType(date) {
    var d = date.getDay();
    return d === 0 || d === 6 ? "weekend" : "weekday";
  }

  function UserModel(saved) {
    this.counts = {};        // action -> decayed frequency
    this.context = {};       // "bucket|dayType" -> { action -> decayed count }
    this.transitions = {};   // previousAction -> { nextAction -> count }
    this.lastAction = null;
    this.totalEvents = 0;
    this.errors = 0;         // destructive actions the user undid
    this.hesitations = 0;    // long pauses before a click
    this.sessionStart = Date.now();

    if (saved) {
      this.counts = saved.counts || {};
      this.context = saved.context || {};
      this.transitions = saved.transitions || {};
      this.lastAction = saved.lastAction || null;
      this.totalEvents = saved.totalEvents || 0;
      this.errors = saved.errors || 0;
      this.hesitations = saved.hesitations || 0;
    }
  }

  UserModel.prototype.contextKey = function (date) {
    var d = date || new Date();
    return timeBucket(d) + "|" + dayType(d);
  };

  /* Record one interaction. dwellMs is how long the user waited before acting. */
  UserModel.prototype.record = function (action, dwellMs, when) {
    if (ACTIONS.indexOf(action) === -1) return;
    var date = when || new Date();
    var key = this.contextKey(date);
    var self = this;

    // Decay every stored count before adding the new one. This is what makes
    // the interface follow current habits instead of habits from last month.
    Object.keys(this.counts).forEach(function (a) {
      self.counts[a] *= DECAY;
    });
    Object.keys(this.context).forEach(function (k) {
      Object.keys(self.context[k]).forEach(function (a) {
        self.context[k][a] *= DECAY;
      });
    });

    this.counts[action] = (this.counts[action] || 0) + 1;

    if (!this.context[key]) this.context[key] = {};
    this.context[key][action] = (this.context[key][action] || 0) + 1;

    if (this.lastAction) {
      if (!this.transitions[this.lastAction]) this.transitions[this.lastAction] = {};
      var row = this.transitions[this.lastAction];
      row[action] = (row[action] || 0) + 1;
    }

    if (typeof dwellMs === "number" && dwellMs > 4000) this.hesitations += 1;

    this.lastAction = action;
    this.totalEvents += 1;
  };

  UserModel.prototype.recordError = function () {
    this.errors += 1;
  };

  /* Share of recent actions that were undone. Used to decide whether the
     user looks confident or looks like they need help. */
  UserModel.prototype.errorRate = function () {
    if (this.totalEvents < 5) return 0;
    return this.errors / this.totalEvents;
  };

  UserModel.prototype.hesitationRate = function () {
    if (this.totalEvents < 5) return 0;
    return this.hesitations / this.totalEvents;
  };

  UserModel.prototype.toJSON = function () {
    return {
      counts: this.counts,
      context: this.context,
      transitions: this.transitions,
      lastAction: this.lastAction,
      totalEvents: this.totalEvents,
      errors: this.errors,
      hesitations: this.hesitations
    };
  };

  UserModel.ACTIONS = ACTIONS;
  UserModel.HALF_LIFE = HALF_LIFE;

  global.UserModel = UserModel;
  if (typeof module !== "undefined" && module.exports) module.exports = UserModel;
})(typeof window !== "undefined" ? window : globalThis);
