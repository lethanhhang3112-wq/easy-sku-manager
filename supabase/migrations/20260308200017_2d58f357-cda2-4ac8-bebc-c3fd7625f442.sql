
-- Add status column to import_orders
ALTER TABLE public.import_orders 
ADD COLUMN status text NOT NULL DEFAULT 'completed';

-- Create payment_slips table
CREATE TABLE public.payment_slips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_order_id uuid NOT NULL REFERENCES public.import_orders(id) ON DELETE CASCADE,
  code text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  notes text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_slips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to payment_slips" ON public.payment_slips
  FOR ALL USING (true) WITH CHECK (true);
