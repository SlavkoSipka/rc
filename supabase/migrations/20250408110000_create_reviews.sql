/*
  # Create product reviews table

  1. New Tables
    - `product_reviews`
      - `id` (uuid, primary key) - Review identifier
      - `product_id` (text) - Product identifier (references products)
      - `first_name` (text) - Reviewer's first name
      - `last_name` (text) - Reviewer's last name
      - `email` (text) - Reviewer's email
      - `rating` (integer) - Rating from 1-5
      - `comment` (text) - Review comment/description
      - `approved` (boolean) - Whether review is approved by admin
      - `created_at` (timestamp) - Creation timestamp

  2. Security
    - Enable RLS on product_reviews table
    - Allow public to insert reviews (unapproved by default)
    - Allow public to read only approved reviews
    - Allow authenticated users to update approval status
*/

CREATE TABLE IF NOT EXISTS product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create index for faster product queries
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_approved ON product_reviews(approved);

-- Enable RLS
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

-- Allow public to insert reviews (they will be unapproved by default)
CREATE POLICY "Anyone can submit a review" 
ON product_reviews
FOR INSERT 
TO public
WITH CHECK (approved = false);

-- Allow public to read only approved reviews
CREATE POLICY "Approved reviews are viewable by everyone" 
ON product_reviews
FOR SELECT 
TO public
USING (approved = true);

-- Allow authenticated users to view all reviews (for admin panel)
CREATE POLICY "Authenticated users can view all reviews"
ON product_reviews
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update reviews (for approval)
CREATE POLICY "Authenticated users can update reviews"
ON product_reviews
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to delete reviews
CREATE POLICY "Authenticated users can delete reviews"
ON product_reviews
FOR DELETE
TO authenticated
USING (true);

