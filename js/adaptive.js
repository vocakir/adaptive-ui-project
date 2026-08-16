/*
 * adaptive.js
 * The adaptation layer. This is the part that actually changes the interface
 * while the user is working.
 *
 * Four things adapt:
 *   1. Quick Actions   - the three highest scoring controls move to the top bar
 *   2. Next step hint  - the Markov prediction is highlighted
 *   3. Help level      - hints appear for struggling users and hide for fluent ones
 *   4. Readability     - larger text and higher contrast are offered, never forced
 *
 * Design rules followed here:
 *   - the user can switch adaptation off at any time
 *   - every change is announced and explained
 *   - nothing is ever removed from the interface, only reordered or highlighted
 */
(function (global) {
  "use strict";

  var LABELS = {
    addTask: "Add task",
    completeTask: "Complete task",
    deleteTask: "Delete task",
    searchTask: "Search",
    filterTasks: "Filter",
    startTimer: "Focus timer",
    openNotes: "Notes",
    viewStats: "Stats",
    exportData: "Export"
  };

  function Adaptive(model, prefs, hooks) {
    this.model = model;
    this.prefs = prefs;
    this.hooks = hooks || {};
    this.lastPromoted = [];
    this.readabilityOffered = false;
  }

  /* Recalculate everything. Called after every recorded interaction. */
  Adaptive.prototype.refresh = function () {
    if (!this.prefs.adaptive) {
      this.renderQuickActions([]);
      this.renderHint(null);
      this.setHelpLevel("normal");
      return;
    }
    this.updateQuickActions();
    this.updateHint();
    this.updateHelpLevel();
    this.maybeOfferReadability();
  };

  /* 1. Promote the top three actions once there is enough data to justify it. */
  Adaptive.prototype.updateQuickActions = function () {
    if (this.model.totalEvents < 6) {
      this.renderQuickActions([]);
      return;
    }
    var ranked = global.Predictor.rankActions(this.model);
    var top = ranked.slice(0, 3).map(function (r) { return r.action; });

    var changed = top.join(",") !== this.lastPromoted.join(",");
    this.renderQuickActions(top);

    // Only announce a real change, and only name the newcomer. Announcing every
    // reorder was distracting during testing.
    if (changed && this.lastPromoted.length) {
      var self = this;
      var added = top.filter(function (a) { return self.lastPromoted.indexOf(a) === -1; });
      if (added.length && this.hooks.announce) {
        this.hooks.announce(
          "Moved \u201c" + LABELS[added[0]] + "\u201d to Quick Actions. " +
          global.Predictor.explain(this.model, added[0])
        );
      }
    }
    this.lastPromoted = top;
  };

  /* 2. Highlight the predicted next step. */
  Adaptive.prototype.updateHint = function () {
    var p = global.Predictor.predictNext(this.model);
    if (!p) {
      this.renderHint(null);
      return;
    }
    this.renderHint({
      action: p.action,
      label: LABELS[p.action],
      confidence: p.confidence,
      text:
        "After \u201c" + LABELS[this.model.lastAction] + "\u201d you usually choose \u201c" +
        LABELS[p.action] + "\u201d (" + Math.round(p.confidence * 100) + "% of " +
        p.observations + " times)."
    });
  };

  /* 3. More help for users who hesitate or undo a lot, less for confident ones. */
  Adaptive.prototype.updateHelpLevel = function () {
    var level = "normal";
    if (this.model.errorRate() > 0.2 || this.model.hesitationRate() > 0.3) level = "verbose";
    else if (this.model.totalEvents > 25 && this.model.errorRate() < 0.05) level = "minimal";
    this.setHelpLevel(level);
  };

  /* 4. Offer, do not impose, a readability change. Asked once per session. */
  Adaptive.prototype.maybeOfferReadability = function () {
    if (this.readabilityOffered || this.prefs.largeText) return;
    var lateNight = new Date().getHours() >= 22 || new Date().getHours() < 6;
    var struggling = this.model.errorRate() > 0.25;
    if ((lateNight || struggling) && this.model.totalEvents >= 10) {
      this.readabilityOffered = true;
      if (this.hooks.offerReadability) this.hooks.offerReadability(lateNight ? "late" : "errors");
    }
  };

  /* ---- rendering ---- */

  Adaptive.prototype.renderQuickActions = function (actions) {
    var bar = document.getElementById("quick-actions");
    var wrap = document.getElementById("quick-actions-wrap");
    if (!bar || !wrap) return;
    bar.innerHTML = "";
    if (!actions.length) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    var self = this;
    actions.forEach(function (a) {
      var btn = document.createElement("button");
      btn.className = "quick-btn";
      btn.textContent = LABELS[a];
      btn.setAttribute("data-action", a);
      btn.title = global.Predictor.explain(self.model, a);
      btn.addEventListener("click", function () {
        if (self.hooks.run) self.hooks.run(a);
      });
      bar.appendChild(btn);
    });
  };

  Adaptive.prototype.renderHint = function (hint) {
    var el = document.getElementById("next-hint");
    if (!el) return;
    document.querySelectorAll(".predicted").forEach(function (n) {
      n.classList.remove("predicted");
    });
    if (!hint) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.textContent = hint.text;
    var target = document.querySelector('[data-action="' + hint.action + '"]');
    if (target) target.classList.add("predicted");
  };

  Adaptive.prototype.setHelpLevel = function (level) {
    document.body.setAttribute("data-help", level);
    var badge = document.getElementById("help-level");
    if (badge) badge.textContent = level;
  };

  Adaptive.LABELS = LABELS;
  global.Adaptive = Adaptive;
})(typeof window !== "undefined" ? window : globalThis);
