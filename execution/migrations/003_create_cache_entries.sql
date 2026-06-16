-- public.cache_entries table definition
CREATE TABLE IF NOT EXISTS public.cache_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_hash VARCHAR(64) UNIQUE NOT NULL,
  level VARCHAR(20) NOT NULL,
  optimized_text TEXT NOT NULL,
  hit_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cache_hash_level ON public.cache_entries(prompt_hash, level);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON public.cache_entries(expires_at);
