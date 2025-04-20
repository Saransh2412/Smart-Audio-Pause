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
  
  // Clean up previous video if exists
  if (currentVideo) {
    detachFromVideo();
  }
  
  currentVideo = video;
  console.log("Video element attached:", video);

  // Only attach event listener if feature is active
  if (isActive) {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }
}

// Detach from current video
function detachFromVideo() {
  if (!currentVideo) return;
  
  // Make sure we don't leave video paused when detaching
  if (pausedByExtension && currentVideo.paused) {
    currentVideo.play().catch(() => {});
  }
  
  pausedByExtension = false;
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  currentVideo = null;
}

// Handle visibility changes (tab switching)
function handleVisibilityChange() {
  if (!currentVideo || !isActive) return;

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
  
  // If video is already attached, add visibility listener
  if (currentVideo) {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }
}

// Watch for URL changes in single-page applications
function setupUrlObserver() {
  if (urlObserver) {
    urlObserver.disconnect();
    urlObserver = null;
  }
  
  // Create an observer instance to monitor URL changes
  urlObserver = new MutationObserver(() => {
    if (window.location.href !== lastHandledUrl) {
      console.log("URL changed from", lastHandledUrl, "to", window.location.href);
      lastHandledUrl = window.location.href;
      
      // Give the page time to update its content
      setTimeout(() => {
        if (isActive) {
          checkForVideos();
        }
      }, 1000);
    }
  });
  
  // Start observing
  urlObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Also listen for history changes (pushState/replaceState)
  if (!window.autopauseOriginalPushState) {
    window.autopauseOriginalPushState = history.pushState;
    history.pushState = function() {
      window.autopauseOriginalPushState.apply(this, arguments);
      if (isActive) onUrlChange();
    };
  }
  
  if (!window.autopauseOriginalReplaceState) {
    window.autopauseOriginalReplaceState = history.replaceState;
    history.replaceState = function() {
      window.autopauseOriginalReplaceState.apply(this, arguments);
      if (isActive) onUrlChange();
    };
  }
  
  window.addEventListener('popstate', onUrlChange);
  
  function onUrlChange() {
    if (window.location.href !== lastHandledUrl && isActive) {
      console.log("History change from", lastHandledUrl, "to", window.location.href);
      lastHandledUrl = window.location.href;
      setTimeout(() => {
        checkForVideos();
      }, 1000);
    }
  }
}

// Cleanup history methods
function cleanupHistoryMethods() {
  if (window.autopauseOriginalPushState) {
    history.pushState = window.autopauseOriginalPushState;
    window.autopauseOriginalPushState = null;
  }
  
  if (window.autopauseOriginalReplaceState) {
    history.replaceState = window.autopauseOriginalReplaceState;
    window.autopauseOriginalReplaceState = null;
  }
  
  window.removeEventListener('popstate', onUrlChange);
}

// Actively check for videos on the page
function checkForVideos() {
  if (!isActive) return false;
  
  const videos = document.querySelectorAll("video");
  if (videos.length > 0) {
    attachToVideo(videos[0]);
    return true;
  }
  
  // If no video found immediately, keep checking for a short while
  let attempts = 0;
  const interval = setInterval(() => {
    if (!isActive) {
      clearInterval(interval);
      return;
    }
    
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
  console.log("Auto-pause disabled for URL:", window.location.href);
  
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  
  if (urlObserver) {
    urlObserver.disconnect();
    urlObserver = null;
  }
  
  // Clean up history method overrides
  cleanupHistoryMethods();
  
  // Detach from video
  detachFromVideo();
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
  // Only if feature is active
  setTimeout(() => {
    if (isActive) checkForVideos();
  }, 2000);
  
  setTimeout(() => {
    if (isActive) checkForVideos();
  }, 5000);
}

// Start as soon as possible
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}