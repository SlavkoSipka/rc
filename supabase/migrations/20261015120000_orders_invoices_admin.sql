/*
  # Orders, export invoices and the admin panel

  Run after 20261008120000_product_identifiers.sql.

  1. Admin access
    - `admin_users` lists the e-mails allowed into /admin. The account itself is created in
      Supabase -> Authentication -> Users -> Add user (with "Auto Confirm User").
    - `is_admin()` is true only for a signed-in, e-mail-confirmed user on that list.
    - The old "Authenticated users can update stock" policy let ANY signed-in user change
      products (prices included). Replaced: only admins can update products. Stock is still
      decreased at checkout through the SECURITY DEFINER function update_product_stock.

  2. Invoice data per product (what the export invoice says about each item)
    - `invoice_description`  English - Serbian name for the invoice ("Front bulkhead - Prednja glavčina")
    - `material`, `country_of_origin`, `hs_code`
    - `net_weight_kg`        net weight of ONE invoice piece
    - `pieces_per_unit`      invoice pieces in one sold unit (a set of 8 inserts = 8)
    Pre-filled below from the product titles; the admin panel updates them every time an
    invoice is saved, so corrections are remembered for the next invoice.

  3. Orders
    - `orders` + `order_items`, written at checkout after PayPal captured the payment, through
      `record_order(jsonb)` (SECURITY DEFINER, callable by anon, idempotent per PayPal order).
      Product identifiers are copied from `products` at that moment, not taken from the browser.
    - Only admins can read or change orders.

  4. Invoices
    - `invoices` keeps every issued invoice (number, date and the full content as JSON) so it
      can be downloaded again exactly as issued. Number is unique per prefix and year.
*/

-- 1. Admin access -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_users (
  email text PRIMARY KEY
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

INSERT INTO admin_users (email) VALUES ('boracompany@gmail.com')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.admin_users a ON lower(a.email) = lower(u.email)
    WHERE u.id = auth.uid()
      AND u.email_confirmed_at IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

DROP POLICY IF EXISTS "Authenticated users can update stock" ON products;
DROP POLICY IF EXISTS "Admins can update products" ON products;
CREATE POLICY "Admins can update products"
ON products
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 2. Invoice data per product -------------------------------------------------------------

ALTER TABLE products
ADD COLUMN IF NOT EXISTS invoice_description text,
ADD COLUMN IF NOT EXISTS material text,
ADD COLUMN IF NOT EXISTS net_weight_kg numeric(8,3) CHECK (net_weight_kg IS NULL OR net_weight_kg >= 0),
ADD COLUMN IF NOT EXISTS pieces_per_unit integer NOT NULL DEFAULT 1 CHECK (pieces_per_unit > 0),
ADD COLUMN IF NOT EXISTS country_of_origin text DEFAULT 'Serbia',
ADD COLUMN IF NOT EXISTS hs_code text NOT NULL DEFAULT '9503.0090';

-- 3. Orders -------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'website',
  paypal_order_id text UNIQUE,
  paypal_capture_id text,
  payment_status text,
  payer_email text,
  payer_name text,
  first_name text,
  last_name text,
  phone text,
  address text,
  address2 text,
  city text,
  state text,
  zip_code text,
  country text,
  country_code text,
  currency text NOT NULL DEFAULT 'EUR',
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  shipping numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  notes text
);

CREATE TABLE IF NOT EXISTS order_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  product_id text,
  title text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(10,2) NOT NULL,
  merchant_product_id text,
  manufacturer_product_id text,
  standard_product_id text
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage orders" ON orders;
CREATE POLICY "Admins manage orders" ON orders
FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage order items" ON order_items;
CREATE POLICY "Admins manage order items" ON order_items
FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Called by the checkout right after PayPal captured the payment. Calling it again for the
-- same PayPal order (retry after a network error) returns the existing order unchanged.
CREATE OR REPLACE FUNCTION public.record_order(p_order jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_item jsonb;
  v_position integer := 0;
BEGIN
  IF coalesce(p_order->>'paypal_order_id', '') = '' THEN
    RAISE EXCEPTION 'paypal_order_id is required';
  END IF;
  IF jsonb_typeof(p_order->'items') <> 'array' OR jsonb_array_length(p_order->'items') = 0 THEN
    RAISE EXCEPTION 'An order needs at least one item';
  END IF;

  SELECT id INTO v_order_id FROM orders WHERE paypal_order_id = p_order->>'paypal_order_id';
  IF v_order_id IS NOT NULL THEN
    RETURN v_order_id;
  END IF;

  INSERT INTO orders (
    paypal_order_id, paypal_capture_id, payment_status, payer_email, payer_name,
    first_name, last_name, phone, address, address2, city, state, zip_code, country, country_code,
    currency, subtotal, shipping, total
  ) VALUES (
    left(p_order->>'paypal_order_id', 64),
    left(p_order->>'paypal_capture_id', 64),
    left(p_order->>'payment_status', 32),
    left(p_order->>'payer_email', 254),
    left(p_order->>'payer_name', 200),
    left(p_order->>'first_name', 100),
    left(p_order->>'last_name', 100),
    left(p_order->>'phone', 50),
    left(p_order->>'address', 300),
    left(p_order->>'address2', 300),
    left(p_order->>'city', 100),
    left(p_order->>'state', 100),
    left(p_order->>'zip_code', 30),
    left(p_order->>'country', 100),
    left(p_order->>'country_code', 2),
    coalesce(left(p_order->>'currency', 3), 'EUR'),
    coalesce((p_order->>'subtotal')::numeric, 0),
    coalesce((p_order->>'shipping')::numeric, 0),
    coalesce((p_order->>'total')::numeric, 0)
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order->'items') LOOP
    INSERT INTO order_items (
      order_id, position, product_id, title, quantity, unit_price,
      merchant_product_id, manufacturer_product_id, standard_product_id
    )
    SELECT
      v_order_id,
      v_position,
      left(v_item->>'product_id', 200),
      left(coalesce(v_item->>'title', p.title, v_item->>'product_id'), 300),
      greatest((v_item->>'quantity')::integer, 1),
      coalesce((v_item->>'unit_price')::numeric, 0),
      p.merchant_product_id,
      p.manufacturer_product_id,
      p.standard_product_id
    FROM (SELECT 1) AS one
    LEFT JOIN products p ON p.id = v_item->>'product_id';
    v_position := v_position + 1;
  END LOOP;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_order(jsonb) TO anon, authenticated;

-- 4. Invoices -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  prefix text NOT NULL,
  number integer NOT NULL CHECK (number > 0),
  year integer NOT NULL,
  invoice_date date NOT NULL,
  customer_name text,
  total numeric(10,2),
  data jsonb NOT NULL,
  UNIQUE (prefix, number, year)
);

CREATE INDEX IF NOT EXISTS invoices_order_id_idx ON invoices(order_id);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage invoices" ON invoices;
CREATE POLICY "Admins manage invoices" ON invoices
FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Default invoice data per product, from the product titles -------------------------------
-- (descriptions follow the existing invoices: English - Serbian, no brand names)
UPDATE products SET invoice_description = 'Bearing holder - Nosač ležaja', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'schumacher-procat-xls-bosscat-cougar-black-bearing-holder';
UPDATE products SET invoice_description = 'Bearing holder - Nosač ležaja', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'schumacher-procat-xls-bosscat-cougar-blue-bearing-holder';
UPDATE products SET invoice_description = 'Bearing holder - Nosač ležaja', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'schumacher-procat-xls-bosscat-cougar-red-bearing-holder';
UPDATE products SET invoice_description = 'Bearing holder - Nosač ležaja', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'schumacher-procat-xls-bosscat-cougar-silver-bearing-holder';
UPDATE products SET invoice_description = 'Heat sink - Hladnjak', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-df03-dark-impact-black-heat-sink';
UPDATE products SET invoice_description = 'Heat sink - Hladnjak', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-df03-dark-impact-blue-heat-sink';
UPDATE products SET invoice_description = 'Heat sink - Hladnjak', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-df03-dark-impact-red-heat-sink';
UPDATE products SET invoice_description = 'Heat sink - Hladnjak', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-df03-dark-impact-silver-heat-sink';
UPDATE products SET invoice_description = 'Chassis brace - Ojačanje šasije', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-anodized-d7-chassis-brace';
UPDATE products SET invoice_description = 'Front bulkhead - Prednja glavčina', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-black-bulkhead';
UPDATE products SET invoice_description = 'Gearbox link - Spona menjača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-black-d4-gearbox-link';
UPDATE products SET invoice_description = 'Chassis brace - Ojačanje šasije', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-black-d7-chassis-brace';
UPDATE products SET invoice_description = 'Motor guard link - Spona zaštite motora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-black-e5-motor-guard';
UPDATE products SET invoice_description = 'Upgrade parts set - Set delova za nadogradnju', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-blue-anodized-parts';
UPDATE products SET invoice_description = 'Front bulkhead - Prednja glavčina', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-blue-bulkhead';
UPDATE products SET invoice_description = 'Hinge pin blocks - Nosači osovinica vešanja', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-blue-d2-d1-hinge-pin-blocks';
UPDATE products SET invoice_description = 'Gearbox link - Spona menjača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-blue-d4-gearbox-link';
UPDATE products SET invoice_description = 'Chassis brace - Ojačanje šasije', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-blue-d7-chassis-brace';
UPDATE products SET invoice_description = 'Gearbox link - Spona menjača', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-red-d4-gearbox-link';
UPDATE products SET invoice_description = 'Chassis brace - Ojačanje šasije', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-red-d7-chassis-brace';
UPDATE products SET invoice_description = 'Motor guard link - Spona zaštite motora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-red-e5-motor-guard';
UPDATE products SET invoice_description = 'Front bulkhead - Prednja glavčina', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-silver-anodized-bulkhead';
UPDATE products SET invoice_description = 'Chassis brace - Ojačanje šasije', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-silver-d7-chassis-brace';
UPDATE products SET invoice_description = 'Wing mount - Nosač krila', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-top-force-df01-egress-avante-wing-mount';
UPDATE products SET invoice_description = 'Wing mount - Nosač krila', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-wing-holder-knob';
UPDATE products SET invoice_description = 'Motor mount - Nosač motora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-gearbox-motor-mount-black';
UPDATE products SET invoice_description = 'Motor mount - Nosač motora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-gearbox-motor-mount-blue';
UPDATE products SET invoice_description = 'Motor mount - Nosač motora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-gearbox-motor-mount-red';
UPDATE products SET invoice_description = 'Motor mount - Nosač motora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-gearbox-motor-mount-silver';
UPDATE products SET invoice_description = 'Gearbox reinforcement - Ojačanje menjača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-gearbox-reinforcement-black';
UPDATE products SET invoice_description = 'Gearbox reinforcement - Ojačanje menjača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-gearbox-reinforcement-blue';
UPDATE products SET invoice_description = 'Gearbox reinforcement - Ojačanje menjača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-gearbox-reinforcement-red';
UPDATE products SET invoice_description = 'Gearbox reinforcement - Ojačanje menjača', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-gearbox-reinforcement-set';
UPDATE products SET invoice_description = 'Gearbox reinforcement - Ojačanje menjača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-gearbox-reinforcement-set-red';
UPDATE products SET invoice_description = 'Gearbox reinforcement - Ojačanje menjača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-gearbox-reinforcement-silver';
UPDATE products SET invoice_description = 'Wing mount - Nosač krila', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-manta-ray-df01-black-wing-holder';
UPDATE products SET invoice_description = 'Wing mount - Nosač krila', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-manta-ray-df01-blue-wing-holder';
UPDATE products SET invoice_description = 'Wing mount - Nosač krila', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-manta-ray-df01-wing-holder';
UPDATE products SET invoice_description = 'Steering bell cranks - Poluge upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-super-astute-black-anodized-bell-cranks';
UPDATE products SET invoice_description = 'Steering bell cranks - Poluge upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-super-astute-blue-anodized-bell-cranks';
UPDATE products SET invoice_description = 'Steering bell cranks - Poluge upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-super-astute-red-anodized-bell-cranks';
UPDATE products SET invoice_description = 'Steering bell cranks - Poluge upravljača', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-super-astute-silver-hard-anodized-bell-cranks';
UPDATE products SET invoice_description = 'Gearbox reinforcement - Ojačanje menjača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-ta01-ta02-df01-front-gearbox-reinforcement';
UPDATE products SET invoice_description = 'Undertray - Donja zaštitna ploča', material = 'POM (Delrin)', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-ta01-ta02-df01-pom-undertray';
UPDATE products SET invoice_description = 'Gearbox shaft set - Set osovina menjača', material = 'Steel', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-ta01-ta02-df01-top-force-gearbox-shaft-set';
UPDATE products SET invoice_description = 'Gearbox cover - Poklopac menjača', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-ta02sw-anodized-gearbox-cover';
UPDATE products SET invoice_description = 'Gearbox cover - Poklopac menjača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-ta02sw-blue-gearbox-cover';
UPDATE products SET invoice_description = 'Damper tower mount - Nosač amortizera', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-anodized-1';
UPDATE products SET invoice_description = 'Gearbox cover - Poklopac menjača', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-anodized-gearbox-cover';
UPDATE products SET invoice_description = 'Rear hinge pin brace set - Set zadnjih spona vešanja', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-anodized-hinge-pin-brace';
UPDATE products SET invoice_description = 'Chassis support - Nosač šasije', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-anodized-j4';
UPDATE products SET invoice_description = 'Chassis support - Nosač šasije', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-anodized-j7';
UPDATE products SET invoice_description = 'Servo posts - Nosači servo motora', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-anodized-servo-posts-2';
UPDATE products SET invoice_description = 'Steering brace - Ojačanje upravljača', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-anodized-steering-brace';
UPDATE products SET invoice_description = 'Upgrade parts set - Set delova za nadogradnju', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-anodized-upgrade-kit';
UPDATE products SET invoice_description = 'Damper tower mount - Nosač amortizera', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-black';
UPDATE products SET invoice_description = 'Gearbox cover - Poklopac menjača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-black-gearbox-cover';
UPDATE products SET invoice_description = 'Rear hinge pin brace set - Set zadnjih spona vešanja', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-black-hinge-pin-brace';
UPDATE products SET invoice_description = 'Chassis support - Nosač šasije', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-black-j3';
UPDATE products SET invoice_description = 'Chassis support - Nosač šasije', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-black-j4';
UPDATE products SET invoice_description = 'Chassis support - Nosač šasije', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-black-j7';
UPDATE products SET invoice_description = 'Servo posts - Nosači servo motora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-black-servo-posts';
UPDATE products SET invoice_description = 'Steering brace - Ojačanje upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-black-steering-brace';
UPDATE products SET invoice_description = 'Upgrade parts set - Set delova za nadogradnju', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-black-upgrade-kit';
UPDATE products SET invoice_description = 'Damper tower mount - Nosač amortizera', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-blue';
UPDATE products SET invoice_description = 'Rear hinge pin brace set - Set zadnjih spona vešanja', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-blue-hinge-pin-brace';
UPDATE products SET invoice_description = 'Chassis support - Nosač šasije', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-blue-j4';
UPDATE products SET invoice_description = 'Chassis support - Nosač šasije', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-blue-j7';
UPDATE products SET invoice_description = 'Servo posts - Nosači servo motora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-blue-servo-posts';
UPDATE products SET invoice_description = 'Steering brace - Ojačanje upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-blue-steering-brace';
UPDATE products SET invoice_description = 'Steering brace - Ojačanje upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-blue-steering-brace-2';
UPDATE products SET invoice_description = 'Chassis support - Nosač šasije', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-hard-anodized-j3';
UPDATE products SET invoice_description = 'Chassis support - Nosač šasije', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-red-j4';
UPDATE products SET invoice_description = 'Servo posts - Nosači servo motora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-red-servo-posts';
UPDATE products SET invoice_description = 'Steering brace - Ojačanje upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-red-steering-brace';
UPDATE products SET invoice_description = 'Upgrade parts set - Set delova za nadogradnju', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-red-upgrade-kit';
UPDATE products SET invoice_description = 'Damper tower mount - Nosač amortizera', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-sc3-damper-mount';
UPDATE products SET invoice_description = 'Damper tower mount - Nosač amortizera', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-silver';
UPDATE products SET invoice_description = 'Upgrade parts set - Set delova za nadogradnju', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-silver-anodized-upgrade-kit';
UPDATE products SET invoice_description = 'Gearbox cover - Poklopac menjača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-silver-gearbox-cover';
UPDATE products SET invoice_description = 'Chassis support - Nosač šasije', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-silver-j3';
UPDATE products SET invoice_description = 'Chassis support - Nosač šasije', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-silver-j4';
UPDATE products SET invoice_description = 'Chassis support - Nosač šasije', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-silver-j7';
UPDATE products SET invoice_description = 'Servo posts - Nosači servo motora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-silver-servo-posts';
UPDATE products SET invoice_description = 'Steering brace - Ojačanje upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-silver-steering-brace';
UPDATE products SET invoice_description = 'Upgrade parts set - Set delova za nadogradnju', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-silver-upgrade-kit';
UPDATE products SET invoice_description = 'Wing mount - Nosač krila', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-wing-holder';
UPDATE products SET invoice_description = 'Wing mount - Nosač krila', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-wing-holder-blue';
UPDATE products SET invoice_description = 'Wing mount - Nosač krila', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-wing-holder-red';
UPDATE products SET invoice_description = 'Wing mount - Nosač krila', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-wing-holder-silver';
UPDATE products SET invoice_description = 'Hinge pin brace - Spona vešanja', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = 0.005, country_of_origin = 'Serbia' WHERE id = 'tamiya-trf201-211-201xmw-black-anodized-hinge-pin-brace';
UPDATE products SET invoice_description = 'Arm mount - Nosač ramena', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-trf201-211-201xmw-black-rear-arm-mount';
UPDATE products SET invoice_description = 'Hinge pin brace - Spona vešanja', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = 0.005, country_of_origin = 'Serbia' WHERE id = 'tamiya-trf201-211-201xmw-blue-anodized-hinge-pin-brace';
UPDATE products SET invoice_description = 'Arm mount - Nosač ramena', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-trf201-211-201xmw-blue-rear-arm-mount';
UPDATE products SET invoice_description = 'Hinge pin brace - Spona vešanja', material = 'Brass', pieces_per_unit = 1, net_weight_kg = 0.005, country_of_origin = 'Serbia' WHERE id = 'tamiya-trf201-211-201xmw-brass-hinge-pin-brace';
UPDATE products SET invoice_description = 'Arm mount - Nosač ramena', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-trf201-211-201xmw-red-rear-arm-mount';
UPDATE products SET invoice_description = 'Hinge pin brace - Spona vešanja', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = 0.005, country_of_origin = 'Serbia' WHERE id = 'tamiya-trf201-211-201xmw-silver-anodized-hinge-pin-brace';
UPDATE products SET invoice_description = 'Arm mount - Nosač ramena', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-trf201-211-201xmw-silver-rear-arm-mount';
UPDATE products SET invoice_description = 'Prop shaft bearing clamp - Obujmica ležaja kardana', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-tt02-black-prop-shaft-bearing-clamp';
UPDATE products SET invoice_description = 'Prop shaft bearing clamp - Obujmica ležaja kardana', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-tt02-blue-prop-shaft-bearing-clamp';
UPDATE products SET invoice_description = 'Prop shaft bearing clamp - Obujmica ležaja kardana', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-tt02-red-prop-shaft-bearing-clamp';
UPDATE products SET invoice_description = 'Prop shaft bearing clamp - Obujmica ležaja kardana', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-tt02-silver-prop-shaft-bearing-clamp';
UPDATE products SET invoice_description = 'Ball connectors - Kuglasti zglobovi', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-vqs-carbon-ball-connectors';
UPDATE products SET invoice_description = 'Spur gear pressure plate - Potisna ploča zupčanika', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-xv01-td4-spur-gear-flange-pressure-plate';
UPDATE products SET invoice_description = 'Servo posts - Nosači servo motora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-red-servo-posts-proba';
UPDATE products SET invoice_description = 'Wheel hex adapter - Adapter točka', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-12mm-hex-adapers';
UPDATE products SET invoice_description = 'Anti-roll bar kit - Set stabilizatora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-stabilizer-anti-roll-bar-set';
UPDATE products SET invoice_description = 'Upgrade parts set - Set delova za nadogradnju', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-blue-aluminium-upgrade-kit';
UPDATE products SET invoice_description = 'Upgrade parts set - Set delova za nadogradnju', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'yokomo-super-dogfighter-rere-yz-870c-aluminium-upgrade-kit-anodized-red';
UPDATE products SET invoice_description = 'Upgrade parts set - Set delova za nadogradnju', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-dlaster-tr15t-aluminium-blue-anodized-upgrade-kit';
UPDATE products SET invoice_description = 'Upgrade parts set - Set delova za nadogradnju', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-dlaster-tr15t-aluminium-black-anodized-upgrade-kit';
UPDATE products SET invoice_description = 'Upgrade parts set - Set delova za nadogradnju', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-dlaster-tr15t-aluminium-silver-hard-anodized-upgrade-kit';
UPDATE products SET invoice_description = 'Bulkheads - Glavčine', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'yokomo-super-dogfighter-rere-yz-870c-aluminium-bulkheads-anodized-black';
UPDATE products SET invoice_description = 'Bulkheads - Glavčine', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'yokomo-super-dogfighter-rere-yz-870c-aluminium-bulkheads-hard-anodized-silver';
UPDATE products SET invoice_description = 'Motor mount - Nosač motora', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'yokomo-super-dogfighter-rere-yz-870c-aluminium-bulkheads-anodized-blue';
UPDATE products SET invoice_description = 'Motor mount - Nosač motora', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'yokomo-dogfighter-rere-yz-870c-aluminium-bulkheads-anodized-black';
UPDATE products SET invoice_description = 'Motor mount - Nosač motora', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'yokomo-dogfighter-rere-yz-870c-aluminium-bulkheads-hard-anodized-silver';
UPDATE products SET invoice_description = 'Anti-roll bar kit - Set stabilizatora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-silver-anodized-sway-anti-roll-bar-ball-ends-clamps-and-sway-bar-rod-kit';
UPDATE products SET invoice_description = 'Anti-roll bar kit - Set stabilizatora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-blue-anodized-sway-anti-roll-bar-ball-ends-clamps-and-sway-bar-rod-kit';
UPDATE products SET invoice_description = 'Anti-roll bar kit - Set stabilizatora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-red-anodized-sway-anti-roll-bar-ball-ends-clamps-and-sway-bar-rod-kit';
UPDATE products SET invoice_description = 'Front bulkhead - Prednja glavčina', material = 'Brass', pieces_per_unit = 1, net_weight_kg = 0.039, country_of_origin = 'Serbia' WHERE id = 'tamiya-trf201-211-201-xmw-brass-bulkhead';
UPDATE products SET invoice_description = 'C-hubs - C nosači točka', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster--tr15t-aluminium-red-anodized-h1-h2-c-hubs';
UPDATE products SET invoice_description = 'Rear bulkhead damper mount - Nosač amortizera zadnje glavčine', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-super-astute-aluminium-silver-d4-rear-bulkhead-damper-tower-mount';
UPDATE products SET invoice_description = 'Rear bulkhead damper mount - Nosač amortizera zadnje glavčine', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-super-astute-aluminium-black-anodized-d4-rear-bulkhead-damper-tower-mount';
UPDATE products SET invoice_description = 'Rear bulkhead damper mount - Nosač amortizera zadnje glavčine', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-super-astute-aluminium-blue-anodized-d4-rear-bulkhead-damper-tower-mount';
UPDATE products SET invoice_description = 'Rear bulkhead damper mount - Nosač amortizera zadnje glavčine', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-super-astute-aluminium-red-anodized-d4-rear-bulkhead-damper-tower-mount';
UPDATE products SET invoice_description = 'Rear bulkhead damper mount - Nosač amortizera zadnje glavčine', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-super-astute-aluminium-silver-anodized-d4-rear-bulkhead-damper-tower-mount';
UPDATE products SET invoice_description = 'Steering bell cranks - Poluge upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-aluminium-blue-anodized-h3-h4-bellcranks';
UPDATE products SET invoice_description = 'Steering bell cranks - Poluge upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-aluminium-black-anodized-h3-h4-bellcranks';
UPDATE products SET invoice_description = 'Steering bell cranks - Poluge upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-aluminium-red-anodized-h3-h4-bellcranks';
UPDATE products SET invoice_description = 'Steering bell cranks - Poluge upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-aluminium-silver-anodized-h3-h4-bellcranks';
UPDATE products SET invoice_description = 'C-hubs - C nosači točka', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-aluminium-black-anodized-h1-h2-c-hubs';
UPDATE products SET invoice_description = 'C-hubs - C nosači točka', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-aluminium-silver-anodized-h1-h2-c-hubs';
UPDATE products SET invoice_description = 'C-hubs - C nosači točka', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-aluminium-blue-anodized-h1-h2-c-hubs';
UPDATE products SET invoice_description = 'Bulkheads - Glavčine', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'yokomo-super-dogfighter-rere-yz-870c-aluminium-bulkheads-blue-anodized';
UPDATE products SET invoice_description = 'Front bulkhead - Prednja glavčina', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-trf201-211-201-xmw-hard-anodized-silver-aluminium-bulkhead';
UPDATE products SET invoice_description = 'Front bulkhead - Prednja glavčina', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-trf201-211-201-xmw-hard-anodized-blue-aluminium-bulkhead';
UPDATE products SET invoice_description = 'Front bulkhead - Prednja glavčina', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-trf201-211-201-xmw-hard-anodized-black-aluminium-bulkhead';
UPDATE products SET invoice_description = 'Gearbox cover - Poklopac menjača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-ta02sw-red-gearbox-cover';
UPDATE products SET invoice_description = 'Gearbox reinforcement - Ojačanje menjača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-gearbox-reinforcement-set-black';
UPDATE products SET invoice_description = 'Gearbox reinforcement - Ojačanje menjača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-gearbox-reinforcement-set-blue';
UPDATE products SET invoice_description = 'Damper tower mount - Nosač amortizera', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-red';
UPDATE products SET invoice_description = 'Gearbox cover - Poklopac menjača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-blue-gearbox-cover';
UPDATE products SET invoice_description = 'Gearbox cover - Poklopac menjača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-red-gearbox-cover';
UPDATE products SET invoice_description = 'Rear hinge pin brace set - Set zadnjih spona vešanja', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-red-hinge-pin-brace';
UPDATE products SET invoice_description = 'Hinge pin insert - Umetak spone', material = 'POM (Delrin)', pieces_per_unit = 8, net_weight_kg = 0.001, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Top-Force-and-TRF201-Inserts-black';
UPDATE products SET invoice_description = 'Hinge pin insert - Umetak spone', material = 'POM (Delrin)', pieces_per_unit = 8, net_weight_kg = 0.001, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Top-Force-and-TRF201-Inserts-white';
UPDATE products SET invoice_description = 'Steering brace - Ojačanje upravljača', material = 'Brass', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-brass-steering-brace';
UPDATE products SET invoice_description = 'Wheel hex adapter - Adapter točka', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = '12mm-Hex-Adapter-4mm-Red';
UPDATE products SET invoice_description = 'Wheel hex adapter - Adapter točka', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = '12mm-Hex-Adapter-5mm-Blue';
UPDATE products SET invoice_description = 'Wheel hex adapter - Adapter točka', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = '12mm-Hex-Adapter-6mm-Hard-Silver';
UPDATE products SET invoice_description = 'Wheel hex adapter - Adapter točka', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = '12mm-Hex-Adapter-7mm-Black';
UPDATE products SET invoice_description = 'Anti-roll bar ball ends - Krajevi stabilizatora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Ball-Ends-Black';
UPDATE products SET invoice_description = 'Anti-roll bar ball ends - Krajevi stabilizatora', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Ball-Ends-Hard-Silver';
UPDATE products SET invoice_description = 'Anti-roll bar ball ends - Krajevi stabilizatora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Ball-Ends-Blue';
UPDATE products SET invoice_description = 'Anti-roll bar ball ends - Krajevi stabilizatora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Ball-Ends-Red';
UPDATE products SET invoice_description = 'Anti-roll bar rods - Šipke stabilizatora', material = 'Steel', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Stabilizer-Rods';
UPDATE products SET invoice_description = 'Anti-roll bar clamps - Obujmice stabilizatora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Black-Clamps-For-Stabilizer-Rods';
UPDATE products SET invoice_description = 'Anti-roll bar clamps - Obujmice stabilizatora', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Hard-Silver-Clamps-For-Stabilizer-Rods';
UPDATE products SET invoice_description = 'Anti-roll bar clamps - Obujmice stabilizatora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Blue-Clamps-For-Stabilizer-Rods';
UPDATE products SET invoice_description = 'Anti-roll bar clamps - Obujmice stabilizatora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Red-Clamps-For-Stabilizer-Rods';
UPDATE products SET invoice_description = 'Bulkheads - Glavčine', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'yokomo-super-dogfighter-rere-yz-870c-aluminium-bulkheads-blue-anodized-outlet';
UPDATE products SET invoice_description = 'Bulkheads - Glavčine', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'yokomo-super-dogfighter-rere-yz-870c-aluminium-bulkheads-hard-anodized-silver-outlet';
UPDATE products SET invoice_description = 'Rear anti-roll bar set - Set zadnjeg stabilizatora', material = NULL, pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = NULL WHERE id = '4WD-Touring-&-Rally-Car-Rear-Stabilizer-Set-53189';
UPDATE products SET invoice_description = 'Idler gear brace - Ojačanje zupčanika', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Super-Astute-Silver-A1-Counter-Brace';
UPDATE products SET invoice_description = 'Idler gear brace - Ojačanje zupčanika', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Super-Astute-Black-A1-Counter-Brace';
UPDATE products SET invoice_description = 'Idler gear brace - Ojačanje zupčanika', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Super-Astute-Blue-A1-Counter-Brace';
UPDATE products SET invoice_description = 'Idler gear brace - Ojačanje zupčanika', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Super-Astute-Red-A1-Counter-Brace';
UPDATE products SET invoice_description = 'Idler gear brace - Ojačanje zupčanika', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Super-Astute-Hard-Silver-A1-Counter-Brace';
UPDATE products SET invoice_description = 'Arm mount - Nosač ramena', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Super-Astute-Hard-Silver-D1-Arm-Mount';
UPDATE products SET invoice_description = 'Arm mount - Nosač ramena', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Super-Astute-Blue-D1-Arm-Mount';
UPDATE products SET invoice_description = 'Arm mount - Nosač ramena', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Super-Astute-Black-D1-Arm-Mount';
UPDATE products SET invoice_description = 'Wheel hubs - Glavčine točka', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tenth-Technology-Predator-XK98-black-wheel-hubs';
UPDATE products SET invoice_description = 'Wheel hubs - Glavčine točka', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tenth-Technology-Predator-XK98-silver-wheel-hubs';
UPDATE products SET invoice_description = 'Steering posts - Stubovi upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Top-Force-Standoff';
UPDATE products SET invoice_description = 'Steering posts - Stubovi upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-TA02SW-Standoff';
UPDATE products SET invoice_description = 'Gearbox reinforcement - Ojačanje menjača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-ta01-ta02-df01-blue-front-gearbox-reinforcement';
UPDATE products SET invoice_description = 'Gearbox reinforcement - Ojačanje menjača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-ta01-ta02-df01-black-front-gearbox-reinforcement';
UPDATE products SET invoice_description = 'Arm mount - Nosač ramena', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Super-Astute-Silver-D1-Arm-Mount';
UPDATE products SET invoice_description = 'Upgrade parts set - Set delova za nadogradnju', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'yokomo-super-dogfighter-rere-yz-870c-aluminium-upgrade-kit-anodized-silver';
UPDATE products SET invoice_description = 'Motor mount - Nosač motora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'yokomo-super-dogfighter-rere-yz870c-silver-motor-mount';
UPDATE products SET invoice_description = 'Chassis and damper post set - Set stubova šasije i amortizera', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Top-Force-Evo-Post-Set';
UPDATE products SET invoice_description = 'Chassis and damper post set - Set stubova šasije i amortizera', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Top-Force-Post-Set';
UPDATE products SET invoice_description = 'Wheel hubs - Glavčine točka', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tenth-Technology-Predator-XK98-blue-wheel-hubs';
UPDATE products SET invoice_description = 'Steering bell cranks - Poluge upravljača', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Team-Losi-XX4-Silver-hard-anodized-Bell-Cranks';
UPDATE products SET invoice_description = 'Steering bell cranks - Poluge upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Team-Losi-XX4-Blue-Bell-Cranks';
UPDATE products SET invoice_description = 'Steering bell cranks - Poluge upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Team-Losi-XX4-Black-Bell-Cranks';
UPDATE products SET invoice_description = 'Steering bell cranks - Poluge upravljača', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-TA02SW-Silver-Hard-Andodized-Bell-Cranks';
UPDATE products SET invoice_description = 'Steering bell cranks - Poluge upravljača', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-TA02SW-Blue-Andodized-Bell-Cranks';
UPDATE products SET invoice_description = 'Steering bell cranks - Poluge upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-TA02SW-Black-Andodized-Bell-Cranks';
UPDATE products SET invoice_description = 'Steering bell cranks - Poluge upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-super-astute-silver-anodized-bell-cranks';
UPDATE products SET invoice_description = 'Chassis support - Nosač šasije', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-blue-j3';
UPDATE products SET invoice_description = 'Chassis support - Nosač šasije', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-red-j3';
UPDATE products SET invoice_description = 'Chassis support - Nosač šasije', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-top-force-df01-red-j7';
UPDATE products SET invoice_description = 'Arm mount insert - Umetak nosača ramena', material = 'POM (Delrin)', pieces_per_unit = 8, net_weight_kg = 0.001, country_of_origin = 'Serbia' WHERE id = 'tamiya-super-astute-pom-white-inserts';
UPDATE products SET invoice_description = 'Arm mount insert - Umetak nosača ramena', material = 'POM (Delrin)', pieces_per_unit = 8, net_weight_kg = 0.001, country_of_origin = 'Serbia' WHERE id = 'tamiya-super-astute-pom-black-inserts';
UPDATE products SET invoice_description = 'Steering bell cranks - Poluge upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Team-Losi-XX4-red-anodized-Bell-Cranks';
UPDATE products SET invoice_description = 'Steering bell cranks - Poluge upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-TA02SW-Red-Andodized-Bell-Cranks';
UPDATE products SET invoice_description = 'Hinge pin blocks - Nosači osovinica vešanja', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-red-d2-d1-hinge-pin-blocks';
UPDATE products SET invoice_description = 'Hinge pin blocks - Nosači osovinica vešanja', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-black-d2-d1-hinge-pin-blocks';
UPDATE products SET invoice_description = 'Hinge pin blocks - Nosači osovinica vešanja', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-hard-anodized-silver-d2-d1-hinge-pin-blocks';
UPDATE products SET invoice_description = 'Motor guard link - Spona zaštite motora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-blue-e5-motor-guard';
UPDATE products SET invoice_description = 'Motor guard link - Spona zaštite motora', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-silver-hard-anodized-e5-motor-guard';
UPDATE products SET invoice_description = 'Gearbox link - Spona menjača', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-tr15t-silver-hard-anodized-d4-gearbox-link';
UPDATE products SET invoice_description = 'Arm mount - Nosač ramena', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Super-Astute-Red-D1-Arm-Mount';
UPDATE products SET invoice_description = 'Steering bell cranks - Poluge upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Team-Losi-XX4-Blue-Bell-Cranks-outlet';
UPDATE products SET invoice_description = 'Steering bell cranks - Poluge upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-dyna-storm-blaster-aluminium-black-anodized-h3-h4-bellcranks-outlet';
UPDATE products SET invoice_description = 'Steering bell cranks - Poluge upravljača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-super-astute-red-anodized-bell-cranks-outlet';
UPDATE products SET invoice_description = 'Front bulkhead - Prednja glavčina', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Astute-Silver-Front-Bulkhead';
UPDATE products SET invoice_description = 'Front bulkhead - Prednja glavčina', material = 'Aluminium 6082, hard anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Astute-Silver-Hard-Anoized-Front-Bulkhead';
UPDATE products SET invoice_description = 'Front bulkhead - Prednja glavčina', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Astute-Red-Anoized-Front-Bulkhead';
UPDATE products SET invoice_description = 'Front bulkhead - Prednja glavčina', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Astute-Black-Anoized-Front-Bulkhead';
UPDATE products SET invoice_description = 'Gearbox cover - Poklopac menjača', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'tamiya-ta02sw-black-anodized-gearbox-cover';
UPDATE products SET invoice_description = 'Motor mount - Nosač motora', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'yokomo-super-dogfighter-rere-yz870c-red-motor-mount';
UPDATE products SET invoice_description = 'Bulkheads - Glavčine', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'yokomo-super-dogfighter-rere-yz870c-red-bulkheads';
UPDATE products SET invoice_description = 'Front bulkhead - Prednja glavčina', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Astute-Silver-Front-Bulkhead-Outlet';
UPDATE products SET invoice_description = 'Front bulkhead - Prednja glavčina', material = 'Aluminium 6082, anodized', pieces_per_unit = 1, net_weight_kg = NULL, country_of_origin = 'Serbia' WHERE id = 'Tamiya-Astute-Blue-Anoized-Front-Bulkhead';
