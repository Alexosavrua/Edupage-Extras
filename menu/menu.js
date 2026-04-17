const toggle = document.getElementById("DarkModeCheckbox");
const STORAGE_KEY = "darkModeEnabled";

// Default to true if not set
chrome.storage.local.get(STORAGE_KEY, (result) => {
	const enabled = result[STORAGE_KEY] !== false; // If undefined, it's true
	toggle.checked = enabled;
});

toggle.addEventListener("change", () => {
	const enabled = toggle.checked;
	chrome.storage.local.set({ [STORAGE_KEY]: enabled });

	chrome.tabs.query({ url: "*://*.edupage.org/*" }, (tabs) => {
		tabs.forEach(tab => {
			if (tab.id) {
				chrome.tabs.sendMessage(tab.id, { type: "ee-set-dark-mode", enabled });
			}
		});
	});
});
