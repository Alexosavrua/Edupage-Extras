/**
 * content.js — Edupage Extras: Dark Mode (Final Polish)
 *
 * Comprehensive dark theme targeting both sub-pages and the main dashboard.
 */

const STORAGE_KEY = "darkModeEnabled";
const CLASS_NAME  = "ee-dark";
const STYLE_ID    = "ee-dark-mode-style";

function buildDarkCSS() {
  return `
    /* ══════════════════════════════════════════════════════════════
       Edupage Extras – Dark Mode
       Palette:
         bg-base     #11111b   (deepest background)
         bg-raised   #181825   (cards, main sidebar)
         bg-elevated #1e1e2e   (headers, hover states)
         border      #313244
         text-main   #cdd6f4
         text-muted  #a6adc8
         accent      #89b4fa
    ══════════════════════════════════════════════════════════════ */

    html.ee-dark,
    html.ee-dark body {
      background-color: #11111b !important;
      color: #cdd6f4 !important;
    }

    /* ── Main Dashboard (.bgDiv) ─────────────────────────────── */
    html.ee-dark .bgDiv,
    html.ee-dark .userHomeWidget,
    html.ee-dark .userTopDiv,
    html.ee-dark .userContentInner,
    html.ee-dark .withMargin,
    html.ee-dark .userTopDivInner,
    html.ee-dark .wmaxL1 {
      background-color: #11111b !important;
      color: #cdd6f4 !important;
    }

    /* Greeting Area */
    html.ee-dark .userTopLogo,
    html.ee-dark .userTopLogo div {
      color: #cdd6f4 !important;
      background-color: transparent !important;
      background-image: none !important; /* Remove pattern overlays if any */
    }

    /* ── Dashboard Tiles (.userButton) ────────────────────────── */
    html.ee-dark .userButton {
      background-color: #181825 !important;
      border: 1px solid #313244 !important;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3) !important;
      transition: transform 0.2s, background-color 0.2s !important;
    }
    html.ee-dark .userButton:hover {
      background-color: #1e1e2e !important;
      border-color: #89b4fa !important;
      transform: translateY(-2px);
    }
    html.ee-dark .userButton .title {
      color: #cdd6f4 !important;
    }
    html.ee-dark .userButton .subtitle,
    html.ee-dark .userButton .subtitle *,
    html.ee-dark .subtitle b {
      color: #a6adc8 !important;
    }
    html.ee-dark .subtitle b {
        color: #89b4fa !important;
    }

    /* ── Timetable Widget ────────────────────────────────────── */
    html.ee-dark .userRozvrh,
    html.ee-dark .rozvrhItem,
    html.ee-dark .rozvrhItemAlign {
      background-color: #181825 !important;
      border-color: #313244 !important;
      color: #cdd6f4 !important;
    }
    html.ee-dark .rozvrhItem.selected {
      background-color: #1e3a5f !important;
      border-color: #89b4fa !important;
    }
    html.ee-dark .rozvrhItem .predmet {
      color: #89b4fa !important;
      font-weight: bold;
    }
    html.ee-dark .rozvrhItem .casy {
      color: #a6adc8 !important;
    }

    /* ── Calendar / Events ───────────────────────────────────── */
    html.ee-dark .userCal2,
    html.ee-dark .calendar,
    html.ee-dark .gotoDay,
    html.ee-dark .day,
    html.ee-dark .userCalInner,
    html.ee-dark .usercalendarTitle,
    html.ee-dark .usercalendarTitle h1 {
      background-color: #181825 !important;
      border-color: #313244 !important;
      color: #cdd6f4 !important;
    }
    html.ee-dark .calendar .day.today {
      background-color: #1e3a5f !important;
      border: 1px solid #89b4fa !important;
    }
    html.ee-dark .calendar .day .date {
      color: #89b4fa !important;
      font-weight: bold;
      border-bottom-color: #313244 !important;
    }
    html.ee-dark .events li {
      background-color: #2a2b3d !important;
      color: #cdd6f4 !important;
      border: none !important;
    }
    html.ee-dark .events li a {
      color: inherit !important;
    }
    html.ee-dark .event.schoolevent b {
        color: #89b4fa !important;
    }

    /* ── Header & Profile (.edubar) ──────────────────────────── */
    html.ee-dark #edubar,
    html.ee-dark .edubarHeader,
    html.ee-dark .edubarHeaderRight,
    html.ee-dark .edubarSidebar,
    html.ee-dark .edubarSidemenu2,
    html.ee-dark #edubarStartButton {
      background-color: #181825 !important;
      border-color: #313244 !important;
      color: #cdd6f4 !important;
    }
    html.ee-dark #edubarStartButton span,
    html.ee-dark #edubarStartButton div {
        color: #89b4fa !important;
    }

    html.ee-dark .edubarMenuitem > a {
      color: #a6adc8 !important;
    }
    html.ee-dark .edubarMenuitem.active > a,
    html.ee-dark .edubarMenuitem:hover > a {
      color: #89b4fa !important;
      background-color: #1e1e2e !important;
    }

    html.ee-dark .profilemenu,
    html.ee-dark .profilemenu li,
    html.ee-dark .profilemenu a,
    html.ee-dark .edubarProfilebox {
      background-color: #181825 !important;
      color: #cdd6f4 !important;
      border-color: #313244 !important;
    }
    html.ee-dark .profilemenu a:hover {
      background-color: #1e1e2e !important;
    }

    /* Notifications */
    html.ee-dark .notif {
        background-color: #f38ba8 !important;
        color: #11111b !important;
    }

    /* ── Sub-page Containers & Skins ─────────────────────────── */
    html.ee-dark .skinContent,
    html.ee-dark .skinBody,
    html.ee-dark .mainBox,
    html.ee-dark .edubarMainNoSkin,
    html.ee-dark #bar_mainDiv,
    html.ee-dark #eb_main_content,
    html.ee-dark .smartb,
    html.ee-dark .timeline-container,
    html.ee-dark .timeline-item,
    html.ee-dark .tml-item,
    html.ee-dark .grid-container,
    html.ee-dark .notifBox,
    /* Timeline / Notifications lists */
    html.ee-dark .hwItem,
    html.ee-dark .hwItemBg,
    html.ee-dark .hwItemInner,
    html.ee-dark .hwListElem,
    html.ee-dark .hwMainListMain,
    html.ee-dark .edubarRibbon,
    html.ee-dark .ribbon-tab,
    html.ee-dark .ribbon-section,
    html.ee-dark .ribbon-button,
    html.ee-dark .hwDateItem,
    html.ee-dark .hwWeekItem,
    html.ee-dark .tml-in-reply,
    /* Triedna Kniha / Timetable grids */
    html.ee-dark .ttday,
    html.ee-dark .ttItem,
    html.ee-dark .tt-day,
    html.ee-dark .timetable,
    html.ee-dark .timetable-cell,
    html.ee-dark .substitution-item,
    html.ee-dark .attendance-box,
    html.ee-dark .attendanceItem,
    /* Generic UI blocks */
    html.ee-dark .dialog,
    html.ee-dark .popup,
    html.ee-dark .gadgetBox,
    html.ee-dark .hw-content,
    html.ee-dark .print-box,
    html.ee-dark body.skindefault,
    html.ee-dark .modal-content,
    html.ee-dark iframe {
      background-color: #11111b !important;
      color: #cdd6f4 !important;
    }
    
    /* Catch inline hardcoded white backgrounds */
    html.ee-dark *[style*="background-color: white"],
    html.ee-dark *[style*="background: white"],
    html.ee-dark *[style*="background-color: #fff"],
    html.ee-dark *[style*="background: #fff"],
    html.ee-dark *[style*="background-color: rgb(255, 255, 255)"],
    html.ee-dark *[style*="background-color:#ffffff"],
    html.ee-dark *[style*="background-color: #ffffff"],
    html.ee-dark *[style*="background-color: #f5f5f5"],
    html.ee-dark *[style*="background-color: #eeeeee"],
    html.ee-dark *[style*="background-color: #f6f7f9"] {
        background-color: #181825 !important;
        color: #cdd6f4 !important;
    }

    /* ── Grade Viewer Header (zsv) ───────────────────────────── */
    html.ee-dark .zsvHeader,
    html.ee-dark #jwc5270ab8_zsv,
    html.ee-dark .zsvFilterElem,
    html.ee-dark #znamkyTableHeaderBg,
    html.ee-dark .zsvActionButtonsInner {
        background-color: #181825 !important;
        color: #cdd6f4 !important;
        border-color: #313244 !important;
    }

    html.ee-dark .zsvHeaderTabs {
        background-color: transparent !important;
    }
    
    html.ee-dark .zsvHeaderTab {
        background-color: #181825 !important;
        color: #a6adc8 !important;
        border-color: #313244 !important;
    }

    html.ee-dark .zsvHeaderTab.selected,
    html.ee-dark .zsvHeaderTab:hover {
        background-color: #1e1e2e !important;
        color: #89b4fa !important;
    }

    html.ee-dark .dropDownPanel,
    html.ee-dark .dropDown,
    html.ee-dark .zsvFilterItem select {
        background-color: #1e1e2e !important;
        color: #cdd6f4 !important;
        border-color: #313244 !important;
    }

    html.ee-dark .zsvHeaderTitle span {
        color: #a6adc8 !important;
    }

    html.ee-dark .flat-button {
        background-color: #1e1e2e !important;
        color: #cdd6f4 !important;
        border-color: #313244 !important;
    }
    html.ee-dark .flat-button:hover {
        background-color: #2a2b3d !important;
    }

    /* ── Grades Table & Enhancer ─────────────────────────────── */
    html.ee-dark table.znamkyTable,
    html.ee-dark table.znamkyTable tr {
      background-color: #181825 !important;
      border-color: #313244 !important;
    }
    html.ee-dark table.znamkyTable thead th {
      background-color: #11111b !important;
      color: #89b4fa !important;
    }
    html.ee-dark table.znamkyTable tr.predmetRow:nth-child(even) {
      background-color: #1e1e2e !important;
    }
    
    /* Enhancer bar track */
    html.ee-dark .ee-avg-bar-track {
        background-color: #313244 !important;
    }

    /* ── Global Fixes ────────────────────────────────────────── */
    html.ee-dark a {
      color: #89b4fa !important;
    }
    html.ee-dark h1, html.ee-dark h2, html.ee-dark h3 {
        color: #cdd6f4 !important;
    }
    html.ee-dark .warning {
        color: #fab387 !important;
    }

    /* Soften images */
    html.ee-dark img {
      filter: brightness(0.8) contrast(1.1) !important;
    }
    /* Invert icons that are meant for light mode */
    html.ee-dark .user-button-icon,
    html.ee-dark .ebicon,
    html.ee-dark .qbutton img {
      filter: invert(0.8) !important;
    }

    /* Remove glowing white shadows */
    html.ee-dark * {
      box-shadow: none !important;
    }
    html.ee-dark .userButton,
    html.ee-dark .profilemenu,
    html.ee-dark .day {
      box-shadow: 2px 2px 10px rgba(0,0,0,0.4) !important;
    }
    
    /* Timetable / Substitution specific */
    html.ee-dark .hasChange {
        border-color: #fab387 !important;
    }
  `;
}

function ensureStylesheet() {
  if (document.getElementById(STYLE_ID)) {
    document.getElementById(STYLE_ID).textContent = buildDarkCSS();
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = buildDarkCSS();
  (document.head || document.documentElement).appendChild(style);
}

function applyDarkMode(enabled) {
  if (enabled) {
    ensureStylesheet();
    document.documentElement.classList.add(CLASS_NAME);
  } else {
    document.documentElement.classList.remove(CLASS_NAME);
  }
}

chrome.storage.local.get(STORAGE_KEY, (result) => {
  const enabled = result[STORAGE_KEY] !== false;
  applyDarkMode(enabled);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === "ee-set-dark-mode") {
    applyDarkMode(message.enabled);
  }
});