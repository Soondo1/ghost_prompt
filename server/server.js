// server/server.js
// Simple Express server exposing /optimize endpoint that calls Gemini 2.5 Flash

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Model Provider Abstraction
class ModelProvider {
  async countTokens(promptInput) {
    return 0;
  }
  async generateContent(promptInput) {
    throw new Error('generateContent not implemented');
  }
}

class GeminiProvider extends ModelProvider {
  constructor(apiKey) {
    super();
    this.genAI = new GoogleGenerativeAI(apiKey || 'dummy-key');
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  async countTokens(promptInput) {
    try {
      const tokenResult = await this.model.countTokens(promptInput);
      return tokenResult.totalTokens;
    } catch (err) {
      console.error('Gemini countTokens error:', err);
      return 0;
    }
  }

  async generateContent(promptInput) {
    const result = await this.model.generateContent(promptInput);
    const response = await result.response;
    return response.text().trim();
  }
}

const getModelProvider = () => {
  const provider = process.env.MODEL_PROVIDER || 'gemini';
  if (provider === 'gemini') {
    return new GeminiProvider(process.env.GEMINI_API_KEY);
  }
  throw new Error(`Unsupported model provider: ${provider}`);
};

const modelProvider = getModelProvider();

const app = express();
app.use(cors());
app.use(express.json());

const getSupabaseClient = () => createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

const authMiddleware = async (req, res, next) => {
  const supabase = getSupabaseClient();
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ error: 'Unauthorized: Auth validation failed' });
  }
};

const rateLimitMiddleware = async (req, res, next) => {
  const supabase = getSupabaseClient();
  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  try {
    const { data: profile } = await supabase
      .from('users')
      .select('daily_limit')
      .eq('id', userId)
      .maybeSingle();

    const dailyLimit = profile?.daily_limit !== undefined ? profile.daily_limit : 50;

    const { data: stats } = await supabase
      .from('usage_stats')
      .select('optimize_count, transform_count')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    const currentUsage = (stats?.optimize_count || 0) + (stats?.transform_count || 0);
    if (currentUsage >= dailyLimit) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    req.dailyLimit = dailyLimit;
    req.currentUsage = currentUsage;
    next();
  } catch (err) {
    console.error('Rate limit middleware error:', err);
    next(); // Degrade gracefully
  }
};

// Auth routes
app.post('/auth/signup', async (req, res) => {
  const supabase = getSupabaseClient();
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    
    if (error) {
      return res.status(error.status || 400).json({ error: error.message });
    }

    // Automatically sign in the user to obtain tokens
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      return res.status(201).json({
        user: { id: data.user.id, email: data.user.email },
        message: 'Signup successful! Please proceed to login.'
      });
    }

    return res.status(201).json({
      user: { id: data.user.id, email: data.user.email },
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/auth/login', async (req, res) => {
  const supabase = getSupabaseClient();
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return res.status(error.status || 400).json({ error: error.message });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('plan_tier, daily_limit')
      .eq('id', data.user.id)
      .maybeSingle();

    return res.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        plan_tier: profile?.plan_tier || 'free',
        daily_limit: profile?.daily_limit || 50
      },
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/auth/refresh', async (req, res) => {
  const supabase = getSupabaseClient();
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ error: 'Missing refresh token' });
  }

  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
    if (error) {
      return res.status(error.status || 400).json({ error: error.message });
    }

    return res.json({
      user: {
        id: data.user.id,
        email: data.user.email
      },
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    });
  } catch (err) {
    console.error('Token refresh error:', err);
    return res.status(500).json({ error: 'Token refresh failed' });
  }
});

// History routes
app.get('/history', authMiddleware, async (req, res) => {
  const supabase = getSupabaseClient();
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    const { data: items, error, count } = await supabase
      .from('prompt_history')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const pages = Math.ceil((count || 0) / limit);

    return res.json({
      items: items || [],
      total: count || 0,
      page,
      pages
    });
  } catch (err) {
    console.error('History fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.post('/history/accept', authMiddleware, async (req, res) => {
  const supabase = getSupabaseClient();
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Missing history item id' });
  }

  try {
    const { error } = await supabase
      .from('prompt_history')
      .update({ was_accepted: true })
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('History acceptance error:', err);
    return res.status(500).json({ error: 'Failed to accept history item' });
  }
});

// Usage route
app.get('/usage', authMiddleware, async (req, res) => {
  const supabase = getSupabaseClient();
  const days = parseInt(req.query.days) || 30;
  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  try {
    const { data: profile } = await supabase
      .from('users')
      .select('daily_limit')
      .eq('id', userId)
      .maybeSingle();

    const dailyLimit = profile?.daily_limit || 50;

    const { data: todayStats } = await supabase
      .from('usage_stats')
      .select('optimize_count, transform_count')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    const todayUsage = (todayStats?.optimize_count || 0) + (todayStats?.transform_count || 0);
    const dailyRemaining = Math.max(0, dailyLimit - todayUsage);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const { data: stats, error } = await supabase
      .from('usage_stats')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDateStr)
      .order('date', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({
      daily_remaining: dailyRemaining,
      daily_limit: dailyLimit,
      stats: stats || []
    });
  } catch (err) {
    console.error('Usage fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

app.post('/optimize', authMiddleware, rateLimitMiddleware, async (req, res) => {
  const supabase = getSupabaseClient();
  const { prompt, level = 'concise' } = req.body;
  if (!prompt || !prompt.trim()) {
    return res.json({ optimized: '' });
  }

  const startTime = Date.now();
  const promptHash = crypto.createHash('sha256').update(`${prompt}:${level}`).digest('hex');
  try {
    // 1. Check Cache
    const isoTime = new Date().toISOString();
    const { data: cachedEntry, error: cacheErr } = await supabase
      .from('cache_entries')
      .select('optimized_text, id, hit_count')
      .eq('prompt_hash', promptHash)
      .gt('expires_at', isoTime)
      .maybeSingle();

    if (cacheErr) {
      console.error('Cache query error:', cacheErr);
    }

    if (cachedEntry) {
      // Increment cache hit count
      supabase
        .from('cache_entries')
        .update({ hit_count: cachedEntry.hit_count + 1 })
        .eq('id', cachedEntry.id)
        .then(() => {})
        .catch(err => console.error('Failed to increment hit count:', err));

      // Record daily usage stats for cached hit
      const today = new Date().toISOString().split('T')[0];
      supabase
        .from('usage_stats')
        .select('*')
        .eq('user_id', req.user.id)
        .eq('date', today)
        .maybeSingle()
        .then(async ({ data: stats }) => {
          if (!stats) {
            await supabase.from('usage_stats').insert({
              user_id: req.user.id,
              date: today,
              optimize_count: 1,
              cached_hits: 1
            });
          } else {
            await supabase
              .from('usage_stats')
              .update({
                optimize_count: stats.optimize_count + 1,
                cached_hits: stats.cached_hits + 1
              })
              .eq('id', stats.id);
          }
        })
        .catch(err => console.error('Failed to update usage stats for cache hit:', err));

      // Write to history for cache hit
      let historyId = null;
      try {
        const { data: historyRow } = await supabase
          .from('prompt_history')
          .insert({
            user_id: req.user.id,
            original_prompt: prompt,
            optimized_prompt: cachedEntry.optimized_text,
            optimization_level: level,
            endpoint: 'optimize',
            was_accepted: false,
            response_time_ms: Date.now() - startTime,
            tokens_used: 0
          })
          .select('id')
          .single();
        if (historyRow) {
          historyId = historyRow.id;
        }
      } catch (err) {
        console.error('Failed to write prompt history for cache hit:', err);
      }

      return res.json({
        optimized: cachedEntry.optimized_text,
        cached: true,
        tokens_used: 0,
        id: historyId
      });
    }

    // 2. Call Gemini
    const systemInstruction = `You are a prompt optimizer. Convert the user's rough intent into a high-quality, token-efficient PECRA-formatted prompt. If the input is too short to optimize, return an empty string. Output ONLY the optimized text. Use ${level === 'detailed' ? 'detailed' : 'concise'} style.`;
    const promptInput = `${systemInstruction}\n\nInput to optimize:\n${prompt}`;
    
    // Count tokens
    const tokensUsed = await modelProvider.countTokens(promptInput);

    const optimized = await modelProvider.generateContent(promptInput);
    const responseTime = Date.now() - startTime;

    // 3. Write to Cache (expires in 24 hours)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);

    supabase
      .from('cache_entries')
      .insert({
        prompt_hash: promptHash,
        level,
        optimized_text: optimized,
        expires_at: expiresAt.toISOString()
      })
      .then(() => {})
      .catch(err => console.error('Failed to write to cache:', err));

    // 4. Save to Prompt History
    let historyId = null;
    try {
      const { data: historyRow } = await supabase
        .from('prompt_history')
        .insert({
          user_id: req.user.id,
          original_prompt: prompt,
          optimized_prompt: optimized,
          optimization_level: level,
          endpoint: 'optimize',
          was_accepted: false,
          response_time_ms: responseTime,
          tokens_used: tokensUsed
        })
        .select('id')
        .single();
      if (historyRow) {
        historyId = historyRow.id;
      }
    } catch (err) {
      console.error('Failed to write prompt history:', err);
    }

    // 5. Update Usage Stats
    const today = new Date().toISOString().split('T')[0];
    supabase
      .from('usage_stats')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('date', today)
      .maybeSingle()
      .then(async ({ data: stats }) => {
        if (!stats) {
          await supabase.from('usage_stats').insert({
            user_id: req.user.id,
            date: today,
            optimize_count: 1,
            tokens_used: tokensUsed
          });
        } else {
          await supabase
              .from('usage_stats')
              .update({
                optimize_count: stats.optimize_count + 1,
                tokens_used: stats.tokens_used + tokensUsed
              })
              .eq('id', stats.id);
        }
      })
      .catch(err => console.error('Failed to update usage stats:', err));

    res.json({
      optimized,
      cached: false,
      tokens_used: tokensUsed,
      id: historyId
    });
  } catch (error) {
    console.error('Gemini error:', error);

    // Log telemetry to Supabase
    supabase
      .from('error_log')
      .insert({
        user_id: req.user ? req.user.id : null,
        endpoint: '/optimize',
        error_type: error.name || 'Error',
        error_message: error.message || String(error),
        stack_trace: error.stack || null,
        request_payload: req.body
      })
      .then(() => {})
      .catch(dbErr => console.error('Failed to write to error_log:', dbErr));

    if (error.status === 429 || (error.message && error.message.includes('429'))) {
      return res.status(429).json({ error: 'Gemini API Rate Limit Exceeded' });
    }
    res.status(500).json({ error: 'Optimization failed' });
  }
});

app.post('/transform', authMiddleware, rateLimitMiddleware, async (req, res) => {
  const supabase = getSupabaseClient();
  const { prompt } = req.body;
  if (!prompt || !prompt.trim()) {
    return res.json({ results: [] });
  }

  const startTime = Date.now();
  const promptHash = crypto.createHash('sha256').update(`${prompt}:transform`).digest('hex');

  try {
    // 1. Check Cache
    const { data: cachedEntry } = await supabase
      .from('cache_entries')
      .select('optimized_text, id, hit_count')
      .eq('prompt_hash', promptHash)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cachedEntry) {
      // Increment cache hit count
      supabase
        .from('cache_entries')
        .update({ hit_count: cachedEntry.hit_count + 1 })
        .eq('id', cachedEntry.id)
        .then(() => {})
        .catch(err => console.error('Failed to increment hit count:', err));

      // Record daily usage stats for cached hit
      const today = new Date().toISOString().split('T')[0];
      supabase
        .from('usage_stats')
        .select('*')
        .eq('user_id', req.user.id)
        .eq('date', today)
        .maybeSingle()
        .then(async ({ data: stats }) => {
          if (!stats) {
            await supabase.from('usage_stats').insert({
              user_id: req.user.id,
              date: today,
              transform_count: 1,
              cached_hits: 1
            });
          } else {
            await supabase
              .from('usage_stats')
              .update({
                transform_count: stats.transform_count + 1,
                cached_hits: stats.cached_hits + 1
              })
              .eq('id', stats.id);
          }
        })
        .catch(err => console.error('Failed to update usage stats for cache hit:', err));

      // Write to history for cache hit
      let historyId = null;
      try {
        const { data: historyRow } = await supabase
          .from('prompt_history')
          .insert({
            user_id: req.user.id,
            original_prompt: prompt,
            optimized_prompt: cachedEntry.optimized_text,
            optimization_level: 'transform',
            endpoint: 'transform',
            was_accepted: false,
            response_time_ms: Date.now() - startTime,
            tokens_used: 0
          })
          .select('id')
          .single();
        if (historyRow) {
          historyId = historyRow.id;
        }
      } catch (err) {
        console.error('Failed to write prompt history for cache hit in transform:', err);
      }

      try {
        const results = JSON.parse(cachedEntry.optimized_text);
        return res.json({
          results,
          cached: true,
          tokens_used: 0,
          id: historyId
        });
      } catch (e) {
        console.error('Failed to parse cached transform JSON, ignoring cache hit:', e);
      }
    }

    // 2. Call Gemini
    const systemInstruction = `You are a prompt optimizer. The user will provide a rough intent. Provide exactly 2 distinct optimized variations of their prompt. Variation 1 should be concise and direct. Variation 2 should be detailed and comprehensive. Format your response as a strict JSON array of strings containing ONLY the two strings, e.g. ["concise prompt", "detailed prompt"]. NEVER include markdown code blocks around the JSON. Return raw JSON.`;
    const promptInput = `${systemInstruction}\n\nInput to optimize:\n${prompt}`;

    const tokensUsed = await modelProvider.countTokens(promptInput);

    let text = await modelProvider.generateContent(promptInput);
    if (text.startsWith('```')) {
      text = text.replace(/```json\n?|\n?```/g, '');
    }

    const results = JSON.parse(text);
    const responseTime = Date.now() - startTime;

    // 3. Write to Cache (expires in 24 hours)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);

    supabase
      .from('cache_entries')
      .insert({
        prompt_hash: promptHash,
        level: 'transform',
        optimized_text: text,
        expires_at: expiresAt.toISOString()
      })
      .then(() => {})
      .catch(err => console.error('Failed to write to cache:', err));

    // 4. Save to Prompt History
    let historyId = null;
    try {
      const { data: historyRow } = await supabase
        .from('prompt_history')
        .insert({
          user_id: req.user.id,
          original_prompt: prompt,
          optimized_prompt: text,
          optimization_level: 'transform',
          endpoint: 'transform',
          was_accepted: false,
          response_time_ms: responseTime,
          tokens_used: tokensUsed
        })
        .select('id')
        .single();
      if (historyRow) {
        historyId = historyRow.id;
      }
    } catch (err) {
      console.error('Failed to write prompt history:', err);
    }

    // 5. Update Usage Stats
    const today = new Date().toISOString().split('T')[0];
    supabase
      .from('usage_stats')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('date', today)
      .maybeSingle()
      .then(async ({ data: stats }) => {
        if (!stats) {
          await supabase.from('usage_stats').insert({
            user_id: req.user.id,
            date: today,
            transform_count: 1,
            tokens_used: tokensUsed
          });
        } else {
          await supabase
            .from('usage_stats')
            .update({
              transform_count: stats.transform_count + 1,
              tokens_used: stats.tokens_used + tokensUsed
            })
            .eq('id', stats.id);
        }
      })
      .catch(err => console.error('Failed to update usage stats:', err));

    res.json({
      results,
      cached: false,
      tokens_used: tokensUsed,
      id: historyId
    });
  } catch (error) {
    console.error('Gemini or Parse error:', error);

    // Log telemetry to Supabase
    supabase
      .from('error_log')
      .insert({
        user_id: req.user ? req.user.id : null,
        endpoint: '/transform',
        error_type: error.name || 'Error',
        error_message: error.message || String(error),
        stack_trace: error.stack || null,
        request_payload: req.body
      })
      .then(() => {})
      .catch(dbErr => console.error('Failed to write to error_log:', dbErr));

    if (error.status === 429 || (error.message && error.message.includes('429'))) {
      return res.status(429).json({ error: 'Gemini API Rate Limit Exceeded' });
    }
    res.status(500).json({ error: 'Transformation failed' });
  }
});
// Health check route
app.get('/health', async (req, res) => {
  const supabase = getSupabaseClient();
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    components: {
      api_server: { status: 'UP', latency_ms: 0 },
      database_postgres: { status: 'UNKNOWN', latency_ms: 0 },
      gemini_api_connectivity: { status: 'UNKNOWN', latency_ms: 0 }
    }
  };

  const startServerTime = Date.now();
  healthStatus.components.api_server.latency_ms = Date.now() - startServerTime;

  // 1. Check Database
  const startDbTime = Date.now();
  try {
    const { error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (error) throw error;
    healthStatus.components.database_postgres.status = 'UP';
  } catch (dbErr) {
    console.error('Health check DB error:', dbErr);
    healthStatus.status = 'degraded';
    healthStatus.components.database_postgres.status = 'DOWN';
    healthStatus.components.database_postgres.error = dbErr.message || String(dbErr);
  }
  healthStatus.components.database_postgres.latency_ms = Date.now() - startDbTime;

  // 2. Check Gemini Connectivity
  const startGeminiTime = Date.now();
  try {
    await modelProvider.countTokens('healthcheck');
    healthStatus.components.gemini_api_connectivity.status = 'UP';
  } catch (geminiErr) {
    console.error('Health check Gemini error:', geminiErr);
    healthStatus.status = 'degraded';
    healthStatus.components.gemini_api_connectivity.status = 'DOWN';
    healthStatus.components.gemini_api_connectivity.error = geminiErr.message || String(geminiErr);
  }
  healthStatus.components.gemini_api_connectivity.latency_ms = Date.now() - startGeminiTime;

  if (healthStatus.status === 'healthy') {
    return res.status(200).json(healthStatus);
  } else {
    const statusCode = healthStatus.components.database_postgres.status === 'DOWN' ? 500 : 200;
    return res.status(statusCode).json(healthStatus);
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
