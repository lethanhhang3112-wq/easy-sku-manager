
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.search_products_unaccented(search_term text)
RETURNS SETOF public.products
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.products
  WHERE unaccent(name) ILIKE unaccent('%' || search_term || '%')
     OR unaccent(code) ILIKE unaccent('%' || search_term || '%')
  ORDER BY name
  LIMIT 20;
$$;
