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
    initObserver();
  });

  function initObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const el = node;
          if (isInputField(el)) attachField(el);
          // also check descendants
          el.querySelectorAll('textarea, [contenteditable="true"]').forEach(attachField);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // Attach to existing fields on load
    document.querySelectorAll('textarea, [contenteditable="true"]').forEach(attachField);
  }

  function isInputField(el) {
    return el.tagName === 'TEXTAREA' || (el.isContentEditable && el.getAttribute('contenteditable') === 'true');
  }

  function attachField(el) {
    if (el.__ghostAttached) return;
    el.__ghostAttached = true;
    el.addEventListener('input', onInput);
    el.addEventListener('keydown', onKeyDown);
  }

  function onInput(e) {
    const target = e.target;
    currentTarget = target;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => generateSuggestion(target.value), DEBOUNCE_DELAY);
  }

  // API Endpoints
  const API_URL = 'http://localhost:3000/optimize'; // Change to: 'https://ghost-prompt.vercel.app/optimize' after deploying to form Vercel
  
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
