const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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

const settingsPath = path.join(__dirname, "..", "menu", "settings.html");
const html = fs.readFileSync(settingsPath, "utf8");
const switchLabels = Array.from(
  html.matchAll(/<label class="([^"]*\bswitch\b[^"]*)"[^>]*>([\s\S]*?)<\/label>/g),
);

runTest("every settings switch includes the visual switch track", () => {
  assert.ok(switchLabels.length > 0, "expected at least one switch label");
  switchLabels.forEach(([, className, body]) => {
    assert.match(className, /\bswitch\b/);
    assert.match(body, /class="switch-track"/, `missing switch track for ${className}`);
  });
});

runTest("compact settings switches use screen-reader labels", () => {
  const compactSwitches = switchLabels.filter(([, className]) => /\bswitch-compact\b/.test(className));

  assert.ok(compactSwitches.length > 0, "expected compact switches for top-level settings");
  compactSwitches.forEach(([, , body]) => {
    assert.match(body, /class="sr-only"/, "compact switch is missing screen-reader text");
  });
});

runTest("debug-only attendance dates and WIP feature markers stay in their intended settings sections", () => {
  const debugStart = html.indexOf('id="panel-debug"');
  assert.ok(debugStart >= 0, "expected a Debug settings panel");
  assert.ok(html.indexOf('id="HalfyearStartDateInput"') > debugStart);
  assert.ok(html.indexOf('id="HalfyearEndDateInput"') > debugStart);

  const autoLoginRow = html.indexOf('for="AutoLoginCheckbox"');
  const etestCopyRow = html.indexOf('for="EtestCopyCheckbox"');
  assert.ok(autoLoginRow >= 0 && html.indexOf('setting-tag-wip', autoLoginRow - 500) >= 0);
  assert.ok(etestCopyRow >= 0 && html.indexOf('setting-tag-wip', etestCopyRow - 500) >= 0);
  assert.match(html, /id="AutoLoginPreferredAccountRow"/);
  assert.match(html, /id="EtestQuestionButtonsRow"[^>]*hidden/);
  assert.match(html, /id="EtestWholeTestButtonRow"[^>]*hidden/);
  assert.match(html, /id="EtestIncludeAnswersRow"[^>]*hidden/);
  assert.match(html, /id="EtestIncludeImagesRow"[^>]*hidden/);
  assert.match(html, /for="EtestQuestionButtonsCheckbox"/);
  assert.match(html, /for="EtestWholeTestButtonCheckbox"/);
  assert.match(html, /for="EtestIncludeAnswersCheckbox"/);
  assert.match(html, /for="EtestIncludeImagesCheckbox"/);
});
