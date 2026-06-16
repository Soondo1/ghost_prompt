-- public.prompt_history table definition
CREATE TABLE IF NOT EXISTS public.prompt_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  original_prompt TEXT NOT NULL,
  optimized_prompt TEXT NULL,
  optimization_level VARCHAR(20) NOT NULL,
  endpoint VARCHAR(20) NOT NULL,
  platform VARCHAR(50) NULL,
  was_accepted BOOLEAN DEFAULT FALSE NOT NULL,
  response_time_ms INTEGER NULL,
  tokens_used INTEGER NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_history_user_created ON public.prompt_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_platform ON public.prompt_history(platform);
