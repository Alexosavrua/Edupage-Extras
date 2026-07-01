(function () {
  "use strict";

  if (window.top !== window) return;
  if (!/^\/login(?:\/|$)/i.test(window.location.pathname)) return;

  const AUTOLOGIN_KEY = "eeAutoLoginEnabled";
  const STYLE_ID = "ee-autologin-style";
  let autoLoginEnabled = false;
  let submitted = false;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .ee-autologin-badge {
        position: fixed;
        bottom: 12px;
        left: 12px;
        z-index: 2147483000;
        padding: 6px 12px;
        border-radius: 6px;
        background: rgba(0, 0, 0, 0.7);
        color: #e0e0e0;
        font: 12px/1.4 -apple-system, "Segoe UI", Roboto, sans-serif;
        pointer-events: none;
        opacity: 1;
        transition: opacity 0.4s ease;
      }
      .ee-autologin-badge.ee-fade {
        opacity: 0;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function showBadge(text) {
    injectStyles();
    let badge = document.querySelector(".ee-autologin-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "ee-autologin-badge";
      badge.setAttribute("role", "status");
      document.body.appendChild(badge);
    }
    badge.textContent = text;
    badge.classList.remove("ee-fade");
    setTimeout(() => badge.classList.add("ee-fade"), 3000);
    setTimeout(() => badge.remove(), 3500);
  }

  function findLoginForm() {
    const passwordInput = document.querySelector(
      'input[type="password"]:not([hidden]):not([style*="display: none"])'
    );
    if (!passwordInput) return null;

    const form = passwordInput.closest("form");
    const container = form || document.body;

    const usernameInput = container.querySelector(
      'input[type="text"], input[type="email"], input:not([type])'
    );
    if (!usernameInput) return null;

    const submitButton =
      container.querySelector('button[type="submit"]') ||
      container.querySelector('input[type="submit"]') ||
      container.querySelector('button:not([type="button"]):not([type="reset"])');

    return { usernameInput, passwordInput, submitButton, form };
  }

  function isFieldFilled(input) {
    if (input.value && input.value.trim().length > 0) return true;

    try {
      const bg = window.getComputedStyle(input).backgroundColor;
      if (bg && /rgb\(232,\s*240,\s*254\)/.test(bg)) return true;
    } catch (_) { /* ignore */ }

    return false;
  }

  function tryAutoSubmit() {
    if (submitted || !autoLoginEnabled) return;

    const elements = findLoginForm();
    if (!elements) return;

    const { usernameInput, passwordInput, submitButton, form } = elements;

    if (!isFieldFilled(usernameInput) || !isFieldFilled(passwordInput)) return;

    submitted = true;

    showBadge(chrome.i18n.getMessage("autoLoginSubmitting") || "Auto-logging in…");

    setTimeout(() => {
      if (submitButton) {
        submitButton.click();
      } else if (form) {
        form.requestSubmit();
      }
    }, 200);
  }

  function startWatching() {
    let attempts = 0;
    const maxAttempts = 40;
    const interval = 250;

    const timer = setInterval(() => {
      attempts += 1;
      if (submitted || attempts >= maxAttempts) {
        clearInterval(timer);
        return;
      }
      tryAutoSubmit();
    }, interval);

    const observer = new MutationObserver(() => {
      if (!submitted) tryAutoSubmit();
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        observer.observe(document.body, { childList: true, subtree: true });
      }, { once: true });
    }
  }

  function init() {
    chrome.storage.local.get([AUTOLOGIN_KEY], (result) => {
      autoLoginEnabled = result[AUTOLOGIN_KEY] === true;
      if (!autoLoginEnabled) return;
      startWatching();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
