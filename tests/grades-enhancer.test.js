const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadGradesEnhancerInternals() {
  const scriptPath = path.join(__dirname, "..", "scripts", "grades-enhancer.js");
  const source = fs.readFileSync(scriptPath, "utf8");
  const instrumentedSource = source.replace(
    'if (document.readyState === "loading") {',
    'globalThis.__eeTest = { parseAverage, gradeColor, gradePercentage, parseDateOnly, normalizeDateInput, parseSubjectMap, computeSubjectAbsences, summarizeAttendance, summarizeRenderableAttendance, finalizeSubjectStats, resolveAttendanceBreakdown, matchSubjectStats, parseGradeTitleSegments, buildGradeOriginalTitleHtml, buildGradeTitleOverrideKey, gradeTableRowCount, resolveCurrentHalfWindow, computeProjectedSubjectTotals, buildAttendancePlaceholderState, shouldRenderPredictedAttendance, computeSummaryColumnLayout }; if (document.readyState === "loading") {',
  );

  const context = {
    console,
    navigator: { language: "en-US" },
    document: {
      readyState: "loading",
      addEventListener() {},
      documentElement: { lang: "en-US" },
    },
  };

  context.window = context;
  context.window.top = context.window;
  context.globalThis = context;

  vm.runInNewContext(instrumentedSource, context, { filename: scriptPath });
  return context.__eeTest;
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

runTest("percentage averages keep their actual percentage fill and good-grade color", () => {
  const { parseAverage, gradeColor, gradePercentage } = loadGradesEnhancerInternals();
  const average = parseAverage("87 %");

  assert.equal(average, 87);
  assert.equal(gradePercentage(average), 87);
  assert.equal(gradeColor(average), "#558b2f");
});

runTest("numeric averages still use the existing 1-5 grading scale", () => {
  const { parseAverage, gradeColor, gradePercentage } = loadGradesEnhancerInternals();
  const average = parseAverage("2.13");

  assert.equal(average, 2.13);
  assert.equal(gradePercentage(average), 72.88);
  assert.equal(gradeColor(average), "#558b2f");
});

runTest("date-only parsing rejects calendar overflow dates", () => {
  const { parseDateOnly, normalizeDateInput } = loadGradesEnhancerInternals();

  assert.equal(parseDateOnly("2026-02-31"), null);
  assert.equal(parseDateOnly("2026-13-01"), null);
  assert.equal(normalizeDateInput("2026-02-31"), "");
  assert.equal(normalizeDateInput("2026-02-28"), "2026-02-28");
});

runTest("attendance loading placeholders are visibly different from unavailable placeholders", () => {
  const { buildAttendancePlaceholderState } = loadGradesEnhancerInternals();

  const loading = buildAttendancePlaceholderState("loading");
  const unavailable = buildAttendancePlaceholderState("unavailable");

  assert.equal(loading.text, "...");
  assert.equal(loading.empty, true);
  assert.equal(loading.loading, true);
  assert.match(loading.title, /loading/i);

  assert.equal(unavailable.text, "-");
  assert.equal(unavailable.empty, true);
  assert.equal(unavailable.loading, false);
});

runTest("predicted attendance stays hidden while prediction data is still loading", () => {
  const { shouldRenderPredictedAttendance } = loadGradesEnhancerInternals();

  assert.equal(shouldRenderPredictedAttendance({
    predictionState: "loading",
    predictedPercent: 10,
    predictedTotal: 20,
  }), false);

  assert.equal(shouldRenderPredictedAttendance({
    predictionState: "ready",
    predictedPercent: 10,
    predictedTotal: 20,
  }), true);
});

runTest("overall row layout keeps the notes corner while preserving the first two label columns", () => {
  const { computeSummaryColumnLayout } = loadGradesEnhancerInternals();

  const withNotes = computeSummaryColumnLayout(8);
  assert.equal(withNotes.labelSpan, 2);
  assert.equal(withNotes.trailingSpan, 1);

  const manyGradeCells = computeSummaryColumnLayout(12);
  assert.equal(manyGradeCells.labelSpan, 6);
  assert.equal(manyGradeCells.trailingSpan, 1);
});

runTest("current half window keeps the projection end at June 30 in the second halfyear", () => {
  const { resolveCurrentHalfWindow } = loadGradesEnhancerInternals();
  const halfWindow = resolveCurrentHalfWindow({
    currentDate: "2026-05-09",
    yearTurnover: "2025-09-01",
    selectedYear: 2025,
    halves: { "1": "1. Polrok", "2": "2. Polrok" },
    secondHalfOverride: "",
  });

  assert.equal(halfWindow.halfKey, "2");
  assert.equal(halfWindow.halfEndDate, "2026-06-30");
});

runTest("current half window honors a custom second-half projection end date", () => {
  const { resolveCurrentHalfWindow } = loadGradesEnhancerInternals();
  const halfWindow = resolveCurrentHalfWindow({
    currentDate: "2026-05-09",
    yearTurnover: "2025-09-01",
    selectedYear: 2025,
    halves: { "1": "1. Polrok", "2": "2. Polrok" },
    secondHalfOverride: "",
    secondHalfEndOverride: "2026-06-19",
  });

  assert.equal(halfWindow.halfKey, "2");
  assert.equal(halfWindow.halfEndDate, "2026-06-19");
});

runTest("subject absences can be assigned directly from attendance subject ids", () => {
  const { computeSubjectAbsences, parseSubjectMap } = loadGradesEnhancerInternals();
  const attendancePayload = {
    order: ["student-1"],
    students: {
      "student-1": {
        "2026-05-05": {
          "3": {
            presence: "A",
            subjectid: "42",
            studentabsent_typeid: "n",
          },
        },
      },
    },
  };
  const absenceTypeMap = new Map([
    ["n", { id: "n", et: "N", short: "N", name: "Neospravedlnena absencia" }],
  ]);
  const classbookData = { dates: {} };
  const subjectMap = parseSubjectMap({
    42: { name: "dejepis", short: "DEJ" },
  });
  const halfWindow = {
    startDate: "2026-02-01",
    endDate: "2026-05-31",
    currentDate: "2026-05-07",
    nowMinutes: 24 * 60,
  };

  const entries = computeSubjectAbsences(
    attendancePayload,
    absenceTypeMap,
    classbookData,
    subjectMap,
    halfWindow,
    [],
  );
  const dejepis = entries.get("id:42");

  assert.ok(dejepis);
  assert.equal(dejepis.displayName, "dejepis");
  assert.equal(dejepis.absent, 1);
});

runTest("attendance breakdown keeps official totals and exposes unmatched lessons", () => {
  const { resolveAttendanceBreakdown } = loadGradesEnhancerInternals();
  const renderedSummary = {
    absent: 37,
    total: 348,
    percent: (37 / 348) * 100,
  };
  const officialHalfSummary = {
    absent: 43,
    total: 529,
    percent: (43 / 529) * 100,
  };

  const breakdown = resolveAttendanceBreakdown(renderedSummary, officialHalfSummary, 43);

  assert.equal(breakdown.summary.absent, 43);
  assert.equal(breakdown.summary.total, 529);
  assert.equal(breakdown.unmatched.absent, 6);
  assert.equal(breakdown.unmatched.total, 181);
});

runTest("row matching prefers EduPage subject ids when aliases are missing", () => {
  const { matchSubjectStats } = loadGradesEnhancerInternals();
  const subjectStats = [
    {
      key: "id:42",
      rawId: "42",
      displayName: "",
      shortName: "",
      absent: 1,
      total: 10,
      percent: 10,
      aliases: [],
    },
  ];

  const matched = matchSubjectStats("dejepis", subjectStats, "42");

  assert.ok(matched);
  assert.equal(matched.absent, 1);
  assert.equal(matched.total, 10);
});

runTest("row matching merges exact-id totals with alias-matched absences", () => {
  const { matchSubjectStats } = loadGradesEnhancerInternals();
  const subjectStats = [
    {
      key: "id:34704",
      rawId: "34704",
      displayName: "dejepis",
      shortName: "DEJ",
      absent: 0,
      total: 10,
      percent: 0,
      aliases: ["dejepis", "dej"],
    },
    {
      key: "id:legacy-42",
      rawId: "legacy-42",
      displayName: "dejepis",
      shortName: "DEJ",
      absent: 1,
      total: 0,
      percent: Number.NaN,
      aliases: ["dejepis", "dej"],
    },
  ];

  const matched = matchSubjectStats("dejepis", subjectStats, "34704");

  assert.ok(matched);
  assert.equal(matched.absent, 1);
  assert.equal(matched.total, 10);
});

runTest("attendance-only events stay unmatched instead of pretending to belong to a grades row", () => {
  const { summarizeRenderableAttendance, resolveAttendanceBreakdown } = loadGradesEnhancerInternals();
  const subjects = [
    {
      key: "id:34704",
      rawId: "34704",
      displayName: "dejepis",
      shortName: "DEJ",
      absent: 0,
      total: 10,
      percent: 0,
      aliases: ["dejepis", "dej"],
    },
    {
      key: "id:event-1",
      rawId: "Online nasilie",
      displayName: "Online nasilie",
      shortName: "",
      absent: 6,
      total: 0,
      percent: Number.NaN,
      aliases: ["online nasilie"],
    },
  ];

  const renderedSummary = summarizeRenderableAttendance(subjects);
  const breakdown = resolveAttendanceBreakdown(
    renderedSummary,
    { absent: 6, total: 10, percent: 60 },
    6,
  );

  assert.equal(renderedSummary.absent, 0);
  assert.equal(renderedSummary.total, 10);
  assert.equal(breakdown.unmatched.absent, 6);
});

runTest("projected subject totals extend the denominator while keeping absences fixed", () => {
  const { computeProjectedSubjectTotals, parseSubjectMap, finalizeSubjectStats } = loadGradesEnhancerInternals();
  const classbookData = {
    dates: {
      "2026-02-02": { plan: [{ type: "lesson", subjectid: "42", period: "1" }] },
      "2026-02-04": { plan: [{ type: "lesson", subjectid: "42", period: "2" }] },
      "2026-02-09": { plan: [{ type: "lesson", subjectid: "42", period: "1" }] },
      "2026-02-11": { plan: [{ type: "lesson", subjectid: "42", period: "2" }] },
    },
  };
  const subjectMap = parseSubjectMap({
    42: { name: "dejepis", short: "DEJ" },
  });
  const halfWindow = {
    startDate: "2026-02-01",
    endDate: "2026-02-11",
    currentDate: "2026-02-11",
    halfEndDate: "2026-02-18",
    nowMinutes: 24 * 60,
  };
  const absentEntries = new Map([[
    "id:42",
    {
      key: "id:42",
      rawId: "42",
      displayName: "dejepis",
      shortName: "DEJ",
      absent: 1,
      total: 0,
      aliases: new Set(["dejepis", "dej"]),
    },
  ]]);
  const totalEntries = new Map([[
    "id:42",
    {
      key: "id:42",
      rawId: "42",
      displayName: "dejepis",
      shortName: "DEJ",
      absent: 0,
      total: 4,
      aliases: new Set(["dejepis", "dej"]),
    },
  ]]);

  const projectedTotals = computeProjectedSubjectTotals(classbookData, subjectMap, halfWindow);
  const subjects = finalizeSubjectStats(absentEntries, totalEntries, projectedTotals);
  const dejepis = subjects.find((entry) => entry.rawId === "42");

  assert.ok(dejepis);
  assert.equal(dejepis.total, 4);
  assert.equal(dejepis.predictedTotal, 6);
  assert.equal(Number(dejepis.predictedPercent.toFixed(2)), 16.67);
});

runTest("grade title overrides preserve the date details and replace only the title", () => {
  const { parseGradeTitleSegments, buildGradeOriginalTitleHtml } = loadGradesEnhancerInternals();
  const original = "<b>Písomná odpoveď</b><br>Dátum známky: 12.02.2026";

  const parsed = parseGradeTitleSegments(original);
  const rebuilt = buildGradeOriginalTitleHtml("Esej", parsed.detailHtml);

  assert.equal(parsed.title, "Písomná odpoveď");
  assert.equal(parsed.detailHtml, "Dátum známky: 12.02.2026");
  assert.equal(rebuilt, "<b>Esej</b><br>Dátum známky: 12.02.2026");
});

runTest("grade title override keys stay stable for the same subject, date, grade, column, and default title", () => {
  const { buildGradeTitleOverrideKey } = loadGradesEnhancerInternals();

  const key = buildGradeTitleOverrideKey("34704", "12.02.2026", "2", 3, "Písomná odpoveď");

  assert.equal(key, "34704|12.02.2026|2|3|Písomná odpoveď");
});

runTest("primary grades table scoring prefers the table with subject rows over a header-only clone", () => {
  const { gradeTableRowCount } = loadGradesEnhancerInternals();

  const headerOnlyTable = {
    querySelectorAll(selector) {
      return selector === "tr.predmetRow" ? [] : [];
    },
  };
  const fullTable = {
    querySelectorAll(selector) {
      return selector === "tr.predmetRow" ? [{}, {}, {}] : [];
    },
  };

  assert.equal(gradeTableRowCount(headerOnlyTable), 0);
  assert.equal(gradeTableRowCount(fullTable), 3);
});
