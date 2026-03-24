// src/content.js
// Content script for Prompt Ghost Chrome Extension
// Detects textareas/contenteditable elements, shows AI ghost suggestion, handles Tab key.

(() => {
  const DEBOUNCE_DELAY = 800; // ms
  let debounceTimer = null;
  let currentTarget = null;
  let suggestion = '';
  let ghostDiv = null;
  let optimizationLevel = 'concise'; // default, can be set via storage

  // Load settings from chrome.storage
  chrome.storage.sync.get({ optimizationLevel: 'concise', enabled: true }, (data) => {
    optimizationLevel = data.optimizationLevel;
    if (!data.enabled) return; // feature disabled
    console.log('👻 Prompt Ghost successfully injected onto', window.location.hostname);
    initGlobalListeners();
  });

  function initGlobalListeners() {
    // Delegated event listeners grab input events from any field that exists or is added dynamically.
    document.body.addEventListener('input', (e) => {
      if (isInputField(e.target)) {
        onInput(e);
      }
    }, true);

    document.body.addEventListener('keydown', (e) => {
      if (isInputField(e.target)) {
        onKeyDown(e);
      }
    }, true);
  }

  function isInputField(el) {
    return el && (el.tagName === 'TEXTAREA' || el.isContentEditable);
  }

  function onInput(e) {
    const target = e.target;
    currentTarget = target;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => generateSuggestion(target.value), DEBOUNCE_DELAY);
  }

  // API Endpoints
  const API_URL = 'https://ghost-prompt.vercel.app/optimize';

  async function generateSuggestion(text) {
    if (!text.trim()) {
      clearGhost();
      return;
    }
    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, level: optimizationLevel })
      });
      const data = await resp.json();
      suggestion = data.optimized || '';
      if (suggestion) renderGhost(suggestion);
      else clearGhost();
    } catch (err) {
      console.error('Prompt Ghost error:', err);
      clearGhost();
    }
  }

  function renderGhost(text) {
    if (!currentTarget) return;
    const rect = currentTarget.getBoundingClientRect();
    if (!ghostDiv) {
      ghostDiv = document.createElement('div');
      ghostDiv.style.position = 'absolute';
      ghostDiv.style.pointerEvents = 'none';
      ghostDiv.style.color = 'rgba(150,150,150,0.6)';
      ghostDiv.style.whiteSpace = 'pre-wrap';
      ghostDiv.style.overflow = 'hidden';
      ghostDiv.style.zIndex = '2147483647'; // topmost
      document.body.appendChild(ghostDiv);
    }
    // Copy font styles
    const style = window.getComputedStyle(currentTarget);
    ghostDiv.style.font = style.font;
    ghostDiv.style.fontSize = style.fontSize;
    ghostDiv.style.lineHeight = style.lineHeight;
    ghostDiv.style.padding = style.padding;
    ghostDiv.style.margin = style.margin;
    ghostDiv.style.border = style.border;
    ghostDiv.style.boxSizing = style.boxSizing;
    ghostDiv.style.left = `${rect.left + window.scrollX}px`;
    ghostDiv.style.top = `${rect.top + window.scrollY}px`;
    ghostDiv.style.width = `${rect.width}px`;
    ghostDiv.style.height = `${rect.height}px`;
    // Show suggestion with same leading text as current input
    const currentValue = currentTarget.value || currentTarget.innerText || '';
    const remaining = textAfterPrefix(currentValue, text);
    ghostDiv.textContent = currentValue + remaining;
  }

  function textAfterPrefix(current, original) {
    // simple diff: return the part of original that is not yet typed
    if (original.startsWith(current)) return original.slice(current.length);
    return '';
  }

  function clearGhost() {
    if (ghostDiv) {
      ghostDiv.remove();
      ghostDiv = null;
    }
    suggestion = '';
  }

  function onKeyDown(e) {
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault();
      applySuggestion();
    }
  }

  function applySuggestion() {
    if (!currentTarget) return;
    if (currentTarget.tagName === 'TEXTAREA') {
      currentTarget.value = suggestion;
    } else if (currentTarget.isContentEditable) {
      currentTarget.innerText = suggestion;
    }
    clearGhost();
  }
})();
