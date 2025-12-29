/*
  # Add notifications table for site-wide announcements

  1. New Tables
    - `notifications`
      - `id` (uuid, primary key)
      - `message` (text) - The notification message
      - `active` (boolean) - Whether the notification is currently active
      - `start_date` (timestamptz) - When the notification should start showing
      - `end_date` (timestamptz, optional) - When the notification should stop showing
      - `type` (text) - Type of notification (info, warning, error, success)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on notifications table
    - Add policy for public read access to active notifications
    - Add policy for authenticated users to manage notifications
*/

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public can view active notifications" 
ON notifications 
FOR SELECT 
TO public 
USING (
  active = true 
  AND start_date <= now() 
  AND (end_date IS NULL OR end_date > now())
);

CREATE POLICY "Authenticated users can manage notifications" 
ON notifications 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Create updated_at trigger
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert example notification
INSERT INTO notifications (message, type) 
VALUES ('Welcome to Custom RC Parts! Free shipping on orders over €100', 'info');