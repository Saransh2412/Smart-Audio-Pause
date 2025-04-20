document.addEventListener('DOMContentLoaded', () => {
  const urlToggle = document.getElementById("urlToggle");
  const domainText = document.getElementById("domainName");
  const statusText = document.getElementById("status");
  
  let currentUrl = "";
  
  // Get current tab URL
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs.length) return;
    
    try {
      const url = new URL(tabs[0].url);
      
      if (!url.href.startsWith("http")) {
        domainText.textContent = "Not available on this page";
        urlToggle.disabled = true;
        statusText.textContent = "Inactive";
        return;
      }
      
      currentUrl = url.href;
      domainText.textContent = currentUrl;
      
      // Check current status and toggle state
      chrome.tabs.sendMessage(tabs[0].id, { action: "checkStatus" }, (response) => {
        if (chrome.runtime.lastError) {
          statusText.textContent = "Error: Extension not loaded";
          return;
        }
        
        // Load setting from storage
        chrome.storage.sync.get([currentUrl], (result) => {
          urlToggle.checked = result[currentUrl] === true;
          statusText.textContent = response.active ? "Active" : "Inactive";
        });
      });
      
    } catch (e) {
      domainText.textContent = "Invalid page";
      urlToggle.disabled = true;
      statusText.textContent = "Inactive";
    }
  });
  
  // Handle toggle changes
  urlToggle.addEventListener("change", () => {
    // Save setting
    chrome.storage.sync.set({ [currentUrl]: urlToggle.checked }, () => {
      // Notify content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(
          tabs[0].id, 
          { action: "settingsUpdated" },
          (response) => {
            if (chrome.runtime.lastError) {
              statusText.textContent = "Error: Please reload page";
            } else {
              statusText.textContent = response.status ? "Active" : "Inactive";
            }
          }
        );
      });
    });
  });
});document.addEventListener('DOMContentLoaded', () => {
  const urlToggle = document.getElementById("urlToggle");
  const domainText = document.getElementById("domainName");
  const statusText = document.getElementById("status");
  
  let currentUrl = "";
  
  // Get current tab URL
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs.length) return;
    
    try {
      const url = new URL(tabs[0].url);
      
      if (!url.href.startsWith("http")) {
        domainText.textContent = "Not available on this page";
        urlToggle.disabled = true;
        statusText.textContent = "Inactive";
        return;
      }
      
      currentUrl = url.href;
      domainText.textContent = currentUrl;
      
      // Check current status and toggle state
      chrome.tabs.sendMessage(tabs[0].id, { action: "checkStatus" }, (response) => {
        if (chrome.runtime.lastError) {
          statusText.textContent = "Error: Extension not loaded";
          
          // Try to inject content script
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content.js']
          })
          .then(() => {
            statusText.textContent = "Injected - Toggle to activate";
          })
          .catch(() => {
            statusText.textContent = "Could not inject script";
          });
          
          return;
        }
        
        // Load setting from storage
        chrome.storage.sync.get([currentUrl], (result) => {
          urlToggle.checked = result[currentUrl] === true;
          statusText.textContent = response.active ? "Active" : "Inactive";
        });
      });
      
    } catch (e) {
      domainText.textContent = "Invalid page";
      urlToggle.disabled = true;
      statusText.textContent = "Inactive";
    }
  });
  
  // Handle toggle changes
  urlToggle.addEventListener("change", () => {
    // Save setting
    chrome.storage.sync.set({ [currentUrl]: urlToggle.checked }, () => {
      // Notify content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(
          tabs[0].id, 
          { action: "settingsUpdated" },
          (response) => {
            if (chrome.runtime.lastError) {
              statusText.textContent = "Error: Please reload page";
            } else {
              statusText.textContent = response.status ? "Active" : "Inactive";
            }
          }
        );
      });
    });
  });
});