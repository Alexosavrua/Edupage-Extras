const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadInternals(overrides = {}) {
  const context = {
    console,
    URL,
    Blob,
    navigator: { clipboard: {} },
    chrome: {
      i18n: {
        getMessage(key) {
          const messages = {
            etestSelectedAnswer: "Selected answer",
            etestSelectedMarker: "selected",
          };
          return messages[key] || "";
        },
      },
    },
    ...overrides,
  };
  context.globalThis = context;
  context.__EE_TEST__ = true;
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "..", "scripts", "etest-enhancer.js"), "utf8"),
    context,
    { filename: "scripts/etest-enhancer.js" },
  );
  return { context, exports: context.__eeTestExports };
}

function text(value) {
  return { nodeType: 3, nodeValue: value };
}

function element(tagName, { className = "", children = [], attributes = {}, ...properties } = {}) {
  const classNames = className.split(/\s+/).filter(Boolean);
  return {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    className,
    classList: { contains: (name) => classNames.includes(name) },
    childNodes: children,
    getAttribute(name) {
      if (Object.hasOwn(attributes, name)) return attributes[name];
      if (name === "type") return properties.type || null;
      if (name === "src") return properties.src || null;
      if (name === "alt") return properties.alt || null;
      if (name === "href") return properties.href || null;
      return null;
    },
    querySelector() {
      return null;
    },
    ...properties,
  };
}

test("structured serialization keeps inline blanks and exactly one newline between ABCD answers", () => {
  const { serializeNode, normalizeStructuredText, SELECTED_MARKER_TOKEN, renderQuestionPlain } = loadInternals().exports;
  const select = element("select", {
    options: [
      { value: "", selected: true, textContent: "-- choose --" },
      { value: "one", selected: false, textContent: "First" },
      { value: "two", selected: false, textContent: "Second" },
    ],
  });
  const optionA = element("li", {
    className: "etest-alist-answer",
    children: [
      element("span", { className: "etest-answer-num", children: [text("A)")] }),
      element("span", { children: [text("lorem ipsum")] }),
    ],
  });
  const optionB = element("li", {
    className: "etest-alist-answer",
    attributes: { "aria-checked": "true" },
    children: [
      element("span", { className: "etest-answer-num", children: [text("B)")] }),
      element("div", { children: [text("dolor sit amet")] }),
    ],
  });
  const blank = element("div", {
    className: "etest-answer-input-field-outer",
    children: [text("Complete "), element("input", { type: "text" }), text(" using "), select],
  });
  const root = element("div", {
    children: [blank, element("ul", { className: "etest-alist-abcd", children: [optionA, optionB] })],
  });

  const output = normalizeStructuredText(serializeNode(root, false).plain);
  assert.equal(
    output,
    `Complete ___ using [First / Second]\n\nA) lorem ipsum\nB) dolor sit amet ${SELECTED_MARKER_TOKEN}`,
  );
  assert.equal(
    renderQuestionPlain({ plainBody: output, answers: [] }, { includeAnswers: true }),
    "Complete ___ using [First / Second]\n\nA) lorem ipsum\nB) dolor sit amet (selected)\n",
  );
  assert.doesNotMatch(output, /-- choose --/);
});

test("selected-answer extraction excludes choice rows from the separate answer block", () => {
  const { collectSelectedAnswers } = loadInternals().exports;
  const typed = element("input", { type: "text", value: "typed answer" });
  const password = element("input", { type: "password", value: "must not be copied" });
  const select = element("select", {
    options: [
      { value: "", selected: false, textContent: "-- choose --" },
      { value: "b", selected: true, textContent: "Choice B" },
    ],
  });
  const selectedRow = element("li", {
    className: "etest-alist-answer",
    children: [text("C) Choice C")],
  });
  const content = {
    querySelectorAll(selector) {
      if (selector === "input, textarea, select") return [typed, password, select];
      if (selector === ".etest-alist-ordering" || selector === ".etest-pair-item") return [];
      return [selectedRow];
    },
  };

  assert.deepEqual(
    Array.from(collectSelectedAnswers(content)),
    ["typed answer", "Choice B"],
  );
});

test("question rendering only adds a separate answer block for non-choice answers", () => {
  const { renderQuestionPlain } = loadInternals().exports;
  const model = { plainBody: "Complete ___ here.", answers: ["typed answer"] };

  assert.equal(
    renderQuestionPlain(model, { includeAnswers: true }),
    "Complete ___ here.\n\nSelected answer: typed answer\n",
  );
  assert.equal(
    renderQuestionPlain(model, { includeAnswers: false }),
    "Complete ___ here.\n",
  );
});

test("stable card ids keep paginated questions distinct", () => {
  const { getQuestionIdentity } = loadInternals().exports;
  const first = element("div", { attributes: { "data-cardid": "card-1" } });
  const second = element("div", { attributes: { "data-cardid": "card-2" } });
  assert.equal(getQuestionIdentity(first, 0, "Same position"), "data-cardid:card-1");
  assert.equal(getQuestionIdentity(second, 0, "Same position"), "data-cardid:card-2");
});

test("question and whole-test button preferences are independent and default on", () => {
  const { resolvePreferences } = loadInternals().exports;
  assert.deepEqual(
    { ...resolvePreferences({}) },
    {
      copyEnabled: true,
      questionButtons: true,
      wholeTestButton: true,
      selectedAnswers: true,
      wholeTestImages: true,
    },
  );
  assert.deepEqual(
    { ...resolvePreferences({
      eeEtestQuestionButtonsEnabled: false,
      eeEtestWholeTestButtonEnabled: true,
    }) },
    {
      copyEnabled: true,
      questionButtons: false,
      wholeTestButton: true,
      selectedAnswers: true,
      wholeTestImages: true,
    },
  );
});

test("whole-test rendering numbers questions and controls rich-copy images", () => {
  const { renderTestPayload } = loadInternals().exports;
  const model = {
    plainBody: "Question?",
    htmlBody: '<div>Question?<img src="https://example.test/image.png" alt="Diagram"></div>',
    htmlBodyWithoutImages: "<div>Question?</div>",
    answers: [],
  };

  const withImages = renderTestPayload([model], { includeAnswers: true, includeImages: true });
  const withoutImages = renderTestPayload([model], { includeAnswers: true, includeImages: false });
  assert.match(withImages.plain, /^1\. Question\?/);
  assert.doesNotMatch(withImages.plain, /Selected answer/);
  assert.match(withImages.html, /<img /);
  assert.doesNotMatch(withoutImages.html, /<img /);
});

test("image sources reject executable and transient URL schemes", () => {
  const { sanitizeImageSource } = loadInternals().exports;
  assert.equal(sanitizeImageSource("javascript:alert(1)"), "");
  assert.equal(sanitizeImageSource("blob:https://example.test/123"), "");
  assert.equal(sanitizeImageSource("data:text/html;base64,PHNjcmlwdD4="), "");
  assert.equal(sanitizeImageSource("data:image/svg+xml;base64,PHN2Zz4="), "");
  assert.equal(sanitizeImageSource("data:image/png;base64,AA=="), "data:image/png;base64,AA==");
  assert.equal(sanitizeImageSource("https://example.test/image.png"), "https://example.test/image.png");
});

test("rich clipboard writes both MIME types and falls back to plain text", async () => {
  const richWrites = [];
  const plainWrites = [];
  class ClipboardItemStub {
    constructor(types) {
      this.types = types;
    }
  }
  const navigator = {
    clipboard: {
      write(items) {
        richWrites.push(items);
        return Promise.resolve();
      },
      writeText(value) {
        plainWrites.push(value);
        return Promise.resolve();
      },
    },
  };
  const { exports } = loadInternals({ navigator, ClipboardItem: ClipboardItemStub });
  await exports.writeClipboard({ plain: "Question", html: "<p>Question</p>" });
  assert.equal(richWrites.length, 1);
  assert.deepEqual(Object.keys(richWrites[0][0].types).sort(), ["text/html", "text/plain"]);
  assert.equal(plainWrites.length, 0);

  navigator.clipboard.write = () => Promise.reject(new Error("not supported"));
  await exports.writeClipboard({ plain: "Fallback", html: "<p>Fallback</p>" });
  assert.deepEqual(plainWrites, ["Fallback"]);
});
