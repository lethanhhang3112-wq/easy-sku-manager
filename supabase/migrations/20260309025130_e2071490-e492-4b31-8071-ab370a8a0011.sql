
-- Customer groups table
CREATE TABLE IF NOT EXISTS public.customer_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to customer_groups" ON public.customer_groups
  FOR ALL USING (true) WITH CHECK (true);

-- Add customer_group_id and status to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS customer_group_id uuid REFERENCES public.customer_groups(id) ON DELETE SET NULL;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
