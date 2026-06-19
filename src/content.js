// src/content.js
// Content script for Prompt Ghost Chrome Extension
// Detects textareas/contenteditable elements, shows AI ghost suggestion, handles Tab key.

(() => {
  const DEBOUNCE_DELAY = 800; // ms
  let debounceTimer = null;
  let currentTarget = null;
  let suggestion = '';
  let ghostDiv = null;
  let optimizationLevel = 'concise';
  let resizeObserver = null;
  let lastPromptFetched = '';
  let currentSuggestionId = null;

  // Guard: check if the extension runtime context is still valid.
  // When the extension is reloaded/updated, content scripts lose their
  // connection to the background service worker and chrome.runtime becomes
  // invalid. Any call to chrome.runtime.sendMessage will throw
  // "Extension context invalidated" if we don't check first.
  function isContextValid() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  try {
    chrome.storage.sync.get({ optimizationLevel: 'concise', enabled: true }, (data) => {
      optimizationLevel = data.optimizationLevel;
      if (!data.enabled) return;
      console.log('👻 Prompt Ghost successfully injected onto', window.location.hostname);
      initGlobalListeners();
    });
  } catch (e) {
    console.warn('👻 Prompt Ghost: Extension context not available, content script will not activate.', e.message);
    return;
  }

  function initGlobalListeners() {
    document.body.addEventListener('input', (e) => {
      const target = (e.composedPath && e.composedPath()[0]) || e.target;
      if (isInputField(target)) {
        onInput(target);
      } else {
        clearGhost();
      }
    }, true);

    document.body.addEventListener('keydown', (e) => {
      const target = (e.composedPath && e.composedPath()[0]) || e.target;
      if (isInputField(target)) {
        onKeyDown(e, target);
      }
    }, true);
    
    // Add scroll listener to update ghost text position
    document.addEventListener('scroll', updateGhostPosition, true);
  }

  function isInputField(el) {
    if (!el) return false;
    return el.tagName === 'TEXTAREA' || (el.isContentEditable && el.tagName !== 'BODY');
  }

  function getCurrentText(el) {
    if (el.tagName === 'TEXTAREA') return el.value;
    return el.innerText || el.textContent || '';
  }

  function onInput(target) {
    if (currentTarget !== target) {
      if (resizeObserver && currentTarget) {
         resizeObserver.disconnect();
      }
      currentTarget = target;
      resizeObserver = new ResizeObserver(() => updateGhostPosition());
      resizeObserver.observe(currentTarget);
    }

    const text = getCurrentText(target);
    clearTimeout(debounceTimer);
    
    if (!text.trim()) {
      clearGhost();
      return;
    }

    debounceTimer = setTimeout(() => generateSuggestion(text), DEBOUNCE_DELAY);
  }

  function generateSuggestion(text) {
    if (!isContextValid()) {
      clearGhost();
      return;
    }

    lastPromptFetched = text;
    currentSuggestionId = null;
    
    try {
      chrome.runtime.sendMessage(
        { action: 'fetchSuggestion', prompt: text, level: optimizationLevel },
        (response) => {
          if (chrome.runtime.lastError) {
            // Silently handle — context may have been invalidated between send and callback
            clearGhost();
            return;
          }
          
          if (response && response.success && response.data.optimized) {
            // Race condition check: Ensure the user hasn't typed more since the request
            const currentText = getCurrentText(currentTarget);
            if (currentText !== lastPromptFetched) {
              // Text has changed, ignore this suggestion
              return;
            }
            suggestion = response.data.optimized;
            currentSuggestionId = response.data.id;
            renderGhost(suggestion);
          } else {
            clearGhost();
          }
        }
      );
    } catch (e) {
      // Extension context invalidated — extension was reloaded/updated
      clearGhost();
    }
  }

  function renderGhost(text) {
    if (!currentTarget) return;
    
    if (!ghostDiv) {
      ghostDiv = document.createElement('div');
      ghostDiv.style.position = 'absolute';
      ghostDiv.style.pointerEvents = 'none';
      ghostDiv.style.color = 'rgba(150,150,150,0.6)';
      ghostDiv.style.whiteSpace = 'pre-wrap';
      ghostDiv.style.overflow = 'hidden';
      ghostDiv.style.zIndex = '2147483647';
      document.body.appendChild(ghostDiv);
    }

    updateGhostPosition();

    const currentValue = getCurrentText(currentTarget);
    const remaining = textAfterPrefix(currentValue, text);
    
    // Set the text content. We include the original text but make it invisible so the 
    // remaining text aligns properly with the trailing space of the original text.
    ghostDiv.innerHTML = `<span style="opacity: 0;">${escapeHTML(currentValue)}</span>${escapeHTML(remaining)}`;
  }
  
  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  }

  function updateGhostPosition() {
    if (!ghostDiv || !currentTarget) return;
    
    const rect = currentTarget.getBoundingClientRect();
    const style = window.getComputedStyle(currentTarget);
    
    ghostDiv.style.font = style.font;
    ghostDiv.style.fontSize = style.fontSize;
    ghostDiv.style.lineHeight = style.lineHeight;
    ghostDiv.style.padding = style.padding;
    ghostDiv.style.margin = style.margin;
    ghostDiv.style.border = style.border;
    ghostDiv.style.boxSizing = style.boxSizing;
    ghostDiv.style.textAlign = style.textAlign;
    
    // Account for scrolling within the element itself, and the page
    ghostDiv.style.left = `${rect.left + window.scrollX - currentTarget.scrollLeft}px`;
    ghostDiv.style.top = `${rect.top + window.scrollY - currentTarget.scrollTop}px`;
    ghostDiv.style.width = `${rect.width}px`;
    ghostDiv.style.height = `${rect.height}px`;
  }

  function textAfterPrefix(current, original) {
    if (original.startsWith(current)) return original.slice(current.length);
    return '';
  }

  function clearGhost() {
    if (ghostDiv) {
      ghostDiv.remove();
      ghostDiv = null;
    }
    suggestion = '';
    currentSuggestionId = null;
  }

  function onKeyDown(e, target) {
    if (e.key === 'Tab' && suggestion) {
      // Prevent default focus shifting
      e.preventDefault();
      applySuggestion(target);
    } else if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt') {
      // If pressing anything else that changes text while ghost is visible, clear it early
      // so it doesn't linger visually before input event fires
      clearGhost();
    }
  }

  function applySuggestion(target) {
    if (!target) return;
    const currentText = getCurrentText(target);
    const remaining = textAfterPrefix(currentText, suggestion);
    
    if (!remaining) {
      clearGhost();
      return;
    }

    target.focus();

    if (target.tagName === 'TEXTAREA') {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      nativeInputValueSetter.call(target, suggestion);
      target.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (target.isContentEditable) {
      // Instead of replacing all text, place the cursor at the end and insert the remaining text.
      // Move cursor to end of the content editable
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(target);
      range.collapse(false); // false means to the end
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Execute command to insert text properly into rich editors
      document.execCommand('insertText', false, remaining);
    }
    
    if (currentSuggestionId && isContextValid()) {
      try {
        chrome.runtime.sendMessage({ action: 'reportAcceptance', historyId: currentSuggestionId }, (res) => {
          if (chrome.runtime.lastError) {
            // Silently handle — context may have been invalidated
          }
        });
      } catch (e) {
        // Extension context invalidated — extension was reloaded/updated
      }
    }

    clearGhost();
  }
})();
