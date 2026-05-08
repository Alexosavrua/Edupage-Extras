const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadAttendanceEnhancerInternals() {
  const scriptPath = path.join(__dirname, "..", "scripts", "attendance-enhancer.js");
  const source = fs.readFileSync(scriptPath, "utf8");
  const instrumentedSource = source.replace(
    'if (document.readyState === "loading") {',
    'globalThis.__eeAttendanceTest = { parseDateOnly, normalizeDateInput, resolveSecondHalfStartDate }; if (document.readyState === "loading") {',
  );

  const context = {
    console,
    document: {
      readyState: "loading",
      addEventListener() {},
      documentElement: {},
    },
  };

  context.window = context;
  context.window.top = context.window;
  context.globalThis = context;

  vm.runInNewContext(instrumentedSource, context, { filename: scriptPath });
  return context.__eeAttendanceTest;
}

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  }
}

runTest("attendance date inputs reject calendar overflow dates", () => {
  const { parseDateOnly, normalizeDateInput } = loadAttendanceEnhancerInternals();

  assert.equal(parseDateOnly("2026-02-31"), null);
  assert.equal(parseDateOnly("2026-04-31"), null);
  assert.equal(normalizeDateInput("2026-02-31"), "");
  assert.equal(normalizeDateInput("2026-04-30"), "2026-04-30");
});

runTest("second-half override ignores invalid calendar dates", () => {
  const { resolveSecondHalfStartDate } = loadAttendanceEnhancerInternals();
  const turnover = new Date(2025, 8, 1);

  assert.equal(resolveSecondHalfStartDate(turnover, "2026-02-31").toISOString().slice(0, 10), "2026-02-01");
  assert.equal(resolveSecondHalfStartDate(turnover, "2026-02-02").toISOString().slice(0, 10), "2026-02-02");
});
