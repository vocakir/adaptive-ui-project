/*
 * app.js
 * The base application: a small task dashboard. This is the "system" that the
 * adaptive layer sits on top of. It works fine with adaptation switched off,
 * which was on purpose so the two halves could be tested separately.
 */
(function () {
  "use strict";

  var model, adaptive, prefs;
  var tasks = [];
  var lastUndo = null;
  var lastInteractionAt = Date.now();
  var timerId = null;
  var timerLeft = 25 * 60;

  function $(id) { return document.getElementById(id); }

  /* Every user action goes through here so the model never misses an event. */
  function track(action) {
    var dwell = Date.now() - lastInteractionAt;
    lastInteractionAt = Date.now();
    model.record(action, dwell);
    window.Storage2.saveModel(model.toJSON());
    adaptive.refresh();
    renderDebug();
  }

  /* ---- task operations ---- */

  function addTask(text) {
    text = (text || $("task-input").value || "").trim();
    if (!text) {
      announce("Type a task first.");
      return;
    }
    tasks.push({ id: Date.now(), text: text, done: false });
    $("task-input").value = "";
    save();
    renderTasks();
    track("addTask");
  }

  function completeTask(id) {
    var t = tasks.filter(function (x) { return x.id === id; })[0];
    if (!t) { announce("Select a task to complete."); return; }
    t.done = !t.done;
    save();
    renderTasks();
    track("completeTask");
  }

  function deleteTask(id) {
    var i = -1;
    tasks.forEach(function (x, idx) { if (x.id === id) i = idx; });
    if (i === -1) { announce("Select a task to delete."); return; }
    lastUndo = { task: tasks[i], index: i };
    tasks.splice(i, 1);
    save();
    renderTasks();
    $("undo").hidden = false;
    track("deleteTask");
  }

  function undo() {
    if (!lastUndo) return;
    tasks.splice(lastUndo.index, 0, lastUndo.task);
    lastUndo = null;
    $("undo").hidden = true;
    // An undo right after a delete is treated as a user error signal.
    model.recordError();
    save();
    renderTasks();
    adaptive.refresh();
    renderDebug();
  }

  function search() {
    $("search-panel").hidden = !$("search-panel").hidden;
    if (!$("search-panel").hidden) $("search-input").focus();
    track("searchTask");
  }

  function filterTasks() {
    var order = ["all", "open", "done"];
    var current = $("filter").getAttribute("data-mode") || "all";
    var next = order[(order.indexOf(current) + 1) % order.length];
    $("filter").setAttribute("data-mode", next);
    $("filter").textContent = "Filter: " + next;
    renderTasks();
    track("filterTasks");
  }

  function startTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
      $("timer").textContent = "Focus timer";
    } else {
      timerLeft = 25 * 60;
      timerId = setInterval(function () {
        timerLeft -= 1;
        var m = Math.floor(timerLeft / 60), s = timerLeft % 60;
        $("timer").textContent = m + ":" + (s < 10 ? "0" : "") + s;
        if (timerLeft <= 0) {
          clearInterval(timerId);
          timerId = null;
          $("timer").textContent = "Focus timer";
          announce("Focus session finished.");
        }
      }, 1000);
    }
    track("startTimer");
  }

  function openNotes() {
    $("notes-panel").hidden = !$("notes-panel").hidden;
    track("openNotes");
  }

  function viewStats() {
    var done = tasks.filter(function (t) { return t.done; }).length;
    $("stats-panel").hidden = false;
    $("stats-body").textContent =
      tasks.length + " task(s), " + done + " finished, " +
      (tasks.length - done) + " open. " + model.totalEvents + " interactions recorded.";
    track("viewStats");
  }

  function exportData() {
    var blob = new Blob([JSON.stringify({ tasks: tasks, model: model.toJSON() }, null, 2)],
      { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "adaptive-ui-export.json";
    a.click();
    track("exportData");
  }

  var RUNNER = {
    addTask: function () { addTask(); },
    completeTask: function () { completeTask(selectedId()); },
    deleteTask: function () { deleteTask(selectedId()); },
    searchTask: search,
    filterTasks: filterTasks,
    startTimer: startTimer,
    openNotes: openNotes,
    viewStats: viewStats,
    exportData: exportData
  };

  function selectedId() {
    var el = document.querySelector(".task.selected");
    return el ? Number(el.getAttribute("data-id")) : null;
  }

  /* ---- rendering ---- */

  function renderTasks() {
    var mode = $("filter").getAttribute("data-mode") || "all";
    var q = ($("search-input").value || "").toLowerCase();
    var list = $("task-list");
    list.innerHTML = "";

    tasks.filter(function (t) {
      if (mode === "open" && t.done) return false;
      if (mode === "done" && !t.done) return false;
      if (q && t.text.toLowerCase().indexOf(q) === -1) return false;
      return true;
    }).forEach(function (t) {
      var li = document.createElement("li");
      li.className = "task" + (t.done ? " done" : "");
      li.setAttribute("data-id", t.id);
      li.tabIndex = 0;
      li.textContent = t.text;
      li.addEventListener("click", function () {
        document.querySelectorAll(".task").forEach(function (n) {
          n.classList.remove("selected");
        });
        li.classList.add("selected");
      });
      li.addEventListener("dblclick", function () { completeTask(t.id); });
      list.appendChild(li);
    });

    if (!list.children.length) {
      var empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = "No tasks to show.";
      list.appendChild(empty);
    }
  }

  function renderDebug() {
    var box = $("model-body");
    if (!box) return;
    var ranked = window.Predictor.rankActions(model).slice(0, 5);
    var lines = ranked.map(function (r) {
      return window.Adaptive.LABELS[r.action] + ": " + r.score.toFixed(3);
    });
    var next = window.Predictor.predictNext(model);
    box.textContent =
      "Interactions: " + model.totalEvents +
      " | undo rate: " + (model.errorRate() * 100).toFixed(0) + "%" +
      " | hesitation rate: " + (model.hesitationRate() * 100).toFixed(0) + "%\n" +
      "Top scores\n  " + lines.join("\n  ") + "\n" +
      "Next action guess: " + (next ? window.Adaptive.LABELS[next.action] +
        " (" + Math.round(next.confidence * 100) + "%)" : "not confident yet");
  }

  function announce(msg) {
    var el = $("announce");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(announce.t);
    announce.t = setTimeout(function () { el.hidden = true; }, 6000);
  }

  function applyPrefs() {
    document.body.classList.toggle("large-text", !!prefs.largeText);
    document.body.classList.toggle("high-contrast", !!prefs.highContrast);
    $("toggle-adaptive").checked = !!prefs.adaptive;
    window.Storage2.savePrefs(prefs);
  }

  function save() {
    window.Storage2.saveTasks(tasks);
  }

  /* ---- start up ---- */

  function init() {
    prefs = window.Storage2.loadPrefs();
    model = new window.UserModel(window.Storage2.loadModel());
    tasks = window.Storage2.loadTasks();

    adaptive = new window.Adaptive(model, prefs, {
      run: function (a) { if (RUNNER[a]) RUNNER[a](); },
      announce: announce,
      offerReadability: function (reason) {
        var bar = $("offer");
        bar.hidden = false;
        $("offer-text").textContent = reason === "late"
          ? "It is late. Want larger text and higher contrast?"
          : "A few actions were undone. Want larger text and higher contrast?";
      }
    });

    document.querySelectorAll("[data-action]").forEach(function (btn) {
      var a = btn.getAttribute("data-action");
      btn.addEventListener("click", function () { if (RUNNER[a]) RUNNER[a](); });
    });

    $("task-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter") addTask();
    });
    $("search-input").addEventListener("input", renderTasks);
    $("undo").addEventListener("click", undo);

    $("offer-yes").addEventListener("click", function () {
      prefs.largeText = true;
      prefs.highContrast = true;
      applyPrefs();
      $("offer").hidden = true;
    });
    $("offer-no").addEventListener("click", function () { $("offer").hidden = true; });

    $("toggle-adaptive").addEventListener("change", function (e) {
      prefs.adaptive = e.target.checked;
      applyPrefs();
      adaptive.refresh();
      announce(prefs.adaptive ? "Adaptation on." : "Adaptation off. Layout is fixed.");
    });

    $("reset").addEventListener("click", function () {
      if (!confirm("Erase the learned model and all tasks?")) return;
      window.Storage2.clearAll();
      location.reload();
    });

    $("why").addEventListener("click", function () {
      $("model-panel").hidden = !$("model-panel").hidden;
      renderDebug();
    });

    applyPrefs();
    renderTasks();
    adaptive.refresh();
    renderDebug();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
