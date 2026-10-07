/*
  # EU customs product identifiers (PID), required from 1 November 2026

  Every B2C parcel shipped from outside the EU to an EU buyer must declare, per item:
    - M-PID  (TARIC code C127) - the seller's own product code (SKU)           -> mandatory
    - NS-PID (TARIC code C128) - the manufacturer's part / model number        -> mandatory
    - S-PID  (TARIC code C129) - a standard barcode (GTIN / EAN / UPC), only if one exists;
                                 when there is none the declaration uses code Y081 instead

  1. Columns on products
    - `merchant_product_id`     M-PID, unique, assigned automatically (CRC-0001, CRC-0002, ...)
    - `manufacturer_product_id` NS-PID. Our own parts get our own part number (CRCP-0001, ...),
                                resold third-party items get the maker's number (Tamiya 53189)
    - `standard_product_id`     S-PID (GTIN/EAN/UPC digits), NULL when the product has none
    - `standard_product_id_type` generated: 'C129' when there is a barcode, otherwise 'Y081'
  2. Existing rows are numbered in the order they were created, new rows get the next number
  3. RPC `set_product_identifiers` - SECURITY DEFINER, callable by anon, checks the same
     admin secret as `set_product_is_new`
*/

CREATE SEQUENCE IF NOT EXISTS product_merchant_id_seq;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS merchant_product_id text,
ADD COLUMN IF NOT EXISTS manufacturer_product_id text,
ADD COLUMN IF NOT EXISTS standard_product_id text;

-- Number existing products in creation order: CRC-0001 / CRCP-0001, ...
WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS n
  FROM products
  WHERE merchant_product_id IS NULL
)
UPDATE products p
SET merchant_product_id = 'CRC-' || lpad(numbered.n::text, 4, '0'),
    manufacturer_product_id = COALESCE(p.manufacturer_product_id, 'CRCP-' || lpad(numbered.n::text, 4, '0'))
FROM numbered
WHERE p.id = numbered.id;

-- Not made by us: a new-in-package Tamiya part, its manufacturer number is Tamiya's item number
UPDATE products
SET manufacturer_product_id = '53189'
WHERE id = '4WD-Touring-&-Rally-Car-Rear-Stabilizer-Set-53189';

SELECT setval(
  'product_merchant_id_seq',
  GREATEST((SELECT count(*) FROM products), 1)
);

ALTER TABLE products
ALTER COLUMN merchant_product_id
SET DEFAULT 'CRC-' || lpad(nextval('product_merchant_id_seq')::text, 4, '0');

ALTER TABLE products
ALTER COLUMN merchant_product_id SET NOT NULL;

ALTER TABLE products
ADD CONSTRAINT products_merchant_product_id_key UNIQUE (merchant_product_id);

ALTER TABLE products
ADD CONSTRAINT products_standard_product_id_format
CHECK (standard_product_id IS NULL OR standard_product_id ~ '^([0-9]{8}|[0-9]{12,14})$');

ALTER TABLE products
ADD COLUMN IF NOT EXISTS standard_product_id_type text
GENERATED ALWAYS AS (CASE WHEN standard_product_id IS NULL THEN 'Y081' ELSE 'C129' END) STORED;

-- New products made by us get the matching part number (CRC-0218 -> CRCP-0218)
CREATE OR REPLACE FUNCTION public.default_manufacturer_product_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.manufacturer_product_id IS NULL OR NEW.manufacturer_product_id = '' THEN
    NEW.manufacturer_product_id := regexp_replace(NEW.merchant_product_id, '^CRC-', 'CRCP-');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_default_manufacturer_product_id ON products;
CREATE TRIGGER products_default_manufacturer_product_id
  BEFORE INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION public.default_manufacturer_product_id();

CREATE OR REPLACE FUNCTION public.set_product_identifiers(
  p_id text,
  p_merchant_product_id text,
  p_manufacturer_product_id text,
  p_standard_product_id text,
  p_secret text
)
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
  IF nullif(trim(p_merchant_product_id), '') IS NULL OR nullif(trim(p_manufacturer_product_id), '') IS NULL THEN
    RAISE EXCEPTION 'Merchant and manufacturer product ID are both required';
  END IF;
  UPDATE products
  SET merchant_product_id = trim(p_merchant_product_id),
      manufacturer_product_id = trim(p_manufacturer_product_id),
      standard_product_id = nullif(trim(p_standard_product_id), '')
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_product_identifiers(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_product_identifiers(text, text, text, text, text) TO anon, authenticated;
