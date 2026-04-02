/*
  # Product "new" flag for HomePage "New Products" section

  1. Column `is_new` on products (boolean, default false)
  2. Table `app_config` stores admin secret for RPC (update via Supabase SQL when deploying)
  3. RPC `set_product_is_new` — SECURITY DEFINER, callable by anon; checks secret
*/

ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_new boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

INSERT INTO app_config (key, value)
VALUES ('product_is_new_secret', 'changeme')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_product_is_new(p_id text, p_is_new boolean, p_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expected text;
BEGIN
  SELECT value INTO expected FROM app_config WHERE key = 'product_is_new_secret' LIMIT 1;
  IF expected IS NULL THEN
    RAISE EXCEPTION 'Server misconfiguration';
  END IF;
  IF p_secret IS NULL OR p_secret <> expected THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE products SET is_new = p_is_new WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_product_is_new(text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_product_is_new(text, boolean, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_product_admin_secret(p_secret text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expected text;
BEGIN
  SELECT value INTO expected FROM app_config WHERE key = 'product_is_new_secret' LIMIT 1;
  IF expected IS NULL THEN
    RETURN false;
  END IF;
  RETURN p_secret IS NOT NULL AND p_secret = expected;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_product_admin_secret(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_product_admin_secret(text) TO anon, authenticated;
