// src/background.js
// Service worker for Prompt Ghost extension (Manifest V3)

chrome.runtime.onInstalled.addListener(() => {
  // Set default settings
  chrome.storage.sync.set({ enabled: true, optimizationLevel: 'concise' }, () => {
    console.log('Prompt Ghost defaults set');
  });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fetchSuggestion') {
    const API_URL = 'https://ghost-prompt.vercel.app/optimize';
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: message.prompt, level: message.level })
    })
      .then(res => res.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Keep message channel open for async response
  }
});
