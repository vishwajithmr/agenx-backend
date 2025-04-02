-- Add images column to the reviews table
ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

-- Update any RLS policies that might need to include the new column
ALTER POLICY update_review ON reviews FOR UPDATE
USING (auth.uid() = user_id AND created_at > CURRENT_TIMESTAMP - INTERVAL '48 hours');
