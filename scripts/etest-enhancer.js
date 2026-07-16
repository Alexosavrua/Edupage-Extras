(function () {
  "use strict";

  const IS_TEST = globalThis.__EE_TEST__ === true;
  if (!IS_TEST && window.top !== window) return;
  if (!IS_TEST && !/^\/elearning\//i.test(window.location.pathname)) return;

  const ETEST_COPY_KEY = "eeEtestCopyEnabled";
  const ETEST_QUESTION_BUTTONS_KEY = "eeEtestQuestionButtonsEnabled";
  const ETEST_WHOLE_TEST_BUTTON_KEY = "eeEtestWholeTestButtonEnabled";
  const ETEST_INCLUDE_ANSWERS_KEY = "eeEtestIncludeAnswers";
  const ETEST_INCLUDE_IMAGES_KEY = "eeEtestIncludeImages";
  const COPY_BTN_CLASS = "ee-etest-question-copy-btn";
  const COPY_ALL_BTN_CLASS = "ee-etest-copyall-btn";
  const STYLE_ID = "ee-etest-copy-style";
  const BLANK_MARKER = "___";
  const SELECTED_MARKER_TOKEN = "\ue000ee-selected\ue001";
  const SELECTED_MARKER_HTML = "<!--ee-selected-choice-->";
  const EXCLUDED_CLASSES = new Set([
    "etest-question-title",
    "etest-question-playactions",
    "etest-question-clearbtn",
    "etest-question-reportbtn",
    COPY_BTN_CLASS,
    COPY_ALL_BTN_CLASS,
  ]);
  const BLOCK_TAGS = new Set([
    "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DL", "DT", "DD",
    "FIGCAPTION", "FIGURE", "FOOTER", "H1", "H2", "H3", "H4", "H5", "H6",
    "HEADER", "HR", "LI", "MAIN", "NAV", "OL", "P", "PRE", "SECTION",
    "TABLE", "TBODY", "TFOOT", "THEAD", "UL",
  ]);
  const SAFE_HTML_TAGS = new Set([
    "B", "BLOCKQUOTE", "CODE", "DIV", "EM", "I", "LI", "OL", "P", "PRE",
    "S", "STRONG", "SUB", "SUP", "TABLE", "TBODY", "TD", "TFOOT", "TH",
    "THEAD", "TR", "U", "UL",
  ]);
  const BLANK_INPUT_TYPES = new Set([
    "", "date", "datetime-local", "email", "month", "number", "password",
    "search", "tel", "text", "time", "url", "week",
  ]);
  const ANSWER_INPUT_TYPES = new Set([...BLANK_INPUT_TYPES].filter((type) => type !== "password"));

  let etestCopyEnabled = true;
  let questionButtonsEnabled = true;
  let wholeTestButtonEnabled = true;
  let includeSelectedAnswers = true;
  let includeWholeTestImages = true;
  let observerTimer = null;
  let snapshotTimer = null;
  let seenSequence = 0;
  let activeTestScope = "";
  let activePlayerRoot = null;
  const seenQuestions = new Map();

  function getMessage(key, fallback) {
    try {
      return chrome.i18n.getMessage(key) || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function decodeBasicEntities(value) {
    const decodeCodePoint = (raw, radix) => {
      const codePoint = parseInt(raw, radix);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : "";
    };
    return String(value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&#(\d+);/g, (_, code) => decodeCodePoint(code, 10))
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => decodeCodePoint(code, 16))
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;|&apos;/gi, "'");
  }

  function normalizeInlineText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t\f\v]+/g, " ")
      .trim();
  }

  function normalizeStructuredText(value) {
    const lines = String(value || "")
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ")
      .split("\n")
      .map((line) => normalizeInlineText(line));
    const output = [];
    lines.forEach((line) => {
      if (line) {
        output.push(line);
      } else if (output.length && output[output.length - 1] !== "") {
        output.push("");
      }
    });
    while (output[0] === "") output.shift();
    while (output[output.length - 1] === "") output.pop();
    return output.join("\n");
  }

  function hasClass(element, className) {
    if (!element || !className) return false;
    if (element.classList && typeof element.classList.contains === "function") {
      return element.classList.contains(className);
    }
    return String(element.className || "").split(/\s+/).includes(className);
  }

  function shouldExcludeElement(element) {
    if (!element || element.nodeType !== 1) return false;
    for (const className of EXCLUDED_CLASSES) {
      if (hasClass(element, className)) return true;
    }
    return ["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT"].includes(element.tagName);
  }

  function getOptionText(option) {
    if (!option) return "";
    const visible = normalizeInlineText(option.textContent || option.label || "");
    if (visible) return visible;
    const htmlText = typeof option.getAttribute === "function"
      ? option.getAttribute("data-htmltext")
      : option.dataHtmlText;
    return normalizeInlineText(decodeBasicEntities(htmlText));
  }

  function isPlaceholderOption(option, index = 0) {
    const text = getOptionText(option);
    const normalized = text.toLocaleLowerCase();
    if (!text) return true;
    if (/^-{1,}\s*.*\s*-{1,}$/.test(text)) return true;
    if (/^(choose|select|pick|vyber|vyberte|zvoľ|zvolte|zvolte|vyberte|vyberte)\b/u.test(normalized)) return true;
    const value = option && option.value != null ? String(option.value) : "";
    return index === 0 && !value && (option.disabled || option.hidden || option.selected);
  }

  function getChoiceLabels(select) {
    const options = Array.from((select && select.options) || []);
    const seen = new Set();
    return options.reduce((labels, option, index) => {
      if (isPlaceholderOption(option, index)) return labels;
      const label = getOptionText(option);
      if (!label || seen.has(label)) return labels;
      seen.add(label);
      labels.push(label);
      return labels;
    }, []);
  }

  function selectedOptionLabels(select) {
    const options = Array.from((select && select.options) || []);
    return options
      .filter((option, index) => option.selected && !isPlaceholderOption(option, index))
      .map(getOptionText)
      .filter(Boolean);
  }

  function sanitizeImageSource(source) {
    if (!source) return "";
    if (/^data:image\/(?:avif|gif|jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(source)) {
      return source.replace(/\s+/g, "");
    }
    try {
      const url = new URL(source, typeof document !== "undefined" ? document.baseURI : undefined);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (_) {
      return "";
    }
  }

  function sanitizeLinkTarget(target) {
    if (!target) return "";
    try {
      const url = new URL(target, typeof document !== "undefined" ? document.baseURI : undefined);
      return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : "";
    } catch (_) {
      return "";
    }
  }

  function serializeChildren(node, includeImages) {
    return Array.from(node.childNodes || []).reduce((result, child) => {
      const serialized = serializeNode(child, includeImages);
      result.plain += serialized.plain;
      result.html += serialized.html;
      return result;
    }, { plain: "", html: "" });
  }

  function formatAnswerOptionText(value) {
    return normalizeInlineText(value).replace(/^([A-Za-z]|\d+)\s*[).:-]\s*/, "$1) ");
  }

  function isSelectedChoice(element) {
    if (!element || !hasClass(element, "etest-alist-answer")) return false;
    if (element.getAttribute) {
      if (element.getAttribute("aria-checked") === "true") return true;
      if (element.getAttribute("aria-selected") === "true") return true;
    }
    if (["selected", "checked", "isSelected", "is-selected"].some((name) => hasClass(element, name))) {
      return true;
    }
    return Boolean(
      typeof element.querySelector === "function"
      && element.querySelector("input[type='checkbox']:checked, input[type='radio']:checked"),
    );
  }

  function serializeNode(node, includeImages) {
    if (!node) return { plain: "", html: "" };
    if (node.nodeType === 3) {
      return { plain: node.nodeValue || "", html: escapeHtml(node.nodeValue || "") };
    }
    if (node.nodeType !== 1 || shouldExcludeElement(node)) return { plain: "", html: "" };

    const tagName = String(node.tagName || "").toUpperCase();
    if (tagName === "BR") return { plain: "\n", html: "<br>" };
    if (tagName === "SELECT") {
      const choices = getChoiceLabels(node);
      if (!choices.length) return { plain: BLANK_MARKER, html: `<span>${BLANK_MARKER}</span>` };
      const label = `[${choices.join(" / ")}]`;
      return { plain: label, html: `<span>${escapeHtml(label)}</span>` };
    }
    if (tagName === "TEXTAREA") {
      return { plain: BLANK_MARKER, html: `<span>${BLANK_MARKER}</span>` };
    }
    if (tagName === "INPUT") {
      const type = String(node.type || (node.getAttribute && node.getAttribute("type")) || "").toLowerCase();
      if (BLANK_INPUT_TYPES.has(type)) {
        return { plain: BLANK_MARKER, html: `<span>${BLANK_MARKER}</span>` };
      }
      return { plain: "", html: "" };
    }
    if (tagName === "IMG") {
      if (!includeImages) return { plain: "", html: "" };
      const source = sanitizeImageSource(node.currentSrc || node.src || (node.getAttribute && node.getAttribute("src")));
      if (!source) return { plain: "", html: "" };
      const alt = normalizeInlineText(node.alt || (node.getAttribute && node.getAttribute("alt")) || "");
      return {
        plain: alt ? `\n[${alt}]\n` : "\n",
        html: `<img src="${escapeHtml(source)}" alt="${escapeHtml(alt)}" style="max-width:100%;height:auto;">`,
      };
    }

    if ((hasClass(node, "etest-answer-input-field-outer") || hasClass(node, "etest-agroups-select-outer"))
      && typeof node.querySelector === "function") {
      const select = node.querySelector("select");
      if (select) return serializeNode(select, includeImages);
    }

    if (hasClass(node, "etest-pair-item") && typeof node.querySelector === "function") {
      const left = node.querySelector(".pair-l");
      const right = node.querySelector(".pair-r");
      if (left && right) {
        const leftValue = serializeNode(left, includeImages);
        const rightValue = serializeNode(right, includeImages);
        const leftPlain = normalizeStructuredText(leftValue.plain).replace(/\n+/g, " ");
        const rightPlain = normalizeStructuredText(rightValue.plain).replace(/\n+/g, " ");
        return {
          plain: `${leftPlain} → ${rightPlain}\n`,
          html: `<div>${leftValue.html} → ${rightValue.html}</div>`,
        };
      }
    }

    if (tagName === "TR") {
      const cells = Array.from(node.childNodes || []).filter((child) => ["TD", "TH"].includes(child.tagName));
      const values = cells.map((cell) => serializeChildren(cell, includeImages));
      return {
        plain: `${values.map((value) => normalizeStructuredText(value.plain).replace(/\n+/g, " ")).join("\t")}\n`,
        html: `<tr>${values.map((value, index) => `<${cells[index].tagName.toLowerCase()}>${value.html}</${cells[index].tagName.toLowerCase()}>`).join("")}</tr>`,
      };
    }

    const children = serializeChildren(node, includeImages);
    if (hasClass(node, "etest-answer-num")) {
      return { plain: `${children.plain} `, html: `${children.html} ` };
    }
    if (hasClass(node, "etest-alist-answer")) {
      const line = formatAnswerOptionText(normalizeStructuredText(children.plain).replace(/\n+/g, " "));
      const selectedPlain = isSelectedChoice(node) ? ` ${SELECTED_MARKER_TOKEN}` : "";
      const selectedHtml = isSelectedChoice(node) ? SELECTED_MARKER_HTML : "";
      return {
        plain: line ? `${line}${selectedPlain}\n` : "",
        html: line ? `<div>${children.html}${selectedHtml}</div>` : "",
      };
    }
    if (hasClass(node, "etest-alist-abcd")) {
      return {
        plain: `\n\n${normalizeStructuredText(children.plain)}`,
        html: `<div>${children.html}</div>`,
      };
    }

    if (tagName === "A") {
      const href = sanitizeLinkTarget(node.href || (node.getAttribute && node.getAttribute("href")));
      return {
        plain: children.plain,
        html: href ? `<a href="${escapeHtml(href)}">${children.html}</a>` : children.html,
      };
    }

    if (BLOCK_TAGS.has(tagName)) {
      const safeTag = SAFE_HTML_TAGS.has(tagName) ? tagName.toLowerCase() : "div";
      return {
        plain: `\n${children.plain}\n`,
        html: `<${safeTag}>${children.html}</${safeTag}>`,
      };
    }
    if (SAFE_HTML_TAGS.has(tagName)) {
      const safeTag = tagName.toLowerCase();
      return { plain: children.plain, html: `<${safeTag}>${children.html}</${safeTag}>` };
    }
    return children;
  }

  function extractElementText(element) {
    return normalizeStructuredText(serializeNode(element, false).plain)
      .replaceAll(SELECTED_MARKER_TOKEN, "")
      .replace(/\n+/g, " ")
      .trim();
  }

  function collectSelectedAnswers(content) {
    if (!content || typeof content.querySelectorAll !== "function") return [];
    const answers = [];
    const sources = new Set();
    const addAnswer = (value, source) => {
      const normalized = normalizeInlineText(value);
      if (!normalized || sources.has(source)) return;
      sources.add(source);
      answers.push(normalized);
    };

    content.querySelectorAll("input, textarea, select").forEach((control, index) => {
      const tagName = String(control.tagName || "").toUpperCase();
      const type = String(control.type || "").toLowerCase();
      if (tagName === "SELECT") {
        selectedOptionLabels(control).forEach((label, optionIndex) => addAnswer(label, `select-${index}-${optionIndex}`));
      } else if (tagName === "TEXTAREA" || (tagName === "INPUT" && ANSWER_INPUT_TYPES.has(type))) {
        addAnswer(control.value, `field-${index}`);
      } else if (tagName === "INPUT" && ["checkbox", "radio"].includes(type) && control.checked) {
        const host = typeof control.closest === "function"
          ? control.closest(".etest-alist-answer, label")
          : null;
        if (!host || !hasClass(host, "etest-alist-answer")) {
          addAnswer(host ? extractElementText(host) : control.value, `check-${index}`);
        }
      }
    });

    content.querySelectorAll(".etest-alist-ordering").forEach((list, index) => {
      const order = Array.from(list.querySelectorAll(".etest-alist-answer"))
        .map(extractElementText)
        .filter(Boolean);
      if (order.length) addAnswer(order.join(" → "), `order-${index}`);
    });

    content.querySelectorAll(".etest-pair-item").forEach((pair, index) => {
      const left = pair.querySelector(".pair-l");
      const right = pair.querySelector(".pair-r");
      const leftText = left ? extractElementText(left) : "";
      const rightText = right ? extractElementText(right) : "";
      if (leftText && rightText) addAnswer(`${leftText} → ${rightText}`, `pair-${index}`);
    });
    return answers;
  }

  function getQuestionNumber(content) {
    if (!content || typeof content.querySelector !== "function") return "";
    const number = content.querySelector(".etest-question-number-value, .etest-question-number-result, .etest-question-number-title");
    return normalizeInlineText(number && number.textContent).replace(/[^\p{L}\p{N}._-]+/gu, "");
  }

  function getQuestionIdentity(content, index, plainBody) {
    const explicitKeys = ["data-cardid", "data-questionid", "data-question-id", "data-id", "data-eid"];
    for (const key of explicitKeys) {
      const value = content && typeof content.getAttribute === "function" ? content.getAttribute(key) : "";
      if (value) return `${key}:${value}`;
    }
    const number = getQuestionNumber(content);
    if (number) return `number:${number}`;
    return `position:${index}:${plainBody.slice(0, 120)}`;
  }

  function buildQuestionModel(content, index = 0) {
    const withoutImages = serializeNode(content, false);
    const withImages = serializeNode(content, true);
    const plainBody = normalizeStructuredText(withoutImages.plain);
    return {
      identity: getQuestionIdentity(content, index, plainBody),
      number: getQuestionNumber(content),
      plainBody,
      htmlBody: withImages.html,
      htmlBodyWithoutImages: withoutImages.html,
      answers: collectSelectedAnswers(content),
      order: index,
    };
  }

  function renderAnswerPlain(answers) {
    const label = getMessage("etestSelectedAnswer", "Selected answer");
    if (!answers.length) return "";
    if (answers.length === 1) return `${label}: ${answers[0]}`;
    return `${label}:\n${answers.map((answer) => `- ${answer}`).join("\n")}`;
  }

  function renderQuestionPlain(model, options = {}) {
    const prefix = options.numbered ? `${options.index + 1}. ` : "";
    const marker = `(${getMessage("etestSelectedMarker", "selected")})`;
    const body = String(model.plainBody || "").replaceAll(
      ` ${SELECTED_MARKER_TOKEN}`,
      options.includeAnswers ? ` ${marker}` : "",
    );
    const sections = [`${prefix}${body}`.trim()];
    const answer = options.includeAnswers ? renderAnswerPlain(model.answers || []) : "";
    if (answer) sections.push(answer);
    return `${sections.filter(Boolean).join("\n\n")}\n`;
  }

  function renderAnswerHtml(answers) {
    const label = escapeHtml(getMessage("etestSelectedAnswer", "Selected answer"));
    if (!answers.length) return "";
    if (answers.length === 1) return `<p><strong>${label}:</strong> ${escapeHtml(answers[0])}</p>`;
    return `<div><strong>${label}:</strong><ul>${answers.map((answer) => `<li>${escapeHtml(answer)}</li>`).join("")}</ul></div>`;
  }

  function renderQuestionHtml(model, options = {}) {
    const number = options.numbered ? `<strong>${options.index + 1}. </strong>` : "";
    const selectedMarker = ` <span>(${escapeHtml(getMessage("etestSelectedMarker", "selected"))})</span>`;
    const body = String(options.includeImages ? model.htmlBody : model.htmlBodyWithoutImages).replaceAll(
      SELECTED_MARKER_HTML,
      options.includeAnswers ? selectedMarker : "",
    );
    const answer = options.includeAnswers ? renderAnswerHtml(model.answers || []) : "";
    return `<section>${number}${body}${answer}</section>`;
  }

  function renderTestPayload(models, options = {}) {
    const plain = models.map((model, index) => renderQuestionPlain(model, {
      numbered: true,
      index,
      includeAnswers: options.includeAnswers,
    }).trimEnd()).join("\n\n") + (models.length ? "\n" : "");
    const html = models.map((model, index) => renderQuestionHtml(model, {
      numbered: true,
      index,
      includeAnswers: options.includeAnswers,
      includeImages: options.includeImages,
    })).join("<hr>");
    return { plain, html };
  }

  function writePlainText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      return navigator.clipboard.writeText(text);
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0;";
    (document.body || document.documentElement).appendChild(textarea);
    textarea.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      textarea.remove();
    }
    return copied ? Promise.resolve() : Promise.reject(new Error("Clipboard copy was rejected"));
  }

  function writeClipboard(payload) {
    const canWriteRich = navigator.clipboard
      && typeof navigator.clipboard.write === "function"
      && typeof ClipboardItem === "function"
      && typeof Blob === "function";
    if (!canWriteRich || !payload.html) return writePlainText(payload.plain);
    const item = new ClipboardItem({
      "text/plain": new Blob([payload.plain], { type: "text/plain" }),
      "text/html": new Blob([payload.html], { type: "text/html" }),
    });
    return navigator.clipboard.write([item]).catch(() => writePlainText(payload.plain));
  }

  function flashFeedback(button, icon, status, ok) {
    const originalClass = icon.className;
    const originalLabel = button.getAttribute("aria-label") || "";
    const message = ok
      ? getMessage("etestCopySucceeded", "Copied")
      : getMessage("etestCopyFailed", "Copy failed");
    icon.className = ok ? "fa fa-fw fa-check" : "fa fa-fw fa-times";
    button.classList.add(ok ? "ee-copy-ok" : "ee-copy-fail");
    button.setAttribute("aria-label", message);
    button.title = message;
    status.textContent = message;
    setTimeout(() => {
      icon.className = originalClass;
      button.classList.remove("ee-copy-ok", "ee-copy-fail");
      button.setAttribute("aria-label", originalLabel);
      button.title = originalLabel;
      status.textContent = "";
    }, 1200);
  }

  function createIconButton(className, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.title = label;
    button.setAttribute("aria-label", label);
    const icon = document.createElement("i");
    icon.className = "fa fa-fw fa-copy";
    icon.setAttribute("aria-hidden", "true");
    const status = document.createElement("span");
    status.className = "ee-etest-copy-status";
    status.setAttribute("aria-live", "polite");
    button.appendChild(icon);
    button.appendChild(status);
    return { button, icon, status };
  }

  function refreshTestScope() {
    const locationKey = `${window.location.pathname}${window.location.search}`;
    const playerRoot = document.querySelector(".etest-player");
    const playerChanged = activePlayerRoot && playerRoot && playerRoot !== activePlayerRoot;
    const routeChanged = activeTestScope && locationKey !== activeTestScope;
    if (playerChanged || routeChanged) {
      seenQuestions.clear();
      seenSequence = 0;
    }
    activePlayerRoot = playerRoot;
    activeTestScope = locationKey;
  }

  function snapshotQuestion(content, index = 0) {
    if (!content) return;
    const model = buildQuestionModel(content, index);
    if (!model.plainBody) return;
    const previous = seenQuestions.get(model.identity);
    model.seenAt = previous ? previous.seenAt : seenSequence++;
    seenQuestions.set(model.identity, model);
  }

  function snapshotVisibleQuestions() {
    refreshTestScope();
    const contents = Array.from(document.querySelectorAll(".etest-question-content"));
    contents.forEach((content, index) => {
      snapshotQuestion(content, index);
    });
    return contents;
  }

  function getSeenQuestionModels() {
    snapshotVisibleQuestions();
    return Array.from(seenQuestions.values())
      .filter((model) => model.plainBody)
      .sort((a, b) => {
        const aNumber = Number.parseFloat(a.number);
        const bNumber = Number.parseFloat(b.number);
        if (Number.isFinite(aNumber) && Number.isFinite(bNumber) && aNumber !== bNumber) return aNumber - bNumber;
        return a.seenAt - b.seenAt;
      });
  }

  function makeCopyButton(playactions) {
    const label = getMessage("etestCopyQuestion", "Copy question");
    const { button, icon, status } = createIconButton(
      `etest-question-copybtn ${COPY_BTN_CLASS}`,
      label,
    );
    button.addEventListener("click", () => {
      const content = playactions.closest(".etest-question-content");
      if (!content) return;
      const model = buildQuestionModel(content);
      if (!model.plainBody) return;
      const payload = {
        plain: renderQuestionPlain(model, { includeAnswers: includeSelectedAnswers }),
        html: renderQuestionHtml(model, { includeAnswers: includeSelectedAnswers, includeImages: true }),
      };
      writeClipboard(payload)
        .then(() => flashFeedback(button, icon, status, true))
        .catch(() => flashFeedback(button, icon, status, false));
    });
    return button;
  }

  function makeCopyAllButton() {
    const label = getMessage("etestCopyAllQuestions", "Copy whole test");
    const { button, icon, status } = createIconButton(
      `etest-screen-action-btn flat-button flat-button-blue ${COPY_ALL_BTN_CLASS}`,
      label,
    );
    button.addEventListener("click", () => {
      const models = getSeenQuestionModels();
      if (!models.length) return;
      const payload = renderTestPayload(models, {
        includeAnswers: includeSelectedAnswers,
        includeImages: includeWholeTestImages,
      });
      writeClipboard(payload)
        .then(() => flashFeedback(button, icon, status, true))
        .catch(() => flashFeedback(button, icon, status, false));
    });
    return button;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const styleHost = document.head || document.documentElement;
    if (!styleHost) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${COPY_BTN_CLASS}, .${COPY_ALL_BTN_CLASS} {
        align-items: center;
        box-sizing: border-box;
        cursor: pointer;
        display: inline-flex;
        justify-content: center;
        font-size: 16px;
        line-height: 1;
        position: relative;
        transition: opacity 100ms ease-out, transform 100ms ease-out;
      }
      .${COPY_BTN_CLASS} > i, .${COPY_ALL_BTN_CLASS} > i {
        color: currentColor !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
      .${COPY_BTN_CLASS} {
        appearance: none;
        background: transparent;
        border: 0;
        color: inherit;
        height: 32px;
        min-height: 0;
        min-width: 0;
        padding: 0;
        width: 32px;
      }
      .${COPY_BTN_CLASS}::before {
        content: "";
        inset: -6px;
        position: absolute;
      }
      .${COPY_ALL_BTN_CLASS} { line-height: normal; }
      html.ee-dark .${COPY_BTN_CLASS} {
        background: transparent !important;
        border-color: transparent !important;
        color: var(--ee-text, #f5f7fa) !important;
      }
      .${COPY_BTN_CLASS}:focus-visible, .${COPY_ALL_BTN_CLASS}:focus-visible {
        outline: 2px solid currentColor;
        outline-offset: 2px;
      }
      .${COPY_BTN_CLASS}:active, .${COPY_ALL_BTN_CLASS}:active { transform: scale(0.97); }
      .ee-etest-copy-status {
        clip: rect(0 0 0 0);
        clip-path: inset(50%);
        height: 1px;
        overflow: hidden;
        position: absolute;
        white-space: nowrap;
        width: 1px;
      }
      @media (prefers-reduced-motion: reduce) {
        .${COPY_BTN_CLASS}, .${COPY_ALL_BTN_CLASS} { transition-duration: 0.01ms; }
      }
    `;
    styleHost.appendChild(style);
  }

  function removeButtons() {
    document.querySelectorAll(`.${COPY_BTN_CLASS}, .${COPY_ALL_BTN_CLASS}`).forEach((element) => element.remove());
  }

  function ensureButtons() {
    if (!etestCopyEnabled) {
      removeButtons();
      return;
    }
    ensureStyles();
    snapshotVisibleQuestions();
    document.querySelectorAll(".etest-question-playactions").forEach((playactions) => {
      if (!questionButtonsEnabled) {
        playactions.querySelectorAll(`.${COPY_BTN_CLASS}`).forEach((button) => button.remove());
        return;
      }
      if (playactions.querySelector(`.${COPY_BTN_CLASS}`)) return;
      playactions.insertBefore(makeCopyButton(playactions), playactions.firstChild);
    });
    document.querySelectorAll(".etest-screen-actions").forEach((actions) => {
      if (!wholeTestButtonEnabled) {
        actions.querySelectorAll(`.${COPY_ALL_BTN_CLASS}`).forEach((button) => button.remove());
        return;
      }
      if (actions.querySelector(`.${COPY_ALL_BTN_CLASS}`) || !document.querySelector(".etest-question-content")) return;
      actions.appendChild(makeCopyAllButton());
    });
  }

  function scheduleEnsure() {
    if (observerTimer) return;
    observerTimer = setTimeout(() => {
      observerTimer = null;
      ensureButtons();
    }, 150);
  }

  function scheduleSnapshotFromEvent(event) {
    if (!etestCopyEnabled || snapshotTimer) return;
    const target = event && event.target;
    if (!target || typeof target.closest !== "function") return;
    const content = target.closest(".etest-question-content");
    if (!content) return;
    snapshotTimer = setTimeout(() => {
      snapshotTimer = null;
      refreshTestScope();
      const visibleQuestions = Array.from(document.querySelectorAll(".etest-question-content"));
      snapshotQuestion(content, Math.max(0, visibleQuestions.indexOf(content)));
    }, 0);
  }

  function snapshotBeforeNavigation(event) {
    if (!etestCopyEnabled) return;
    const target = event && event.target;
    if (!target || typeof target.closest !== "function") return;
    if (target.closest(`.${COPY_BTN_CLASS}, .${COPY_ALL_BTN_CLASS}`)) return;
    if (target.closest(".etest-player-sidebar-question, .etest-screen-action-btn, .etest-header-nav")) {
      snapshotVisibleQuestions();
    }
  }

  function initObserver() {
    if (!document.documentElement) {
      document.addEventListener("readystatechange", initObserver, { once: true });
      return;
    }
    const observer = new MutationObserver(scheduleEnsure);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
      childList: true,
      subtree: true,
    });
    document.addEventListener("input", scheduleSnapshotFromEvent, true);
    document.addEventListener("change", scheduleSnapshotFromEvent, true);
    document.addEventListener("click", snapshotBeforeNavigation, true);
    document.addEventListener("click", scheduleSnapshotFromEvent, false);
  }

  function resolvePreferences(values = {}) {
    return {
      copyEnabled: values[ETEST_COPY_KEY] !== false,
      questionButtons: values[ETEST_QUESTION_BUTTONS_KEY] !== false,
      wholeTestButton: values[ETEST_WHOLE_TEST_BUTTON_KEY] !== false,
      selectedAnswers: values[ETEST_INCLUDE_ANSWERS_KEY] !== false,
      wholeTestImages: values[ETEST_INCLUDE_IMAGES_KEY] !== false,
    };
  }

  function initStorage() {
    const keys = [
      ETEST_COPY_KEY,
      ETEST_QUESTION_BUTTONS_KEY,
      ETEST_WHOLE_TEST_BUTTON_KEY,
      ETEST_INCLUDE_ANSWERS_KEY,
      ETEST_INCLUDE_IMAGES_KEY,
    ];
    chrome.storage.local.get(keys, (result) => {
      const preferences = resolvePreferences(result);
      etestCopyEnabled = preferences.copyEnabled;
      questionButtonsEnabled = preferences.questionButtons;
      wholeTestButtonEnabled = preferences.wholeTestButton;
      includeSelectedAnswers = preferences.selectedAnswers;
      includeWholeTestImages = preferences.wholeTestImages;
      ensureButtons();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes[ETEST_COPY_KEY]) etestCopyEnabled = changes[ETEST_COPY_KEY].newValue !== false;
      if (changes[ETEST_QUESTION_BUTTONS_KEY]) {
        questionButtonsEnabled = changes[ETEST_QUESTION_BUTTONS_KEY].newValue !== false;
      }
      if (changes[ETEST_WHOLE_TEST_BUTTON_KEY]) {
        wholeTestButtonEnabled = changes[ETEST_WHOLE_TEST_BUTTON_KEY].newValue !== false;
      }
      if (changes[ETEST_INCLUDE_ANSWERS_KEY]) includeSelectedAnswers = changes[ETEST_INCLUDE_ANSWERS_KEY].newValue !== false;
      if (changes[ETEST_INCLUDE_IMAGES_KEY]) includeWholeTestImages = changes[ETEST_INCLUDE_IMAGES_KEY].newValue !== false;
      if (keys.some((key) => changes[key])) ensureButtons();
    });
  }

  if (IS_TEST) {
    globalThis.__eeTestExports = {
      normalizeStructuredText,
      formatAnswerOptionText,
      getChoiceLabels,
      selectedOptionLabels,
      sanitizeImageSource,
      SELECTED_MARKER_TOKEN,
      serializeNode,
      collectSelectedAnswers,
      getQuestionIdentity,
      buildQuestionModel,
      getSeenQuestionModels,
      renderQuestionPlain,
      renderQuestionHtml,
      renderTestPayload,
      writeClipboard,
      resolvePreferences,
      init,
    };
    return;
  }

  function init() {
    initStorage();
    initObserver();
  }

  init();
})();
