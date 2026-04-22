/**
 * grades-enhancer.js
 *
 * Enhances the Edupage /znamky/ table in-place:
 * - average badges and bars
 * - overall average row based on Edupage-rendered subject averages
 */

(function () {
  "use strict";

  const STYLE_ID = "ee-grades-enhancer-style";
  const PROCESSED_ATTR = "data-ee-enhanced";
  const GRADE_BADGES_KEY = "gradeBadgesEnabled";

  let gradeBadgesEnabled = false;
  let observerTimer = null;

  function parseAverage(text) {
    if (!text) return NaN;
    const match = text.trim().match(/^(\d+(?:[.,]\d+)?)/);
    return match ? Number.parseFloat(match[1].replace(",", ".")) : NaN;
  }

  function gradeColor(avg) {
    if (Number.isNaN(avg)) return "#888";
    if (avg <= 1.5) return "#2e7d32";
    if (avg <= 2.5) return "#558b2f";
    if (avg <= 3.5) return "#f57f17";
    if (avg <= 4.5) return "#e65100";
    return "#c62828";
  }

  function buildBadgeHtml(avg, displayText) {
    if (Number.isNaN(avg)) return "";
    const color = gradeColor(avg);
    const pct = Math.max(4, Math.min(100, ((5 - avg) / 4) * 96 + 4));
    return `
      <div class="ee-avg-badge" style="--avg-color:${color};--avg-pct:${pct.toFixed(1)}%">
        <span class="ee-avg-value">${displayText}</span>
        <div class="ee-avg-bar-track"><div class="ee-avg-bar-fill"></div></div>
      </div>`;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .ee-avg-badge {
        display: inline-flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 3px;
        min-width: 52px;
      }

      .ee-avg-value {
        color: var(--avg-color);
        font-size: 14px;
        font-weight: bold;
        line-height: 1;
        transition: color 0.2s;
      }

      .ee-avg-bar-track {
        width: 100%;
        height: 4px;
        background: #e0e0e0;
        border-radius: 2px;
        overflow: hidden;
      }

      .ee-avg-bar-fill {
        height: 100%;
        width: var(--avg-pct);
        background: var(--avg-color);
        border-radius: 2px;
        transition: width 0.4s ease;
      }

      tr.ee-overall-row td {
        background-color: #f0f7ff !important;
        border-top: 2px solid #3e83b8 !important;
        font-size: 13px;
        padding: 8px 10px !important;
      }

      tr.ee-overall-row .ee-overall-label {
        color: #1565c0;
        font-size: 13px;
        font-weight: bold;
      }

      .ee-overall-meta {
        display: block;
        color: #777;
        font-size: 10px;
        line-height: 1.1;
      }

      table.znamkyTable tr.predmetRow:hover .ee-avg-value {
        text-decoration: underline dotted;
      }

      table.znamkyTable th:last-of-type,
      table.znamkyTable .znPriemerCell {
        min-width: 64px !important;
      }

      html.ee-dark .ee-avg-bar-track {
        background-color: var(--ee-border) !important;
      }

      html.ee-dark tr.ee-overall-row td {
        background-color: var(--ee-bg-elevated) !important;
        border-top-color: var(--ee-accent) !important;
        color: var(--ee-text-main) !important;
      }

      html.ee-dark tr.ee-overall-row .ee-overall-label {
        color: var(--ee-accent) !important;
      }

      html.ee-dark .ee-overall-meta {
        color: var(--ee-text-muted) !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function readAverageText(priemerCell) {
    if (!priemerCell) return "";
    if (priemerCell.dataset.eeOriginalAverage) {
      return priemerCell.dataset.eeOriginalAverage;
    }

    const link = priemerCell.querySelector("a");
    return (link ? link.textContent : priemerCell.textContent).trim();
  }

  function enhanceAverageCell(row) {
    const priemerCell = row.querySelector(".znPriemerCell");
    if (!priemerCell) return NaN;

    const rawText = readAverageText(priemerCell);
    const avg = parseAverage(rawText);
    if (Number.isNaN(avg) || priemerCell.querySelector(".ee-avg-badge")) return avg;

    priemerCell.dataset.eeOriginalAverage = rawText;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = buildBadgeHtml(avg, rawText);
    const badge = wrapper.firstElementChild;
    if (!badge) return avg;

    const link = priemerCell.querySelector("a");
    if (link) {
      link.textContent = "";
      link.appendChild(badge);
    } else {
      priemerCell.textContent = "";
      priemerCell.appendChild(badge);
    }

    return avg;
  }

  function restoreAverageCells(table) {
    table.querySelectorAll(".znPriemerCell").forEach((priemerCell) => {
      const originalText = priemerCell.dataset.eeOriginalAverage;
      if (!originalText || !priemerCell.querySelector(".ee-avg-badge")) return;

      const link = priemerCell.querySelector("a");
      if (link) {
        link.textContent = originalText;
      } else {
        priemerCell.textContent = originalText;
      }
      delete priemerCell.dataset.eeOriginalAverage;
    });

    table.querySelector("tr.ee-overall-row")?.remove();
    table.removeAttribute(PROCESSED_ATTR);
  }

  function collectAverages(table) {
    return Array.from(table.querySelectorAll("tr.predmetRow"))
      .map((row) => enhanceAverageCell(row))
      .filter((avg) => !Number.isNaN(avg));
  }

  function tableColumnCount(table) {
    const headerRow = table.querySelector("thead tr");
    if (headerRow) {
      return Array.from(headerRow.cells).reduce(
        (sum, cell) => sum + (Number.parseInt(cell.colSpan, 10) || 1),
        0,
      );
    }

    return Math.max(5, table.querySelector("tr")?.cells.length || 5);
  }

  function ensureSummaryRow(table, averages) {
    const existing = table.querySelector("tr.ee-overall-row");
    if (existing) existing.remove();
    if (averages.length === 0) return;

    const tbody = table.querySelector("tbody");
    if (!tbody) return;

    const colCount = tableColumnCount(table);
    const overallAvg = averages.reduce((a, b) => a + b, 0) / averages.length;
    const overallColor = gradeColor(overallAvg);
    const overallPct = Math.max(4, Math.min(100, ((5 - overallAvg) / 4) * 96 + 4));

    const summaryRow = document.createElement("tr");
    summaryRow.className = "ee-overall-row";

    const labelCell = document.createElement("td");
    labelCell.className = "fixedCell";
    labelCell.colSpan = Math.max(1, colCount - 2);
    labelCell.innerHTML = `
      <span class="ee-overall-label">Overall</span>
      <span class="ee-overall-meta">${averages.length} subjects</span>
    `;

    const avgCell = document.createElement("td");
    avgCell.colSpan = 2;
    avgCell.style.cssText = "text-align:right;padding:8px 10px;";
    avgCell.innerHTML = `
      <div class="ee-avg-badge" style="--avg-color:${overallColor};--avg-pct:${overallPct.toFixed(1)}%">
        <span class="ee-avg-value" style="font-size:17px;">${overallAvg.toFixed(2)}</span>
        <div class="ee-avg-bar-track"><div class="ee-avg-bar-fill"></div></div>
      </div>`;

    summaryRow.appendChild(labelCell);
    summaryRow.appendChild(avgCell);
    tbody.appendChild(summaryRow);
  }

  function enhanceGradesTable() {
    const table = document.querySelector("table.znamkyTable");
    if (!table) return;

    injectStyles();

    if (!gradeBadgesEnabled) {
      restoreAverageCells(table);
      return;
    }

    const averages = collectAverages(table);
    ensureSummaryRow(table, averages);
    table.setAttribute(PROCESSED_ATTR, "1");
  }

  function scheduleEnhance() {
    window.clearTimeout(observerTimer);
    observerTimer = window.setTimeout(enhanceGradesTable, 160);
  }

  function initStorage() {
    chrome.storage.local.get([GRADE_BADGES_KEY], (result) => {
      gradeBadgesEnabled = result[GRADE_BADGES_KEY] === true;
      enhanceGradesTable();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[GRADE_BADGES_KEY]) return;
      gradeBadgesEnabled = changes[GRADE_BADGES_KEY].newValue === true;
      enhanceGradesTable();
    });
  }

  function initObserver() {
    const observer = new MutationObserver(() => {
      if (document.querySelector("table.znamkyTable")) {
        scheduleEnhance();
      }
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  function init() {
    injectStyles();
    initStorage();
    enhanceGradesTable();
    initObserver();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
