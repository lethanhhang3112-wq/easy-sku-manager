-- ============================================================
-- DATABASE SCHEMA REFERENCE — KiotPOS
-- Generated: 2026-03-09
-- ============================================================
-- This file is for REFERENCE ONLY. The actual schema is managed
-- via Supabase migrations in supabase/migrations/.
-- ============================================================

-- ┌──────────────────────────────────────────────────────────┐
-- │  EXTENSIONS                                              │
-- └──────────────────────────────────────────────────────────┘
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ┌──────────────────────────────────────────────────────────┐
-- │  HELPER FUNCTIONS                                        │
-- └──────────────────────────────────────────────────────────┘

-- Auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ┌──────────────────────────────────────────────────────────┐
-- │  TABLES                                                  │
-- └──────────────────────────────────────────────────────────┘

-- 1. store_settings (Singleton)
-- Columns: id (int PK, default 1), store_name, store_address,
--   store_phone, receipt_footer_text, print_paper_size,
--   store_logo_url, created_at, updated_at

-- 2. categories
-- Columns: id (uuid PK), name, description, created_at, updated_at

-- 3. products
-- Columns: id (uuid PK), code (unique), name, category_id (FK → categories),
--   cost_price (numeric), sale_price (numeric), stock_quantity (int, default 0),
--   status (text, default 'active'), created_at, updated_at
-- FK: category_id → categories.id (ON DELETE SET NULL)

-- 4. customer_groups
-- Columns: id (uuid PK), name, description, created_at, updated_at

-- 5. customers
-- Columns: id (uuid PK), code (unique), name, phone, address,
--   customer_group_id (FK → customer_groups), status (text),
--   total_debt (numeric, default 0), total_spend (numeric, default 0),
--   created_at, updated_at
-- FK: customer_group_id → customer_groups.id

-- 6. suppliers
-- Columns: id (uuid PK), code (unique), name, phone, email, address,
--   company, tax_code, notes, status (text, default 'active'),
--   total_debt (numeric, default 0), created_at, updated_at

-- 7. import_orders
-- Columns: id (uuid PK), code (unique), supplier_id (FK → suppliers, nullable),
--   status, total_amount, discount, amount_paid, notes,
--   branch_name, created_by, created_at, updated_at
-- FK: supplier_id → suppliers.id

-- 8. import_order_items
-- Columns: id (uuid PK), import_order_id (FK → import_orders CASCADE),
--   product_id (FK → products RESTRICT), quantity, unit_cost,
--   total_cost (GENERATED ALWAYS AS quantity * unit_cost STORED)
-- FK: import_order_id → import_orders.id (ON DELETE CASCADE)
-- FK: product_id → products.id (ON DELETE RESTRICT)

-- 9. sales_orders
-- Columns: id (uuid PK), code (unique), customer_id (FK → customers, nullable),
--   status, subtotal, discount, total_amount, payment_method,
--   notes, branch_name, created_by, created_at, updated_at
-- FK: customer_id → customers.id

-- 10. sales_order_items
-- Columns: id (uuid PK), sales_order_id (FK → sales_orders CASCADE),
--   product_id (FK → products RESTRICT), quantity, unit_price,
--   discount (numeric, default 0),
--   final_price (GENERATED ALWAYS AS (unit_price * quantity) - discount STORED),
--   notes
-- FK: sales_order_id → sales_orders.id (ON DELETE CASCADE)
-- FK: product_id → products.id (ON DELETE RESTRICT)

-- 11. payment_slips (Sổ quỹ / Cashbook)
-- Columns: id (uuid PK), code (unique), type ('receipt' | 'payment'),
--   amount, payment_method, import_order_id (FK, nullable - legacy),
--   reference_id (uuid, nullable), target_type ('customer'|'supplier'|'other'),
--   target_id (uuid, nullable), notes, created_at, updated_at
-- CHECK: type IN ('receipt', 'payment')
-- CHECK: target_type IN ('customer', 'supplier', 'other')

-- 12. stock_adjustments
-- Columns: id (uuid PK), product_id (FK → products), type, quantity,
--   unit_price, note, created_at, updated_at
-- FK: product_id → products.id

-- 13. print_templates
-- Columns: id (uuid PK), name, type, paper_size, content,
--   is_default (boolean), created_at, updated_at


-- ┌──────────────────────────────────────────────────────────┐
-- │  STOCK TRIGGERS                                          │
-- └──────────────────────────────────────────────────────────┘

-- Import INSERT → stock_quantity += quantity
-- Import DELETE → stock_quantity -= quantity (void import)
-- Sales INSERT  → stock_quantity -= quantity
-- Sales DELETE  → stock_quantity += quantity (void sale)

-- ┌──────────────────────────────────────────────────────────┐
-- │  DATABASE FUNCTIONS (RPC)                                │
-- └──────────────────────────────────────────────────────────┘

-- search_products_unaccented(search_term text) → SETOF products
--   Vietnamese-aware product search ignoring diacritics.
--   Usage: supabase.rpc('search_products_unaccented', { search_term: '...' })

-- ┌──────────────────────────────────────────────────────────┐
-- │  RLS POLICIES                                            │
-- └──────────────────────────────────────────────────────────┘
-- All tables use permissive "Allow all" policies (USING: true, WITH CHECK: true)
-- This is intentional for internal/local POS environments without user auth.

-- ┌──────────────────────────────────────────────────────────┐
-- │  INTEGRITY RULES                                         │
-- └──────────────────────────────────────────────────────────┘
-- Products → Categories:       ON DELETE SET NULL
-- Order Items → Orders:        ON DELETE CASCADE
-- Order Items → Products:      ON DELETE RESTRICT
-- Orders → Suppliers/Customers: ON DELETE RESTRICT
