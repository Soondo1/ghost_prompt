-- public.usage_stats table definition
CREATE TABLE IF NOT EXISTS public.usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  optimize_count INTEGER DEFAULT 0 NOT NULL,
  transform_count INTEGER DEFAULT 0 NOT NULL,
  tokens_used INTEGER DEFAULT 0 NOT NULL,
  cached_hits INTEGER DEFAULT 0 NOT NULL,
  UNIQUE(user_id, date)
);
