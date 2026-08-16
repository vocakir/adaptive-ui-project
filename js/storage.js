/*
 * storage.js
 * Saves the user model and the task list in the browser only.
 * Nothing is sent anywhere. If storage is blocked, the app still runs and
 * simply forgets everything when the tab closes.
 */
(function (global) {
  "use strict";

  var KEY_MODEL = "adaptiveui.model";
  var KEY_TASKS = "adaptiveui.tasks";
  var KEY_PREFS = "adaptiveui.prefs";

  function available() {
    try {
      var t = "__test__";
      global.localStorage.setItem(t, t);
      global.localStorage.removeItem(t);
      return true;
    } catch (e) {
      return false;
    }
  }

  var memory = {};
  var useLocal = available();

  function read(key, fallback) {
    try {
      var raw = useLocal ? global.localStorage.getItem(key) : memory[key];
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    var raw = JSON.stringify(value);
    try {
      if (useLocal) global.localStorage.setItem(key, raw);
      else memory[key] = raw;
    } catch (e) {
      memory[key] = raw;
    }
  }

  global.Storage2 = {
    loadModel: function () { return read(KEY_MODEL, null); },
    saveModel: function (m) { write(KEY_MODEL, m); },
    loadTasks: function () { return read(KEY_TASKS, []); },
    saveTasks: function (t) { write(KEY_TASKS, t); },
    loadPrefs: function () {
      return read(KEY_PREFS, { adaptive: true, largeText: false, highContrast: false });
    },
    savePrefs: function (p) { write(KEY_PREFS, p); },
    clearAll: function () {
      [KEY_MODEL, KEY_TASKS, KEY_PREFS].forEach(function (k) {
        try { if (useLocal) global.localStorage.removeItem(k); } catch (e) {}
        delete memory[k];
      });
    },
    persistent: useLocal
  };
})(typeof window !== "undefined" ? window : globalThis);
