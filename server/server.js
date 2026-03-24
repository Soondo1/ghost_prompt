// server/server.js
// Simple Express server exposing /optimize endpoint that calls Gemini 2.5 Flash

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

app.post('/optimize', async (req, res) => {
  const { prompt, level } = req.body;
  if (!prompt || !prompt.trim()) {
    return res.json({ optimized: '' });
  }
  try {
    const systemInstruction = `You are a prompt optimizer. Convert the user's rough intent into a high-quality, token-efficient PECRA-formatted prompt. If the input is too short to optimize, return an empty string. Output ONLY the optimized text. Use ${level === 'detailed' ? 'detailed' : 'concise'} style.`;
    const result = await model.generateContent([
      { role: 'system', parts: [{ text: systemInstruction }] },
      { role: 'user', parts: [{ text: prompt }] }
    ]);
    const response = await result.response;
    const optimized = response.text().trim();
    res.json({ optimized });
  } catch (error) {
    console.error('Gemini error:', error);
    res.status(500).json({ error: 'Optimization failed' });
  }
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Prompt Ghost server listening on port ${PORT}`);
  });
}

// Export for Vercel
module.exports = app;
