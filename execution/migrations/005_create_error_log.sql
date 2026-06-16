-- public.error_log table definition
CREATE TABLE IF NOT EXISTS public.error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  endpoint VARCHAR(50) NOT NULL,
  error_type VARCHAR(100) NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT NULL,
  request_payload JSONB NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
