
-- Add payment_method column to sales_orders table
ALTER TABLE public.sales_orders 
ADD COLUMN payment_method text NOT NULL DEFAULT 'cash';

-- Add comment for clarity
COMMENT ON COLUMN public.sales_orders.payment_method IS 'Payment method: cash (tiền mặt) or transfer (chuyển khoản)';
