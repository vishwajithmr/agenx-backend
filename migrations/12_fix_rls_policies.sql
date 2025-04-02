-- Ensure RLS is enabled for the reviews table
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Allow users to update their own reviews within 48 hours
CREATE POLICY update_own_reviews ON reviews
  FOR UPDATE
  USING (auth.uid() = user_id AND created_at > CURRENT_TIMESTAMP - INTERVAL '48 hours');
