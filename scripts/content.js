const STORAGE_KEY = "darkModeEnabled";
const STYLE_ID = "edupage-extras-dark-mode";

function ensureDarkModeStyles() {
	if (document.getElementById(STYLE_ID)) {
		return;
	}

	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = `
		html.ee-dark,
		html.ee-dark body {
			background: #111 !important;
			color: #e7e7e7 !important;
		}

		html.ee-dark div,
		html.ee-dark section,
		html.ee-dark main,
		html.ee-dark article,
		html.ee-dark aside,
		html.ee-dark header,
		html.ee-dark footer,
		html.ee-dark nav,
		html.ee-dark table,
		html.ee-dark tr,
		html.ee-dark th,
		html.ee-dark td,
		html.ee-dark ul,
		html.ee-dark li,
		html.ee-dark form,
		html.ee-dark input,
		html.ee-dark select,
		html.ee-dark textarea,
		html.ee-dark button {
			background-color: #1a1a1a !important;
			color: #e7e7e7 !important;
		}

		html.ee-dark * {
			border-color: #3b3b3b !important;
			box-shadow: none !important;
		}

		html.ee-dark a {
			color: #91c0ff !important;
		}

		html.ee-dark a:hover,
		html.ee-dark button:hover,
		html.ee-dark input:hover,
		html.ee-dark select:hover,
		html.ee-dark textarea:hover,
		html.ee-dark [role="button"]:hover,
		html.ee-dark [tabindex]:hover,
		html.ee-dark li.eb:hover,
		html.ee-dark a:focus,
		html.ee-dark button:focus,
		html.ee-dark input:focus,
		html.ee-dark select:focus,
		html.ee-dark textarea:focus,
		html.ee-dark [role="button"]:focus,
		html.ee-dark [tabindex]:focus,
		html.ee-dark li.eb:focus,
		html.ee-dark a:focus-visible,
		html.ee-dark button:focus-visible,
		html.ee-dark input:focus-visible,
		html.ee-dark select:focus-visible,
		html.ee-dark textarea:focus-visible,
		html.ee-dark [role="button"]:focus-visible,
		html.ee-dark [tabindex]:focus-visible,
		html.ee-dark li.eb:focus-visible,
		html.ee-dark a:active,
		html.ee-dark button:active,
		html.ee-dark input:active,
		html.ee-dark select:active,
		html.ee-dark textarea:active,
		html.ee-dark [role="button"]:active,
		html.ee-dark [tabindex]:active,
		html.ee-dark li.eb:active {
			background-color: #1f1f1f !important;
			color: #e7e7e7 !important;
			border-color: #4a4a4a !important;
		}

		html.ee-dark a:hover,
		html.ee-dark a:focus,
		html.ee-dark a:active {
			color: #b3d3ff !important;
		}

		html.ee-dark li.eb,
		html.ee-dark li.eb * {
			background-color: #1a1a1a !important;
			color: #91c0ff !important;
		}

		html.ee-dark li.eb:hover,
		html.ee-dark li.eb:hover *,
		html.ee-dark li.eb:focus,
		html.ee-dark li.eb:focus *,
		html.ee-dark li.eb:focus-within,
		html.ee-dark li.eb:focus-within * {
			background-color: #1f1f1f !important;
			color: #b3d3ff !important;
		}
	`;

	(document.head || document.documentElement).appendChild(style);
}


function applyDarkMode(enabled) {
	ensureDarkModeStyles();
	document.documentElement.classList.toggle("ee-dark", Boolean(enabled));
}
chrome.storage.local.get(STORAGE_KEY, (result) => {
	applyDarkMode(result[STORAGE_KEY]);
});

chrome.runtime.onMessage.addListener((message) => {
	if (message && message.type === "ee-set-dark-mode") {
		applyDarkMode(message.enabled);
	}
});