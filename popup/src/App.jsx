// src/popup/App.jsx
import React, { useState, useEffect } from 'react';
import './index.css';

const App = () => {
  const [inputText, setInputText] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [enabled, setEnabled] = useState(true);
  const [level, setLevel] = useState('concise');

  useEffect(() => {
    chrome.storage.sync.get({ enabled: true, optimizationLevel: 'concise' }, (data) => {
      setEnabled(data.enabled);
      setLevel(data.optimizationLevel);
    });
  }, []);

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

  return (
    <div className="p-5 w-[420px] bg-gray-900 text-white min-h-[400px] flex flex-col font-sans">
      <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-800">
        <h1 className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-500">
          Prompt Ghost 👻
        </h1>
        <div className="flex items-center space-x-3 text-xs">
          <label className="flex items-center space-x-1 cursor-pointer">
             <input
                type="checkbox"
                checked={enabled}
                onChange={toggleEnabled}
                className="w-4 h-4 rounded focus:ring-purple-500 accent-purple-500"
              />
              <span className="text-gray-300">Live Overlay</span>
          </label>
          <select
            value={level}
            onChange={handleLevelChange}
            className="bg-gray-800 text-gray-300 rounded border border-gray-700 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="concise">Concise</option>
            <option value="detailed">Detailed</option>
          </select>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <p className="text-sm text-gray-300 mb-3 font-medium">
          Not seeing the ghost? Transform your thoughts manually:
        </p>

        <textarea
          className="w-full h-28 p-3 bg-gray-800 text-sm border border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none mb-3 resize-none shadow-inner"
          placeholder="Type your rough idea here to get two highly-optimized AI prompts instantly..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />

        <button
          onClick={handleTransform}
          disabled={loading || !inputText.trim()}
          className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg font-bold shadow-lg disabled:opacity-50 transition-all duration-200 uppercase tracking-wider text-sm flex justify-center items-center"
        >
          {loading ? (
             <span className="animate-pulse">✨ Generating Variations... ✨</span>
          ) : (
             <span>✨ Transform Text ✨</span>
          )}
        </button>

        {error && <p className="text-red-400 text-xs mt-3 text-center bg-red-900/40 p-2 rounded">{error}</p>}

        {results.length > 0 && (
          <div className="w-full mt-5 space-y-3 pb-2">
            {results.map((result, idx) => (
              <div key={idx} className="bg-gray-800 border border-gray-700 p-4 rounded-lg relative group hover:border-gray-600 transition-colors">
                <h3 className="text-xs text-purple-400 uppercase tracking-widest font-bold mb-2">Option {idx + 1} {idx === 0 ? '(Concise)' : '(Detailed)'}</h3>
                <p className="text-sm text-gray-200 pr-8 break-words whitespace-pre-wrap leading-relaxed">{result}</p>
                <button
                  onClick={() => copyToClipboard(result)}
                  className="absolute top-3 right-3 p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors shadow"
                  title="Copy to clipboard"
                >
                  📋
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
