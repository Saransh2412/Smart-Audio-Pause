const fullUrl = window.location.href;

let currentVideo = null;
let isActive = false;
let pausedByExtension = false;
let observer = null; // Track observer globally

function attachToVideo(video) {
  if (currentVideo === video) return;

  detachFromVideo(); // Clean any existing
  currentVideo = video;

  document.addEventListener("visibilitychange", handleVisibilityChange);
}

function detachFromVideo() {
  if (currentVideo) {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    currentVideo = null;
  }
}

function handleVisibilityChange() {
  if (!currentVideo) return;

  if (document.hidden) {
    if (!currentVideo.paused) {
      pausedByExtension = true;
      currentVideo.pause();
    }
  } else {
    if (currentVideo.paused && pausedByExtension) {
      currentVideo.play().catch(() => {});
    }
    pausedByExtension = false;
  }
}

function initAutoPause() {
  if (isActive) return;
  isActive = true;

  observer = new MutationObserver(() => {
    const video = document.querySelector("video");
    if (video) attachToVideo(video);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  const initialVideo = document.querySelector("video");
  if (initialVideo) attachToVideo(initialVideo);
}

function cleanupAutoPause() {
  isActive = false;
  pausedByExtension = false;

  if (observer) {
    observer.disconnect();  // 🧹 Stop observing new videos
    observer = null;
  }

  detachFromVideo();  // 🧹 Remove event listener
}

function checkAndTogglePause() {
  chrome.storage.sync.get([fullUrl], (result) => {
    if (result[fullUrl]) {
      initAutoPause();
    } else {
      cleanupAutoPause();
    }
  });
}

checkAndTogglePause();

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "settingsUpdated") {
    checkAndTogglePause();
  }
});
