
-- ============================================================
-- PART 1: AUTO-UPDATE CUSTOMER DEBT & SPEND
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_sales_order_update_customer_debt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_debt NUMERIC;
BEGIN
  IF NEW.customer_id IS NOT NULL AND NEW.status = 'completed' THEN
    v_debt := NEW.total_amount - COALESCE(
      (SELECT COALESCE(SUM(ps.amount), 0) FROM public.payment_slips ps
       WHERE ps.reference_id = NEW.id AND ps.type = 'receipt'), 0);
    UPDATE public.customers
    SET total_spend = total_spend + NEW.total_amount,
        total_debt  = total_debt + GREATEST(v_debt, 0)
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sales_order_after_insert_customer
AFTER INSERT ON public.sales_orders
FOR EACH ROW EXECUTE FUNCTION public.trg_sales_order_update_customer_debt();

-- Customer debt reduction on receipt payment
CREATE OR REPLACE FUNCTION public.trg_payment_slip_update_customer_debt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.type = 'receipt' AND NEW.target_type = 'customer' AND NEW.target_id IS NOT NULL THEN
    UPDATE public.customers SET total_debt = total_debt - NEW.amount WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_slip_after_insert_customer
AFTER INSERT ON public.payment_slips
FOR EACH ROW EXECUTE FUNCTION public.trg_payment_slip_update_customer_debt();

-- ============================================================
-- PART 2: AUTO-UPDATE SUPPLIER DEBT
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_import_order_update_supplier_debt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_debt NUMERIC;
BEGIN
  IF NEW.supplier_id IS NOT NULL AND NEW.status = 'completed' THEN
    v_debt := NEW.total_amount - NEW.amount_paid;
    IF v_debt > 0 THEN
      UPDATE public.suppliers SET total_debt = total_debt + v_debt WHERE id = NEW.supplier_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_import_order_after_insert_supplier
AFTER INSERT ON public.import_orders
FOR EACH ROW EXECUTE FUNCTION public.trg_import_order_update_supplier_debt();

-- Supplier debt reduction on payment slip
CREATE OR REPLACE FUNCTION public.trg_payment_slip_update_supplier_debt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.type = 'payment' AND NEW.target_type = 'supplier' AND NEW.target_id IS NOT NULL THEN
    UPDATE public.suppliers SET total_debt = total_debt - NEW.amount WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_slip_after_insert_supplier
AFTER INSERT ON public.payment_slips
FOR EACH ROW EXECUTE FUNCTION public.trg_payment_slip_update_supplier_debt();

-- ============================================================
-- PART 3: updated_at auto-update triggers
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'categories','products','customers','customer_groups','suppliers',
    'import_orders','sales_orders','payment_slips','stock_adjustments',
    'store_settings','print_templates'
  ]) LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at_%I ON public.%I; CREATE TRIGGER set_updated_at_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END;
$$;
