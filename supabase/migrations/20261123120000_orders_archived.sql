-- Orders the seller has finished with are moved out of the list in the admin panel (not deleted)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
