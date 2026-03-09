
CREATE TABLE IF NOT EXISTS public.store_settings (
  id integer PRIMARY KEY DEFAULT 1,
  store_name text NOT NULL DEFAULT '',
  store_address text NOT NULL DEFAULT '',
  store_phone text NOT NULL DEFAULT '',
  receipt_footer_text text NOT NULL DEFAULT 'Cảm ơn quý khách và hẹn gặp lại!',
  print_paper_size text NOT NULL DEFAULT 'K80',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Ensure singleton row exists
INSERT INTO public.store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to store_settings"
  ON public.store_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);
