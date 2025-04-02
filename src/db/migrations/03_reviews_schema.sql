-- Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT NOT NULL CHECK (length(content) >= 10 AND length(content) <= 2000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (agent_id, user_id)
);

-- Review Images Table
CREATE TABLE IF NOT EXISTS review_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  alt_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Review Replies Table
CREATE TABLE IF NOT EXISTS review_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) >= 10 AND length(content) <= 1000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Review Votes Table
CREATE TABLE IF NOT EXISTS review_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote INTEGER NOT NULL CHECK (vote IN (-1, 0, 1)),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (review_id, user_id)
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_reviews_updated_at
BEFORE UPDATE ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_review_replies_updated_at
BEFORE UPDATE ON review_replies
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_review_votes_updated_at
BEFORE UPDATE ON review_votes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reviews_agent_id ON reviews(agent_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_review_replies_review_id ON review_replies(review_id);
CREATE INDEX IF NOT EXISTS idx_review_votes_review_id ON review_votes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_images_review_id ON review_images(review_id);

-- Create view for review summary by agent
CREATE OR REPLACE VIEW review_summary AS
SELECT 
  agent_id,
  COUNT(*) as total_reviews,
  COALESCE(AVG(rating), 0) as average_rating,
  COUNT(CASE WHEN rating = 5 THEN 1 END) as rating_5,
  COUNT(CASE WHEN rating = 4 THEN 1 END) as rating_4,
  COUNT(CASE WHEN rating = 3 THEN 1 END) as rating_3,
  COUNT(CASE WHEN rating = 2 THEN 1 END) as rating_2,
  COUNT(CASE WHEN rating = 1 THEN 1 END) as rating_1,
  COUNT(CASE WHEN created_at > CURRENT_TIMESTAMP - INTERVAL '30 days' AND rating >= 4 THEN 1 END)::float / 
    NULLIF(COUNT(CASE WHEN created_at > CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 1 END)::float, 0) * 100 as recent_positive_percentage
FROM reviews
GROUP BY agent_id;

-- Function to get credibility badge based on average rating
CREATE OR REPLACE FUNCTION get_credibility_badge(avg_rating FLOAT) 
RETURNS TEXT AS $$
BEGIN
  IF avg_rating >= 4.5 THEN
    RETURN 'outstanding';
  ELSIF avg_rating >= 4.0 THEN
    RETURN 'excellent';
  ELSIF avg_rating >= 3.5 THEN
    RETURN 'good';
  ELSIF avg_rating >= 3.0 THEN
    RETURN 'fair';
  ELSIF avg_rating > 0 THEN
    RETURN 'poor';
  ELSE
    RETURN 'not-rated';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_images ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews
CREATE POLICY read_reviews ON reviews FOR SELECT USING (TRUE);
CREATE POLICY read_review_replies ON review_replies FOR SELECT USING (TRUE);
CREATE POLICY read_review_images ON review_images FOR SELECT USING (TRUE);

-- Drop the existing create_review policy if it exists
DROP POLICY IF EXISTS create_review ON reviews;

-- Create the create_review policy to allow authenticated users to insert reviews
CREATE POLICY create_review ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only the user can update their own review
CREATE POLICY update_review ON reviews FOR UPDATE USING (
  auth.uid() = user_id AND 
  created_at > CURRENT_TIMESTAMP - INTERVAL '48 hours'
);

-- Only the user can delete their own review
CREATE POLICY delete_review ON reviews FOR DELETE USING (
  auth.uid() = user_id
);

-- Only the user can create their own reply
CREATE POLICY create_reply ON review_replies FOR INSERT WITH CHECK (
  auth.uid() = user_id
);

-- Only the user can delete their own reply
CREATE POLICY delete_reply ON review_replies FOR DELETE USING (
  auth.uid() = user_id
);

-- Only the user can vote
CREATE POLICY vote_review ON review_votes FOR INSERT WITH CHECK (
  auth.uid() = user_id
);

CREATE POLICY update_vote ON review_votes FOR UPDATE USING (
  auth.uid() = user_id
);

-- Only the user can upload images for their review
CREATE POLICY upload_images ON review_images FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM reviews 
    WHERE reviews.id = review_id 
    AND reviews.user_id = auth.uid()
  )
);
