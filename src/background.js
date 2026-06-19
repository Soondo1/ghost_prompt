// src/background.js
// Service worker for Prompt Ghost extension (Manifest V3)

const BASE_URL = 'https://ghost-prompt.vercel.app';

chrome.runtime.onInstalled.addListener(() => {
  // Set default settings
  chrome.storage.sync.set({ enabled: true, optimizationLevel: 'concise' }, () => {
    console.log('Prompt Ghost defaults set');
  });
});

async function getAuthToken() {
  const data = await chrome.storage.local.get('access_token');
  return data.access_token;
}

async function getRefreshToken() {
  const data = await chrome.storage.local.get('refresh_token');
  return data.refresh_token;
}

async function saveSession(accessToken, refreshToken, user) {
  await chrome.storage.local.set({
    access_token: accessToken,
    refresh_token: refreshToken,
    user: user
  });
}

async function clearSession() {
  await chrome.storage.local.remove(['access_token', 'refresh_token', 'user']);
}

async function refreshAccessToken() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.access_token && data.refresh_token) {
        await saveSession(data.access_token, data.refresh_token, data.user);
        return data.access_token;
      }
    }
  } catch (err) {
    console.error('Failed to refresh token:', err);
  }

  // If refresh failed, sign the user out
  await clearSession();
  return null;
}

async function fetchWithAuth(url, options = {}) {
  let token = await getAuthToken();
  if (!options.headers) options.headers = {};
  options.headers['Content-Type'] = 'application/json';
  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(url, options);
  
  if (res.status === 401) {
    // Attempt token refresh
    token = await refreshAccessToken();
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
      res = await fetch(url, options);
    }
  }

  return res;
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.action === 'fetchSuggestion') {
        const res = await fetchWithAuth(`${BASE_URL}/optimize`, {
          method: 'POST',
          body: JSON.stringify({ prompt: message.prompt, level: message.level })
        });
        if (res.status === 401) {
          sendResponse({ success: false, error: 'Unauthorized' });
        } else if (res.status === 429) {
          sendResponse({ success: false, error: 'Rate limit exceeded' });
        } else if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          sendResponse({ success: false, error: data.error || 'Server error' });
        } else {
          const data = await res.json();
          sendResponse({ success: true, data });
        }
      } 
      else if (message.action === 'transformText') {
        const res = await fetchWithAuth(`${BASE_URL}/transform`, {
          method: 'POST',
          body: JSON.stringify({ prompt: message.prompt })
        });
        if (res.status === 401) {
          sendResponse({ success: false, error: 'Unauthorized' });
        } else if (res.status === 429) {
          sendResponse({ success: false, error: 'Rate limit exceeded' });
        } else if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          sendResponse({ success: false, error: data.error || 'Server error' });
        } else {
          const data = await res.json();
          sendResponse({ success: true, data });
        }
      }
      else if (message.action === 'signup') {
        const res = await fetch(`${BASE_URL}/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: message.email, password: message.password })
        });
        const data = await res.json();
        if (res.ok) {
          if (data.access_token) {
            await saveSession(data.access_token, data.refresh_token, data.user);
          }
          sendResponse({ success: true, user: data.user, message: data.message });
        } else {
          sendResponse({ success: false, error: data.error || 'Signup failed' });
        }
      }
      else if (message.action === 'login') {
        const res = await fetch(`${BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: message.email, password: message.password })
        });
        const data = await res.json();
        if (res.ok) {
          await saveSession(data.access_token, data.refresh_token, data.user);
          sendResponse({ success: true, user: data.user });
        } else {
          sendResponse({ success: false, error: data.error || 'Login failed' });
        }
      }
      else if (message.action === 'logout') {
        await clearSession();
        sendResponse({ success: true });
      }
      else if (message.action === 'getAuthState') {
        const token = await getAuthToken();
        const storageData = await chrome.storage.local.get('user');
        sendResponse({ loggedIn: !!token, user: storageData.user || null });
      }
      else if (message.action === 'getHistory') {
        const page = message.page || 1;
        const limit = message.limit || 20;
        const res = await fetchWithAuth(`${BASE_URL}/history?page=${page}&limit=${limit}`, {
          method: 'GET'
        });
        if (res.ok) {
          const data = await res.json();
          sendResponse({ success: true, data });
        } else {
          const data = await res.json().catch(() => ({}));
          sendResponse({ success: false, error: data.error || 'Failed to fetch history' });
        }
      }
      else if (message.action === 'getUsage') {
        const days = message.days || 30;
        const res = await fetchWithAuth(`${BASE_URL}/usage?days=${days}`, {
          method: 'GET'
        });
        if (res.ok) {
          const data = await res.json();
          sendResponse({ success: true, data });
        } else {
          const data = await res.json().catch(() => ({}));
          sendResponse({ success: false, error: data.error || 'Failed to fetch usage' });
        }
      }
      else if (message.action === 'reportAcceptance') {
        const res = await fetchWithAuth(`${BASE_URL}/history/accept`, {
          method: 'POST',
          body: JSON.stringify({ id: message.historyId })
        });
        if (res.ok) {
          sendResponse({ success: true });
        } else {
          const data = await res.json().catch(() => ({}));
          sendResponse({ success: false, error: data.error || 'Failed to report acceptance' });
        }
      }
    } catch (err) {
      console.error('Background message handler error:', err);
      sendResponse({ success: false, error: err.message });
    }
  })();

  return true; // Keep message channel open for async response
});
