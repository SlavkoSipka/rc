/*
  # Net weight per invoice piece with four decimals

  numeric(8,3) rounded parts lighter than half a gram (a 0.4 g insert) to 0.000 kg, so their
  weight was lost when an invoice remembered it on the product.
*/

ALTER TABLE products ALTER COLUMN net_weight_kg TYPE numeric(9,4);
