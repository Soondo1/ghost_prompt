// src/background.js
// Service worker for Prompt Ghost extension (Manifest V3)

chrome.runtime.onInstalled.addListener(() => {
  // Set default settings
  chrome.storage.sync.set({ enabled: true, optimizationLevel: 'concise' }, () => {
    console.log('Prompt Ghost defaults set');
  });
});

// Listen for messages from content script if needed in future
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Placeholder for future communication
  return true;
});
