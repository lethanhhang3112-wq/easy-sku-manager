ALTER TABLE public.import_orders 
ADD COLUMN discount numeric NOT NULL DEFAULT 0,
ADD COLUMN notes text DEFAULT '',
ADD COLUMN amount_paid numeric NOT NULL DEFAULT 0;