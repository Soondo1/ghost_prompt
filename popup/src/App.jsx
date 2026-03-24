// src/popup/App.jsx
import React, { useEffect, useState } from 'react';
import './index.css';

const App = () => {
  const [enabled, setEnabled] = useState(true);
  const [level, setLevel] = useState('concise');

  // Load saved settings
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

  return (
    <div className="p-6 min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white">
      <h1 className="text-2xl font-bold mb-4 text-center">Prompt Ghost</h1>
      <div className="flex items-center justify-center mb-6">
        <label className="mr-2">Enabled</label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={toggleEnabled}
          className="toggle-checkbox w-10 h-5 rounded-full bg-gray-400 checked:bg-indigo-600 focus:outline-none transition-colors"
        />
      </div>
      <div className="flex flex-col items-center">
        <label className="mb-2">Optimization Level</label>
        <select
          value={level}
          onChange={handleLevelChange}
          className="bg-gray-800 text-white rounded px-3 py-2 focus:outline-none"
        >
          <option value="concise">Concise</option>
          <option value="detailed">Detailed</option>
        </select>
      </div>
    </div>
  );
};

export default App;
