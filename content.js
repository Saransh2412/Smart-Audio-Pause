const fullUrl = window.location.href;

let currentVideo = null;
let isActive = false;
let pausedByExtension = false;
let observer = null;
let urlObserver = null;
let lastHandledUrl = window.location.href;

// Function to attach to a video element
function attachToVideo(video) {
  if (currentVideo === video) return;
  currentVideo = video;
  console.log("Video element attached:", video);

  document.removeEventListener("visibilitychange", handleVisibilityChange);
  document.addEventListener("visibilitychange", handleVisibilityChange);
}

// Handle visibility changes (tab switching)
function handleVisibilityChange() {
  if (!currentVideo) return;

  if (document.hidden) {
    if (!currentVideo.paused) {
      pausedByExtension = true; // Mark that we paused it
      currentVideo.pause();
    }
  } else {
    if (currentVideo.paused && pausedByExtension) {
      currentVideo.play().catch(() => {});
    }
    pausedByExtension = false; // Reset the flag
  }
}

// Initialize auto-pause when the feature is enabled
function initAutoPause() {
  if (isActive) return;
  isActive = true;
  console.log("Auto-pause initialized for URL:", window.location.href);

  // Watch for dynamically added videos
  if (observer) {
    observer.disconnect();
  }
  
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const nodes = Array.from(mutation.addedNodes);
      for (const node of nodes) {
        if (node.nodeName === 'VIDEO') {
          attachToVideo(node);
        } else if (node.getElementsByTagName) {
          const videos = node.getElementsByTagName('video');
          if (videos.length > 0) {
            attachToVideo(videos[0]);
          }
        }
      }
    }
  });

  observer.observe(document.documentElement || document.body, { 
    childList: true, 
    subtree: true 
  });

  // Check for existing videos
  checkForVideos();
  
  // Setup URL observer for SPAs like YouTube
  setupUrlObserver();
}

// Watch for URL changes in single-page applications
function setupUrlObserver() {
  if (urlObserver) return;
  
  // Create an observer instance to monitor URL changes
  urlObserver = new MutationObserver(() => {
    if (window.location.href !== lastHandledUrl) {
      console.log("URL changed from", lastHandledUrl, "to", window.location.href);
      lastHandledUrl = window.location.href;
      
      // Give the page time to update its content
      setTimeout(() => {
        checkForVideos();
      }, 1000);
    }
  });
  
  // Start observing
  urlObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Also listen for history changes (pushState/replaceState)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function() {
    originalPushState.apply(this, arguments);
    onUrlChange();
  };
  
  history.replaceState = function() {
    originalReplaceState.apply(this, arguments);
    onUrlChange();
  };
  
  window.addEventListener('popstate', onUrlChange);
  
  function onUrlChange() {
    if (window.location.href !== lastHandledUrl) {
      console.log("History change from", lastHandledUrl, "to", window.location.href);
      lastHandledUrl = window.location.href;
      setTimeout(() => {
        checkForVideos();
      }, 1000);
    }
  }
}

// Actively check for videos on the page
function checkForVideos() {
  const videos = document.querySelectorAll("video");
  if (videos.length > 0) {
    attachToVideo(videos[0]);
    return true;
  }
  
  // If no video found immediately, keep checking for a short while
  let attempts = 0;
  const interval = setInterval(() => {
    const videos = document.querySelectorAll("video");
    if (videos.length > 0) {
      attachToVideo(videos[0]);
      clearInterval(interval);
      return;
    }
    
    if (attempts >= 10) {
      clearInterval(interval);
    }
    attempts++;
  }, 500);
  
  return false;
}

// Cleanup auto-pause functionality
function cleanupAutoPause() {
  if (!isActive) return;
  
  isActive = false;
  
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  
  if (urlObserver) {
    urlObserver.disconnect();
    urlObserver = null;
  }
  
  if (currentVideo) {
    pausedByExtension = false;
  }
  
  currentVideo = null;
  document.removeEventListener("visibilitychange", handleVisibilityChange);
}

// Check if we should enable for this URL
function checkCurrentUrl() {
  const currentUrl = window.location.href;
  
  chrome.storage.sync.get([currentUrl], (result) => {
    const isUrlEnabled = result[currentUrl] === true;
    
    if (isUrlEnabled && !isActive) {
      initAutoPause();
    } else if (!isUrlEnabled && isActive) {
      cleanupAutoPause();
    }
  });
}

// Listen for popup setting changes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "settingsUpdated") {
    checkCurrentUrl();
    sendResponse({ success: true, status: isActive });
    return true;
  }
  
  if (message.action === "checkStatus") {
    sendResponse({ active: isActive, url: window.location.href });
    return true;
  }
});

// Initial setup
function initialize() {
  checkCurrentUrl();
  
  // Check periodically for videos that might load after a delay
  setTimeout(checkForVideos, 2000);
  setTimeout(checkForVideos, 5000);
}

// Start as soon as possible
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}