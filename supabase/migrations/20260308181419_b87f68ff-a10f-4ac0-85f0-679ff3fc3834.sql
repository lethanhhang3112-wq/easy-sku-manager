
CREATE TABLE public.stock_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('in', 'out')),
  quantity integer NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  note text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to stock_adjustments" ON public.stock_adjustments FOR ALL USING (true) WITH CHECK (true);
