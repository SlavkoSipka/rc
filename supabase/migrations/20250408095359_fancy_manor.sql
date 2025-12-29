/*
  # Create products table with stock tracking

  1. New Tables
    - `products`
      - `id` (text, primary key) - Product identifier
      - `stock` (integer) - Current stock quantity
      - `price` (numeric) - Product price
      - `created_at` (timestamp) - Creation timestamp
      - `updated_at` (timestamp) - Last update timestamp

  2. Security
    - Enable RLS on products table
    - Add policy for public read access
    - Add policy for authenticated users to update stock
*/

CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  stock integer NOT NULL DEFAULT 0,
  price numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Products are viewable by everyone" 
ON products
FOR SELECT 
TO public
USING (true);

-- Allow authenticated users to update stock
CREATE POLICY "Authenticated users can update stock"
ON products
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();