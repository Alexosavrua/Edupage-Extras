const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadInternals() {
  const context = { console };
  context.globalThis = context;
  context.__EE_TEST__ = true;
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "..", "menu", "etest-image-export.js"), "utf8"),
    context,
    { filename: "menu/etest-image-export.js" },
  );
  return context.__eeTestExports;
}

test("test image text wrapping preserves blank lines and wraps complete words", () => {
  const { wrapTextForImage } = loadInternals();
  const context = { measureText: (value) => ({ width: value.length }) };
  const lines = wrapTextForImage(context, "Question one\n\nA) first answer B) second", 13);

  assert.deepEqual(JSON.parse(JSON.stringify(lines)), [
    "Question one",
    "",
    "A) first",
    "answer B)",
    "second",
  ]);
});
