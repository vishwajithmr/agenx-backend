-- Create review_summary view for agent review statistics
CREATE OR REPLACE VIEW public.review_summary AS
WITH rating_counts AS (
  SELECT
    agent_id,
    COUNT(*) FILTER (WHERE rating = 1) AS rating_1_count,
    COUNT(*) FILTER (WHERE rating = 2) AS rating_2_count,
    COUNT(*) FILTER (WHERE rating = 3) AS rating_3_count,
    COUNT(*) FILTER (WHERE rating = 4) AS rating_4_count,
    COUNT(*) FILTER (WHERE rating = 5) AS rating_5_count,
    COUNT(*) AS total_reviews,
    COALESCE(AVG(rating), 0) AS average_rating
  FROM
    public.reviews
  GROUP BY
    agent_id
),
recent_reviews AS (
  SELECT
    agent_id,
    COUNT(*) FILTER (WHERE rating >= 4 AND created_at > NOW() - INTERVAL '30 days') AS recent_positive,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS recent_total
  FROM
    public.reviews
  GROUP BY
    agent_id
)
SELECT
  r.agent_id,
  r.rating_1_count,
  r.rating_2_count,
  r.rating_3_count,
  r.rating_4_count,
  r.rating_5_count,
  r.total_reviews,
  r.average_rating,
  -- Calculate credibility score (weighted average of rating and number of reviews)
  CASE
    WHEN r.total_reviews = 0 THEN 0
    ELSE (r.average_rating * 0.7) + (LEAST(r.total_reviews, 100) / 100 * 0.3) * 5
  END AS credibility_score,
  -- Calculate percentage of recent positive reviews
  CASE
    WHEN rec.recent_total = 0 THEN 0
    ELSE ROUND((rec.recent_positive::NUMERIC / rec.recent_total) * 100)
  END AS recent_positive_percentage
FROM
  rating_counts r
LEFT JOIN
  recent_reviews rec ON r.agent_id = rec.agent_id;

-- Create trending_agents view
CREATE OR REPLACE VIEW public.trending_agents AS
SELECT
  a.*,
  -- Calculate trending score based on recent views, likes, and reviews
  (
    (a.views * 0.3) + 
    (a.likes * 0.4) + 
    (SELECT COUNT(*) FROM public.reviews WHERE agent_id = a.id AND created_at > NOW() - INTERVAL '7 days') * 0.5
  ) AS trending_score
FROM
  public.agents a
WHERE
  a.is_public = true
ORDER BY
  trending_score DESC;

-- Create featured_agents view (high quality agents with good reviews)
CREATE OR REPLACE VIEW public.featured_agents AS
SELECT
  a.*
FROM
  public.agents a
JOIN
  public.review_summary rs ON a.id = rs.agent_id
WHERE
  a.is_public = true
  AND rs.average_rating >= 4.0
  AND rs.total_reviews >= 5
ORDER BY
  rs.credibility_score DESC,
  a.created_at DESC;

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_is_verified ON public.users(is_verified);
CREATE INDEX IF NOT EXISTS idx_users_is_official ON public.users(is_official);

-- Create indexes for companies table
CREATE INDEX IF NOT EXISTS idx_companies_is_verified ON public.companies(is_verified);
CREATE INDEX IF NOT EXISTS idx_companies_is_enterprise ON public.companies(is_enterprise);

-- Create indexes for agents table
CREATE INDEX IF NOT EXISTS idx_agents_creator_id ON public.agents(creator_id);
CREATE INDEX IF NOT EXISTS idx_agents_company_id ON public.agents(company_id);
CREATE INDEX IF NOT EXISTS idx_agents_is_public ON public.agents(is_public);
CREATE INDEX IF NOT EXISTS idx_agents_rating ON public.agents(rating);
CREATE INDEX IF NOT EXISTS idx_agents_created_at ON public.agents(created_at);
CREATE INDEX IF NOT EXISTS idx_agents_views ON public.agents(views);
CREATE INDEX IF NOT EXISTS idx_agents_likes ON public.agents(likes);
CREATE INDEX IF NOT EXISTS idx_agents_name_gin ON public.agents USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Create indexes for reviews table
CREATE INDEX IF NOT EXISTS idx_reviews_agent_id ON public.reviews(agent_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.reviews(created_at);

-- Create indexes for review_replies table
CREATE INDEX IF NOT EXISTS idx_review_replies_review_id ON public.review_replies(review_id);
CREATE INDEX IF NOT EXISTS idx_review_replies_user_id ON public.review_replies(user_id);

-- Create indexes for review_votes table
CREATE INDEX IF NOT EXISTS idx_review_votes_review_id ON public.review_votes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_votes_user_id ON public.review_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_review_votes_vote ON public.review_votes(vote);

-- Create indexes for agent_likes table
CREATE INDEX IF NOT EXISTS idx_agent_likes_agent_id ON public.agent_likes(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_likes_user_id ON public.agent_likes(user_id);

-- Create indexes for company_admins table
CREATE INDEX IF NOT EXISTS idx_company_admins_company_id ON public.company_admins(company_id);
CREATE INDEX IF NOT EXISTS idx_company_admins_user_id ON public.company_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_company_admins_is_owner ON public.company_admins(is_owner);
