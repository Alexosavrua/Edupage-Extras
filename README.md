# Edupage Extras

A Chromium/Chrome **Manifest V3** browser extension that enhances the [Edupage](https://edupage.org) school portal with quality-of-life improvements injected directly into Edupage's existing UI.

## Features

| Feature | Where | What it does |
|---------|-------|-------------|
| 🌙 **Dark Mode** | All pages | Full-page dark mode toggle via the popup |
| 📊 **Grade Average Bars** | `/znamky/` grades page | Adds a color-coded bar and badge to each subject's average cell in the existing table |
| 🏆 **Overall Average** | `/znamky/` grades page | Appends a summary row at the bottom with the weighted average across all subjects |

## How It Works

Everything is injected **into Edupage's existing DOM** — no overlay, no shadow DOM, no separate panel. The extension reads what Edupage already renders on the page and enhances it in-place.

### Grades Enhancement (`scripts/grades-enhancer.js`)

On the `/znamky/` page, Edupage renders a `table.znamkyTable` with a `tr.predmetRow` per subject and a `.znPriemerCell` cell containing the computed average. The enhancer:

1. Reads each `.znPriemerCell` text value (e.g. `"2.13"`)
2. Replaces it with a color-coded badge + progress bar (still using Edupage's own computed value)
3. Appends a summary `tr.ee-overall-row` at the end of the table with the average of all subject averages

Colors: green `≤1.5` → lime `≤2.5` → amber `≤3.5` → orange `≤4.5` → red `≤5`.

### Dark Mode (`scripts/content.js`)

On all Edupage pages, applies a `ee-dark` class to `<html>` and uses CSS `!important` overrides to invert background/foreground colors.

## Project Structure

```
Edupage-Extras/
├── manifest.json              # MV3 extension manifest
├── menu/                      # Extension popup
│   ├── menu.html
│   ├── menu.css
│   └── menu.js
├── scripts/
│   ├── content.js             # Dark mode content script
│   └── grades-enhancer.js     # Grade table DOM enhancer (runs on /znamky/ only)
├── images/
│   └── placeholder_icon.png
└── src/                       # Vite/React source (WIP, not loaded by extension)
```

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer Mode** (top right)
3. Click **Load unpacked** → select the **project root** (`Edupage-Extras/`)
4. Navigate to `https://*.edupage.org/znamky/` to see the grade enhancements

## Notes

- No backend, no external requests, no credentials
- Grades are read from the existing rendered DOM — no JS globals parsing needed for this feature
- The extension only requests `storage` and `tabs` permissions (for dark mode persistence)

## License

ISC
