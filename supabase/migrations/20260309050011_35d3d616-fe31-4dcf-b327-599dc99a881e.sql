
-- ============================================================
-- MIGRATION: Comprehensive schema upgrade for POS & Inventory
-- ============================================================

-- 1. Enable unaccent extension (idempotent)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============================================================
-- 2. ADD updated_at TO ALL EXISTING TABLES
-- ============================================================

-- Helper function for auto-updating updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- categories
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS total_debt numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_spend numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- suppliers
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS total_debt numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- import_orders
ALTER TABLE public.import_orders
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS branch_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_by text NOT NULL DEFAULT '';

CREATE OR REPLACE TRIGGER trg_import_orders_updated_at
  BEFORE UPDATE ON public.import_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- import_order_items (add computed total_cost column)
ALTER TABLE public.import_order_items
  ADD COLUMN IF NOT EXISTS total_cost numeric GENERATED ALWAYS AS (quantity * unit_cost) STORED;

-- sales_orders
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS subtotal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS branch_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_by text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes text DEFAULT '';

CREATE OR REPLACE TRIGGER trg_sales_orders_updated_at
  BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- sales_order_items
ALTER TABLE public.sales_order_items
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_price numeric GENERATED ALWAYS AS ((unit_price * quantity) - discount) STORED,
  ADD COLUMN IF NOT EXISTS notes text DEFAULT '';

-- payment_slips — restructure for cashbook
ALTER TABLE public.payment_slips
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'receipt',
  ADD COLUMN IF NOT EXISTS reference_id uuid,
  ADD COLUMN IF NOT EXISTS target_type text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS target_id uuid;

-- Make import_order_id nullable (payment_slips now supports multiple targets)
ALTER TABLE public.payment_slips
  ALTER COLUMN import_order_id DROP NOT NULL;

CREATE OR REPLACE TRIGGER trg_payment_slips_updated_at
  BEFORE UPDATE ON public.payment_slips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- stock_adjustments
ALTER TABLE public.stock_adjustments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE TRIGGER trg_stock_adjustments_updated_at
  BEFORE UPDATE ON public.stock_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- store_settings
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS store_logo_url text DEFAULT '';

-- print_templates (already has updated_at)
-- No changes needed.

-- customer_groups
ALTER TABLE public.customer_groups
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE TRIGGER trg_customer_groups_updated_at
  BEFORE UPDATE ON public.customer_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- 3. STOCK UPDATE TRIGGERS
-- ============================================================

-- 3a. Import: When items are inserted, ADD to stock
CREATE OR REPLACE FUNCTION public.trg_import_item_stock_increase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = stock_quantity + NEW.quantity
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

-- Drop if exists to avoid conflict, then create
DROP TRIGGER IF EXISTS trg_import_item_after_insert ON public.import_order_items;
CREATE TRIGGER trg_import_item_after_insert
  AFTER INSERT ON public.import_order_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_import_item_stock_increase();

-- 3b. Import: When items are deleted, SUBTRACT from stock (e.g. void import)
CREATE OR REPLACE FUNCTION public.trg_import_item_stock_decrease()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = stock_quantity - OLD.quantity
  WHERE id = OLD.product_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_import_item_after_delete ON public.import_order_items;
CREATE TRIGGER trg_import_item_after_delete
  AFTER DELETE ON public.import_order_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_import_item_stock_decrease();

-- 3c. Sales: When items are inserted, SUBTRACT from stock
CREATE OR REPLACE FUNCTION public.trg_sales_item_stock_decrease()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = stock_quantity - NEW.quantity
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_item_after_insert ON public.sales_order_items;
CREATE TRIGGER trg_sales_item_after_insert
  AFTER INSERT ON public.sales_order_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_sales_item_stock_decrease();

-- 3d. Sales: When items are deleted, ADD back to stock (e.g. void sale)
CREATE OR REPLACE FUNCTION public.trg_sales_item_stock_increase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = stock_quantity + OLD.quantity
  WHERE id = OLD.product_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_item_after_delete ON public.sales_order_items;
CREATE TRIGGER trg_sales_item_after_delete
  AFTER DELETE ON public.sales_order_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_sales_item_stock_increase();


-- ============================================================
-- 4. CONSTRAINT: Add CHECK for payment_slips.type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_payment_slip_type'
  ) THEN
    ALTER TABLE public.payment_slips
      ADD CONSTRAINT chk_payment_slip_type CHECK (type IN ('receipt', 'payment'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_payment_slip_target_type'
  ) THEN
    ALTER TABLE public.payment_slips
      ADD CONSTRAINT chk_payment_slip_target_type CHECK (target_type IN ('customer', 'supplier', 'other'));
  END IF;
END;
$$;
