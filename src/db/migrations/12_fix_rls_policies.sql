-- Ensure RLS is enabled for the reviews table
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Drop the existing create_review policy if it exists
DROP POLICY IF EXISTS create_review ON reviews;

-- Temporarily relax the create_review policy for debugging
CREATE POLICY create_review ON reviews FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to update their own reviews within 48 hours
CREATE POLICY update_own_reviews ON reviews
  FOR UPDATE
  USING (auth.uid() = user_id AND created_at > CURRENT_TIMESTAMP - INTERVAL '48 hours');
