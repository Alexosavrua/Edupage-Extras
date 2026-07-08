/**
 * chrome-shim.js — minimal chrome.* stub so menu.html / settings.html can be
 * rendered in a plain browser tab for visual/dev work (see index.html).
 * Never shipped: the tests/ folder is excluded from both store builds.
 */
(function () {
  "use strict";

  const cfg = window.__EE_PREVIEW__ || {};
  const MESSAGES = cfg.messages || {};
  const VERSION = "0.0.0-preview";

  const store = Object.assign(
    {
      darkModeEnabled: cfg.enabled !== false,
      themeMode: cfg.theme || "dark",
      eeUpdateStatus: {
        localVersion: VERSION,
        latestVersion: cfg.update ? "9.9.9" : VERSION,
        updateAvailable: !!cfg.update,
        checkedAt: 1750000000000,
      },
    },
    cfg.store || {},
  );

  function getMessage(key, substitutions) {
    const entry = MESSAGES[key];
    if (!entry) return "";
    let msg = entry.message || "";
    const list = substitutions == null ? [] : [].concat(substitutions);
    if (entry.placeholders) {
      for (const [name, def] of Object.entries(entry.placeholders)) {
        const index = parseInt(String(def.content || "").replace("$", ""), 10) - 1;
        msg = msg.split("$" + name + "$").join(String(list[index] ?? ""));
      }
    }
    return msg.replace(/\$(\d)/g, (whole, n) => String(list[Number(n) - 1] ?? whole));
  }

  // Real chrome.* callbacks are async; mirror that so page scripts and the
  // DOMContentLoaded i18n pass run in the same order as in the extension.
  const later = (fn) => setTimeout(fn, 0);

  window.chrome = {
    storage: {
      local: {
        get(keys, cb) {
          const defaults = keys && typeof keys === "object" && !Array.isArray(keys) ? keys : {};
          later(() => cb(Object.assign({}, defaults, store)));
        },
        set(items, cb) {
          Object.assign(store, items);
          if (cb) later(cb);
        },
        remove(keys, cb) {
          [].concat(keys).forEach((key) => delete store[key]);
          if (cb) later(cb);
        },
      },
      onChanged: { addListener() {} },
    },
    runtime: {
      getManifest: () => ({ version: VERSION }),
      sendMessage(message, cb) {
        if (cb) later(() => cb({ ok: true, status: store.eeUpdateStatus }));
      },
      openOptionsPage() {
        window.top.location.search = "?page=settings" + (window.top.location.search.replace(/^\?(page=[a-z]+&?)?/, "&"));
      },
      lastError: undefined,
    },
    i18n: {
      getMessage,
      getUILanguage: () => "en",
    },
    commands: {
      getAll(cb) {
        later(() => cb([]));
      },
    },
    tabs: {
      query(query, cb) {
        later(() => cb([]));
      },
      create() {},
      sendMessage() {},
      reload() {},
    },
  };
})();
