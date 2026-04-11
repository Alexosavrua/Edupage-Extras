const toggle = document.getElementById("DarkModeCheckbox");
const STORAGE_KEY = "darkModeEnabled";

chrome.storage.local.get(STORAGE_KEY, (result) => {
	toggle.checked = Boolean(result[STORAGE_KEY]);
});

toggle.addEventListener("change", () => {
	const enabled = toggle.checked;
	chrome.storage.local.set({ [STORAGE_KEY]: enabled });

	chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		const activeTab = tabs[0];
		if (!activeTab || activeTab.id === undefined) {
			return;
		}

		if (!activeTab.url || !activeTab.url.includes(".edupage.org")) {
			return;
		}

		chrome.tabs.sendMessage(activeTab.id, { type: "ee-set-dark-mode", enabled });
	});
});
