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
    
    // Pass the system instruction directly into the prompt argument instead of the roles array
    // This avoids crashes if the backend SDK rejects the 'system' role.
    const result = await model.generateContent(`${systemInstruction}\n\nInput to optimize:\n${prompt}`);
    
    const response = await result.response;
    const optimized = response.text().trim();
    res.json({ optimized });
  } catch (error) {
    console.error('Gemini error:', error);
    res.status(500).json({ error: 'Optimization failed' });
  }
});

app.post('/transform', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || !prompt.trim()) {
    return res.json({ results: [] });
  }
  try {
    const systemInstruction = `You are a prompt optimizer. The user will provide a rough intent. Provide exactly 2 distinct optimized variations of their prompt. Variation 1 should be concise and direct. Variation 2 should be detailed and comprehensive. Format your response as a strict JSON array of strings containing ONLY the two strings, e.g. ["concise prompt", "detailed prompt"]. NEVER include markdown code blocks around the JSON. Return raw JSON.`;
    
    const result = await model.generateContent(`${systemInstruction}\n\nInput to optimize:\n${prompt}`);
    
    const response = await result.response;
    let text = response.text().trim();
    // remove markdown formatting if Gemini included it despite instructions
    if (text.startsWith('```')) {
      text = text.replace(/```json\n?|\n?```/g, '');
    }
    
    const results = JSON.parse(text);
    res.json({ results });
  } catch (error) {
    console.error('Gemini error:', error);
    res.status(500).json({ error: 'Transformation failed' });
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
