/**
 * grades-enhancer.js
 *
 * Enhances the Edupage /znamky/ grades table by:
 *  1. Adding a color-coded average badge with a visual bar to each subject row
 *  2. Appending an "Overall Average" summary row at the bottom of the table
 *
 * Works by reading the existing DOM — no API calls, no extra data sources needed.
 * The ".znPriemerCell" already contains Edupage's computed average as text.
 */

(function () {
  "use strict";

  // ── Constants ─────────────────────────────────────────────────────────────

  const STYLE_ID = "ee-grades-enhancer-style";
  const PROCESSED_ATTR = "data-ee-enhanced";

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Parse a Slovak grade average string like "2.13" or "1-" to a number */
  function parseAverage(text) {
    if (!text) return NaN;
    const trimmed = text.trim();
    // Handle suffixed grades like "1-", "2+" by splitting off the suffix
    const match = trimmed.match(/^(\d+(?:[.,]\d+)?)/);
    if (!match) return NaN;
    return parseFloat(match[1].replace(",", "."));
  }

  /** Map a 1–5 grade average to a color */
  function gradeColor(avg) {
    if (isNaN(avg)) return "#888";
    if (avg <= 1.5)  return "#2e7d32"; // deep green
    if (avg <= 2.5)  return "#558b2f"; // olive green
    if (avg <= 3.5)  return "#f57f17"; // amber
    if (avg <= 4.5)  return "#e65100"; // deep orange
    return "#c62828";                  // deep red
  }

  /**
   * Build the HTML for an average badge + thin progress bar.
   * The bar fills left-to-right proportionally: 1 = full, 5 = almost empty.
   */
  function buildBadgeHtml(avg, displayText) {
    if (isNaN(avg)) return "";
    const color = gradeColor(avg);
    const pct   = Math.max(4, Math.min(100, ((5 - avg) / 4) * 96 + 4));
    return `
      <div class="ee-avg-badge" style="--avg-color:${color};--avg-pct:${pct.toFixed(1)}%">
        <span class="ee-avg-value">${displayText}</span>
        <div class="ee-avg-bar-track"><div class="ee-avg-bar-fill"></div></div>
      </div>`;
  }

  // ── Style injection ───────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* ── Grades Enhancer – Edupage Extras ─────────────────────────── */

      .ee-avg-badge {
        display: inline-flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 3px;
        min-width: 52px;
      }

      .ee-avg-value {
        font-weight: bold;
        color: var(--avg-color);
        font-size: 14px;
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

      /* Overall summary row */
      tr.ee-overall-row td {
        background-color: #f0f7ff !important;
        border-top: 2px solid #3e83b8 !important;
        padding: 8px 10px !important;
        font-size: 13px;
      }

      tr.ee-overall-row .ee-overall-label {
        font-weight: bold;
        color: #1565c0;
        font-size: 13px;
      }

      /* Subtle hover enhancement on existing rows */
      table.znamkyTable tr.predmetRow:hover .ee-avg-value {
        text-decoration: underline dotted;
      }

      /* Make the existing Priemer cell a bit wider to fit the bar */
      table.znamkyTable th:last-of-type,
      table.znamkyTable .znPriemerCell {
        min-width: 64px !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  // ── Core enhancement ──────────────────────────────────────────────────────

  function enhanceGradesTable() {
    const table = document.querySelector("table.znamkyTable");
    if (!table || table.hasAttribute(PROCESSED_ATTR)) return;
    table.setAttribute(PROCESSED_ATTR, "1");

    const predmetRows = table.querySelectorAll("tr.predmetRow");
    if (!predmetRows.length) return;

    const averages = [];

    predmetRows.forEach((row) => {
      const priemerCell = row.querySelector(".znPriemerCell");
      if (!priemerCell) return;

      // Get the displayed average text (the <a> inside the cell, or the cell text itself)
      const link = priemerCell.querySelector("a");
      const rawText = (link ? link.textContent : priemerCell.textContent).trim();
      if (!rawText) return;

      const avg = parseAverage(rawText);
      if (!isNaN(avg)) averages.push(avg);

      // Replace the plain number with a badge + bar
      const badge = document.createElement("div");
      badge.innerHTML = buildBadgeHtml(avg, rawText);
      const badgeEl = badge.firstElementChild;

      if (link) {
        // Keep the tooltip/link, just wrap the text
        link.textContent = "";
        link.appendChild(badgeEl);
      } else {
        priemerCell.textContent = "";
        priemerCell.appendChild(badgeEl);
      }
    });

    // ── Overall average summary row ────────────────────────────────────────
    if (averages.length === 0) return;

    const overallAvg = averages.reduce((a, b) => a + b, 0) / averages.length;
    const overallColor = gradeColor(overallAvg);
    const overallPct   = Math.max(4, Math.min(100, ((5 - overallAvg) / 4) * 96 + 4));

    // Determine how many columns the table has
    const headerRow   = table.querySelector("thead tr");
    const colCount    = headerRow
      ? Array.from(headerRow.cells).reduce((s, c) => s + (parseInt(c.colSpan) || 1), 0)
      : 9;

    const tbody = table.querySelector("tbody");
    if (!tbody) return;

    const summaryRow   = document.createElement("tr");
    summaryRow.className = "ee-overall-row";

    const labelCell    = document.createElement("td");
    labelCell.className = "fixedCell";
    labelCell.style.cssText = "min-width:250px;white-space:nowrap;border-right:2px solid #cce9ff;padding:8px 12px;";
    labelCell.innerHTML = `<span class="ee-overall-label">📊 Celkový priemer</span><div style="font-size:11px;color:#555;margin-top:2px;">${averages.length} predmet${averages.length === 1 ? "" : "ov"}</div>`;

    const middleCell   = document.createElement("td");
    middleCell.colSpan = colCount - 3;

    const avgCell      = document.createElement("td");
    avgCell.colSpan    = 2;
    avgCell.style.cssText = "text-align:right;padding:8px 10px;";
    avgCell.innerHTML  = `
      <div class="ee-avg-badge" style="--avg-color:${overallColor};--avg-pct:${overallPct.toFixed(1)}%">
        <span class="ee-avg-value" style="font-size:17px;">${overallAvg.toFixed(2)}</span>
        <div class="ee-avg-bar-track"><div class="ee-avg-bar-fill"></div></div>
      </div>`;

    summaryRow.appendChild(labelCell);
    summaryRow.appendChild(middleCell);
    summaryRow.appendChild(avgCell);
    tbody.appendChild(summaryRow);
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  function init() {
    injectStyles();

    // Run immediately if the table is already present (document_idle)
    enhanceGradesTable();

    // Also observe for the case Edupage swaps content via its own JS
    const observer = new MutationObserver(() => {
      if (!document.querySelector(`table.znamkyTable[${PROCESSED_ATTR}]`)) {
        enhanceGradesTable();
      }
    });
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  init();
})();
