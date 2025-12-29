/*
  # Create function to update product stock

  1. New Functions
    - `update_product_stock` - Function to safely decrease product stock
      - Takes product_id and quantity parameters
      - Decreases stock by quantity if sufficient stock available
      - Returns success/failure status

  2. Security
    - Function can be called by authenticated and anonymous users
    - Includes stock validation to prevent negative stock
*/

-- Create function to update product stock
CREATE OR REPLACE FUNCTION update_product_stock(
  product_id text,
  quantity integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_stock integer;
  result json;
BEGIN
  -- Get current stock
  SELECT stock INTO current_stock
  FROM products
  WHERE id = product_id;
  
  -- Check if product exists
  IF current_stock IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Product not found'
    );
  END IF;
  
  -- Check if sufficient stock
  IF current_stock < quantity THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient stock',
      'available_stock', current_stock
    );
  END IF;
  
  -- Update stock
  UPDATE products
  SET stock = stock - quantity,
      updated_at = now()
  WHERE id = product_id;
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'new_stock', current_stock - quantity
  );
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION update_product_stock(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION update_product_stock(text, integer) TO anon;