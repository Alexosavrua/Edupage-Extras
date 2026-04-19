const backButton = document.getElementById("BackButton");
const resetButton = document.getElementById("ResetActivityShieldButton");
const reloadTabsButton = document.getElementById("ReloadEdupageTabsButton");
const saveStatus = document.getElementById("SaveStatus");
const THEME_KEY = "themeMode";
const DARK_MODE_KEY = "darkModeEnabled";
const THEMES = ["dark", "ocean", "forest", "emerald", "pink", "purple", "light"];

const settings = [
	["ActivityShieldEnabled", "eeActivityShieldEnabled"],
	["ActivityVisibilityState", "eeActivityShieldVisibilityState"],
	["ActivityHidden", "eeActivityShieldHidden"],
	["ActivityVisibilityEvents", "eeActivityShieldVisibilityEvents"],
	["ActivityFocus", "eeActivityShieldFocus"],
	["ActivityBlur", "eeActivityShieldBlur"],
	["ActivityRedirect", "eeActivityShieldRedirect"],
	["ActivityMouseleave", "eeActivityShieldMouseleave"],
	["ActivityMouseout", "eeActivityShieldMouseout"],
	["ActivityPointercapture", "eeActivityShieldPointercapture"],
	["ActivityClipboard", "eeActivityShieldClipboard"],
	["ActivityAnimationFrame", "eeActivityShieldAnimationFrame"],
	["ActivityVisualIndicator", "eeActivityShieldVisualIndicator"],
	["ActivityLog", "eeActivityShieldLog"],
];

const defaults = {
	eeActivityShieldEnabled: false,
	eeActivityShieldVisibilityState: true,
	eeActivityShieldHidden: true,
	eeActivityShieldVisibilityEvents: true,
	eeActivityShieldFocus: true,
	eeActivityShieldBlur: true,
	eeActivityShieldRedirect: true,
	eeActivityShieldMouseleave: true,
	eeActivityShieldMouseout: true,
	eeActivityShieldPointercapture: true,
	eeActivityShieldClipboard: true,
	eeActivityShieldAnimationFrame: true,
	eeActivityShieldVisualIndicator: true,
	eeActivityShieldLog: false,
};

const storageKeys = Object.keys(defaults);
const controlledSettings = settings.filter(([elementId]) => elementId !== "ActivityShieldEnabled");

function normalizeTheme(theme) {
	return THEMES.includes(theme) ? theme : "dark";
}

function applyExperimentalTheme(theme, darkModeEnabled = true) {
	document.documentElement.dataset.theme = darkModeEnabled ? normalizeTheme(theme) : "light";
}

backButton.addEventListener("click", () => {
	window.location.href = "settings.html";
});

function setStatus(message, isError = false) {
	saveStatus.textContent = message;
	saveStatus.style.color = isError ? "var(--danger-color)" : "var(--accent-color)";
	window.clearTimeout(setStatus.timer);
	setStatus.timer = window.setTimeout(() => {
		saveStatus.textContent = "";
	}, 2200);
}

function render(result) {
	settings.forEach(([elementId, key]) => {
		const element = document.getElementById(elementId);
		if (element) {
			element.checked = result[key];
		}
	});
	updateDependentControls();
}

function updateDependentControls() {
	const enabled = document.getElementById("ActivityShieldEnabled")?.checked === true;
	controlledSettings.forEach(([elementId]) => {
		const element = document.getElementById(elementId);
		if (element) {
			element.disabled = !enabled;
		}
	});
}

function saveCheckbox(elementId, key) {
	const element = document.getElementById(elementId);
	if (!element) return;

	element.addEventListener("change", () => {
		chrome.storage.local.set({ [key]: element.checked }, () => {
			if (elementId === "ActivityShieldEnabled") {
				updateDependentControls();
			}
			setStatus("Saved");
		});
	});
}

settings.forEach(([elementId, key]) => saveCheckbox(elementId, key));

resetButton.addEventListener("click", () => {
	chrome.storage.local.remove("eeActivityShieldPolicies", () => {
		chrome.storage.local.set(defaults, () => {
			render(defaults);
			setStatus("Reset");
		});
	});
});

reloadTabsButton.addEventListener("click", () => {
	chrome.tabs.query({ url: "*://*.edupage.org/*" }, (tabs) => {
		tabs.forEach((tab) => {
			if (tab.id) {
				chrome.tabs.reload(tab.id);
			}
		});
		setStatus(tabs.length ? "Edupage tabs reloaded" : "No Edupage tabs open");
	});
});

chrome.storage.local.get(defaults, render);
chrome.storage.local.get([THEME_KEY, DARK_MODE_KEY], (result) => {
	applyExperimentalTheme(result[THEME_KEY], result[DARK_MODE_KEY] !== false);
});

chrome.storage.onChanged.addListener((changes, area) => {
	if (area !== "local") return;
	if (changes[THEME_KEY] || changes[DARK_MODE_KEY]) {
		chrome.storage.local.get([THEME_KEY, DARK_MODE_KEY], (result) => {
			applyExperimentalTheme(result[THEME_KEY], result[DARK_MODE_KEY] !== false);
		});
	}
	if (storageKeys.some((key) => changes[key])) {
		chrome.storage.local.get(defaults, render);
	}
});
