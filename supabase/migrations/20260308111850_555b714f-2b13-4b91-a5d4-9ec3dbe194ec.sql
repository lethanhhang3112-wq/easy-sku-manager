
-- 1. Products -> Categories: ON DELETE SET NULL
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_id_fkey;
ALTER TABLE public.products ADD CONSTRAINT products_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

-- 2. Import Orders -> Suppliers: ON DELETE RESTRICT
ALTER TABLE public.import_orders DROP CONSTRAINT IF EXISTS import_orders_supplier_id_fkey;
ALTER TABLE public.import_orders ADD CONSTRAINT import_orders_supplier_id_fkey
  FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE RESTRICT;

-- 3. Import Order Items -> Import Orders: ON DELETE CASCADE
ALTER TABLE public.import_order_items DROP CONSTRAINT IF EXISTS import_order_items_import_order_id_fkey;
ALTER TABLE public.import_order_items ADD CONSTRAINT import_order_items_import_order_id_fkey
  FOREIGN KEY (import_order_id) REFERENCES public.import_orders(id) ON DELETE CASCADE;

-- 4. Sales Order Items -> Sales Orders: ON DELETE CASCADE
ALTER TABLE public.sales_order_items DROP CONSTRAINT IF EXISTS sales_order_items_sales_order_id_fkey;
ALTER TABLE public.sales_order_items ADD CONSTRAINT sales_order_items_sales_order_id_fkey
  FOREIGN KEY (sales_order_id) REFERENCES public.sales_orders(id) ON DELETE CASCADE;

-- 5. Import Order Items -> Products: ON DELETE RESTRICT
ALTER TABLE public.import_order_items DROP CONSTRAINT IF EXISTS import_order_items_product_id_fkey;
ALTER TABLE public.import_order_items ADD CONSTRAINT import_order_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;

-- 6. Sales Order Items -> Products: ON DELETE RESTRICT
ALTER TABLE public.sales_order_items DROP CONSTRAINT IF EXISTS sales_order_items_product_id_fkey;
ALTER TABLE public.sales_order_items ADD CONSTRAINT sales_order_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;

-- 7. Sales Orders -> Customers: ON DELETE RESTRICT
ALTER TABLE public.sales_orders DROP CONSTRAINT IF EXISTS sales_orders_customer_id_fkey;
ALTER TABLE public.sales_orders ADD CONSTRAINT sales_orders_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;
