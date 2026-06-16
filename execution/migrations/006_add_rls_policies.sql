-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cache_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_log ENABLE ROW LEVEL SECURITY;

-- users policies
DROP POLICY IF EXISTS "users_self" ON public.users;
CREATE POLICY "users_self" ON public.users
  FOR ALL USING (auth.uid() = id);

-- prompt_history policies
DROP POLICY IF EXISTS "history_self" ON public.prompt_history;
CREATE POLICY "history_self" ON public.prompt_history
  FOR ALL USING (auth.uid() = user_id);

-- usage_stats policies
DROP POLICY IF EXISTS "stats_self" ON public.usage_stats;
CREATE POLICY "stats_self" ON public.usage_stats
  FOR SELECT USING (auth.uid() = user_id);

-- Note: cache_entries and error_log do not have direct user policies, meaning they can only be accessed using the service role client by default.
