// src/popup/App.jsx
import React, { useState, useEffect } from 'react';
import './index.css';

const App = () => {
  // Authentication state
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  // App UI state
  const [activeTab, setActiveTab] = useState('transform'); // 'transform', 'history', 'usage'
  const [inputText, setInputText] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [level, setLevel] = useState('concise');

  // History state
  const [historyItems, setHistoryItems] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPages, setHistoryPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Usage state
  const [dailyRemaining, setDailyRemaining] = useState(50);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [usageStats, setUsageStats] = useState([]);
  const [usageLoading, setUsageLoading] = useState(false);

  // Initial load: check auth state and extension settings
  useEffect(() => {
    chrome.runtime.sendMessage({ action: 'getAuthState' }, (response) => {
      if (response && response.loggedIn) {
        setUser(response.user);
      }
    });

    chrome.storage.sync.get({ enabled: true, optimizationLevel: 'concise' }, (data) => {
      setEnabled(data.enabled);
      setLevel(data.optimizationLevel);
    });
  }, []);

  // Fetch history or usage depending on tab selections
  useEffect(() => {
    if (user) {
      if (activeTab === 'history') {
        fetchHistory(historyPage);
      } else if (activeTab === 'usage') {
        fetchUsage();
      }
    }
  }, [activeTab, historyPage, user]);

  const fetchHistory = (page = 1) => {
    setHistoryLoading(true);
    chrome.runtime.sendMessage({ action: 'getHistory', page, limit: 3 }, (response) => {
      setHistoryLoading(false);
      if (response && response.success && response.data) {
        setHistoryItems(response.data.items);
        setHistoryPage(response.data.page);
        setHistoryPages(response.data.pages);
        setHistoryTotal(response.data.total);
      } else {
        console.error('Failed to fetch history:', response?.error);
      }
    });
  };

  const fetchUsage = () => {
    setUsageLoading(true);
    chrome.runtime.sendMessage({ action: 'getUsage', days: 7 }, (response) => {
      setUsageLoading(false);
      if (response && response.success && response.data) {
        setDailyRemaining(response.data.daily_remaining);
        setDailyLimit(response.data.daily_limit);
        setUsageStats(response.data.stats);
      } else {
        console.error('Failed to fetch usage:', response?.error);
      }
    });
  };

  const toggleEnabled = () => {
    const newVal = !enabled;
    setEnabled(newVal);
    chrome.storage.sync.set({ enabled: newVal });
  };

  const handleLevelChange = (e) => {
    const newLevel = e.target.value;
    setLevel(newLevel);
    chrome.storage.sync.set({ optimizationLevel: newLevel });
  };

  const handleAuth = (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setAuthLoading(true);
    setAuthError('');
    setAuthMessage('');

    const action = authMode === 'login' ? 'login' : 'signup';
    chrome.runtime.sendMessage({ action, email, password }, (response) => {
      setAuthLoading(false);
      if (chrome.runtime.lastError) {
        setAuthError('Connection to background service worker failed.');
        return;
      }
      if (response && response.success) {
        if (action === 'signup' && response.message) {
          setAuthMessage(response.message);
        } else {
          setUser(response.user);
          fetchUsage();
        }
      } else {
        setAuthError(response?.error || `${action === 'login' ? 'Login' : 'Signup'} failed.`);
      }
    });
  };

  const handleLogout = () => {
    chrome.runtime.sendMessage({ action: 'logout' }, (response) => {
      if (response && response.success) {
        setUser(null);
        setActiveTab('transform');
        setResults([]);
        setInputText('');
        setEmail('');
        setPassword('');
        setAuthError('');
        setAuthMessage('');
      }
    });
  };

  const handleTransform = () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setError('');
    
    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(
        { action: 'transformText', prompt: inputText },
        (response) => {
          setLoading(false);
          if (chrome.runtime.lastError) {
             setError('Failed to connect to extension.');
             return;
          }
          if (response && response.success && response.data.results) {
            setResults(response.data.results);
            fetchUsage(); // update usage count remaining
          } else {
            setError(response?.error || 'Failed to transform text. Maybe backend is down?');
          }
        }
      );
    } else {
      setLoading(false);
      setError('Extension environment not detected.');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  // If user is not logged in, show Login/Signup view
  if (!user) {
    return (
      <div className="p-5 w-[420px] bg-gray-900 text-white min-h-[420px] flex flex-col justify-center font-sans">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-500">
            Prompt Ghost 👻
          </h1>
          <p className="text-xs text-gray-400 mt-1">Unlock AI Prompt Optimization & History</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4 bg-gray-800/50 p-5 rounded-xl border border-gray-800 shadow-xl">
          <h2 className="text-lg font-bold text-center capitalize text-purple-300">
            {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>

          {authError && <div className="text-red-400 text-xs text-center bg-red-950/40 p-2.5 rounded-lg border border-red-900/50">{authError}</div>}
          {authMessage && <div className="text-green-400 text-xs text-center bg-green-950/40 p-2.5 rounded-lg border border-green-900/50">{authMessage}</div>}

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-lg font-bold shadow-lg transition-all text-sm"
          >
            {authLoading ? 'Signing in...' : authMode === 'login' ? 'Sign In' : 'Sign Up'}
          </button>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login');
                setAuthError('');
                setAuthMessage('');
              }}
              className="text-xs text-purple-400 hover:text-purple-300 underline focus:outline-none"
            >
              {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Authenticated Dashboard Layout
  return (
    <div className="p-5 w-[420px] bg-gray-900 text-white min-h-[450px] flex flex-col font-sans">
      {/* Header section */}
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-800">
        <div>
          <h1 className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-500">
            Prompt Ghost 👻
          </h1>
          <div className="text-[10px] text-gray-400 flex items-center space-x-1.5 mt-0.5">
            <span className="truncate max-w-[150px]">{user.email}</span>
            <span>•</span>
            <button onClick={handleLogout} className="text-red-400 hover:underline">Logout</button>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <label className="flex items-center space-x-1 cursor-pointer">
             <input
                type="checkbox"
                checked={enabled}
                onChange={toggleEnabled}
                className="w-4 h-4 rounded focus:ring-purple-500 accent-purple-500"
              />
              <span className="text-gray-300">Live</span>
          </label>
          <select
            value={level}
            onChange={handleLevelChange}
            className="bg-gray-800 text-gray-300 rounded border border-gray-700 px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs"
          >
            <option value="concise">Concise</option>
            <option value="detailed">Detailed</option>
          </select>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex bg-gray-850 rounded-lg p-1 mb-4 border border-gray-800 text-xs">
        <button
          onClick={() => setActiveTab('transform')}
          className={`flex-1 py-1.5 text-center font-medium rounded-md transition-all ${
            activeTab === 'transform' ? 'bg-gradient-to-r from-purple-600/70 to-blue-600/70 text-white shadow' : 'text-gray-400 hover:text-white'
          }`}
        >
          Transform
        </button>
        <button
          onClick={() => {
            setActiveTab('history');
            setHistoryPage(1);
          }}
          className={`flex-1 py-1.5 text-center font-medium rounded-md transition-all ${
            activeTab === 'history' ? 'bg-gradient-to-r from-purple-600/70 to-blue-600/70 text-white shadow' : 'text-gray-400 hover:text-white'
          }`}
        >
          History
        </button>
        <button
          onClick={() => setActiveTab('usage')}
          className={`flex-1 py-1.5 text-center font-medium rounded-md transition-all ${
            activeTab === 'usage' ? 'bg-gradient-to-r from-purple-600/70 to-blue-600/70 text-white shadow' : 'text-gray-400 hover:text-white'
          }`}
        >
          Usage
        </button>
      </div>

      {/* Content tabs */}
      <div className="flex-1 flex flex-col min-h-[300px]">
        {/* Transform tab */}
        {activeTab === 'transform' && (
          <div className="flex-1 flex flex-col">
            <p className="text-xs text-gray-300 mb-2 font-medium">
              Not seeing the ghost? Transform your thoughts manually:
            </p>

            <textarea
              className="w-full h-24 p-3 bg-gray-800 text-sm border border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none mb-3 resize-none shadow-inner text-white"
              placeholder="Type your rough idea here to get two highly-optimized AI prompts instantly..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />

            <button
              onClick={handleTransform}
              disabled={loading || !inputText.trim()}
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg font-bold shadow-lg disabled:opacity-50 transition-all duration-200 uppercase tracking-wider text-xs flex justify-center items-center"
            >
              {loading ? (
                 <span className="animate-pulse">✨ Generating Variations... ✨</span>
              ) : (
                 <span>✨ Transform Text ✨</span>
              )}
            </button>

            {error && <p className="text-red-400 text-xs mt-3 text-center bg-red-900/40 p-2 rounded">{error}</p>}

            {results.length > 0 && (
              <div className="w-full mt-4 space-y-3 pb-2 max-h-[160px] overflow-y-auto pr-1">
                {results.map((result, idx) => (
                  <div key={idx} className="bg-gray-800 border border-gray-700 p-3 rounded-lg relative group hover:border-gray-600 transition-colors">
                    <h3 className="text-[10px] text-purple-400 uppercase tracking-widest font-bold mb-1">
                      Option {idx + 1} {idx === 0 ? '(Concise)' : '(Detailed)'}
                    </h3>
                    <p className="text-xs text-gray-200 pr-6 break-words whitespace-pre-wrap leading-relaxed">{result}</p>
                    <button
                      onClick={() => copyToClipboard(result)}
                      className="absolute top-2.5 right-2.5 p-1 bg-gray-700 hover:bg-gray-600 rounded text-[10px] transition-colors"
                      title="Copy"
                    >
                      📋
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History tab */}
        {activeTab === 'history' && (
          <div className="flex-1 flex flex-col">
            <h2 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Optimization History ({historyTotal})</h2>
            
            {historyLoading ? (
              <div className="flex-1 flex justify-center items-center text-xs text-purple-300">
                <span className="animate-pulse">Loading history items...</span>
              </div>
            ) : historyItems.length === 0 ? (
              <div className="flex-1 flex justify-center items-center text-xs text-gray-500">
                No past prompt optimizations.
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between">
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {historyItems.map((item) => (
                    <div key={item.id} className="bg-gray-800/60 border border-gray-850 p-2.5 rounded-lg relative">
                      <div className="flex justify-between items-center text-[9px] text-gray-400 mb-1 border-b border-gray-700/30 pb-1 pr-6">
                        <span className="capitalize text-purple-300 font-semibold">{item.optimization_level || 'optimize'}</span>
                        <span>{new Date(item.created_at).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      
                      <div className="mb-1">
                        <p className="text-[10px] text-gray-400 font-medium truncate">Input: {item.original_prompt}</p>
                      </div>

                      <div>
                        {item.endpoint === 'transform' ? (
                          <div className="space-y-1">
                            {(() => {
                              try {
                                const parsed = JSON.parse(item.optimized_prompt);
                                return Array.isArray(parsed) ? parsed.map((res, i) => (
                                  <div key={i} className="flex items-start justify-between bg-gray-900/40 p-1.5 rounded border border-gray-800 text-xs text-gray-200">
                                    <span className="break-words max-w-[280px]">{res}</span>
                                    <button onClick={() => copyToClipboard(res)} className="text-[9px] bg-gray-700 hover:bg-gray-650 px-1 rounded ml-1 text-gray-300">Copy</button>
                                  </div>
                                )) : null;
                              } catch (e) {
                                return <p className="text-xs text-gray-200 font-mono break-words">{item.optimized_prompt}</p>;
                              }
                            })()}
                          </div>
                        ) : (
                          <div className="flex items-start justify-between bg-gray-900/40 p-1.5 rounded border border-gray-800 text-xs text-gray-200">
                            <span className="break-words max-w-[280px]">{item.optimized_prompt}</span>
                            <button onClick={() => copyToClipboard(item.optimized_prompt)} className="text-[9px] bg-gray-700 hover:bg-gray-650 px-1 rounded ml-1 text-gray-300">Copy</button>
                          </div>
                        )}
                      </div>

                      {item.was_accepted && (
                        <div className="absolute top-2 right-2 text-[10px]" title="Accepted via Tab">
                          👻
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {historyPages > 1 && (
                  <div className="flex justify-between items-center text-xs mt-3 pt-2 border-t border-gray-800">
                    <button
                      disabled={historyPage <= 1}
                      onClick={() => setHistoryPage(historyPage - 1)}
                      className="px-2 py-1 bg-gray-800 hover:bg-gray-750 disabled:opacity-30 rounded text-purple-300"
                    >
                      Prev
                    </button>
                    <span className="text-gray-400">Page {historyPage} of {historyPages}</span>
                    <button
                      disabled={historyPage >= historyPages}
                      onClick={() => setHistoryPage(historyPage + 1)}
                      className="px-2 py-1 bg-gray-800 hover:bg-gray-750 disabled:opacity-30 rounded text-purple-300"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Usage tab */}
        {activeTab === 'usage' && (
          <div className="flex-1 flex flex-col">
            <h2 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Usage Quota</h2>
            
            {usageLoading ? (
              <div className="flex-1 flex justify-center items-center text-xs text-purple-300">
                <span className="animate-pulse">Loading usage...</span>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  {/* Daily limit card */}
                  <div className="bg-gray-800/60 border border-gray-850 p-4 rounded-xl mb-4 text-center">
                    <div className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 mb-1">
                      {dailyRemaining} <span className="text-xs font-normal text-gray-400">/ {dailyLimit} left</span>
                    </div>
                    <div className="text-xs text-gray-300">Remaining daily optimizations</div>
                    
                    {/* Progress bar */}
                    <div className="w-full bg-gray-900 rounded-full h-2.5 mt-3 border border-gray-750 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-blue-500 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${(dailyRemaining / dailyLimit) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Daily logs list */}
                  <h3 className="text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Weekly Daily Log</h3>
                  {usageStats.length === 0 ? (
                    <div className="text-[11px] text-gray-500 text-center py-4 bg-gray-850/30 rounded border border-gray-855">
                      No usage data logged for the past 7 days.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                      {usageStats.map((stat) => (
                        <div key={stat.id} className="flex justify-between items-center text-xs bg-gray-800/40 p-2 rounded border border-gray-850 text-gray-300">
                          <span className="font-medium">{stat.date}</span>
                          <span className="text-gray-400">
                            Opt: {stat.optimize_count} | Trans: {stat.transform_count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
