
CREATE TABLE IF NOT EXISTS public.print_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'sales_invoice',
  paper_size text NOT NULL DEFAULT 'K80',
  content text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.print_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to print_templates"
  ON public.print_templates
  FOR ALL
  USING (true)
  WITH CHECK (true);
