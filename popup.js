const urlToggle = document.getElementById("urlToggle");
const domainText = document.getElementById("domainName");

let currentUrl = "";

// Load current tab info and sync toggle state
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs || !tabs.length) return;

  try {
    const url = new URL(tabs[0].url);
    currentUrl = url.href;
    domainText.textContent = currentUrl;

    chrome.storage.sync.get([currentUrl], (result) => {
      urlToggle.checked = result[currentUrl] === true;
    });
  } catch (e) {
    domainText.textContent = "Invalid or internal page";
    urlToggle.disabled = true;
  }
});

// Save setting and notify content script
urlToggle.addEventListener("change", () => {
  chrome.storage.sync.set({ [currentUrl]: urlToggle.checked }, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "settingsUpdated" });
      }
    });
  });
});
