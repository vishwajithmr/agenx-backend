-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_votes ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view their own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.users
  FOR SELECT
  USING (is_verified = true OR is_official = true);

-- Companies table policies
CREATE POLICY "Companies are viewable by everyone"
  ON public.companies
  FOR SELECT
  USING (true);

CREATE POLICY "Company owners can update company info"
  ON public.companies
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_admins
      WHERE company_id = companies.id
      AND user_id = auth.uid()
      AND is_owner = true
    )
  );

-- Company admins policies
CREATE POLICY "Company admins can view their own entries"
  ON public.company_admins
  FOR SELECT
  USING (auth.uid() = user_id);

-- Agents table policies
CREATE POLICY "Public agents are viewable by everyone"
  ON public.agents
  FOR SELECT
  USING (is_public = true);

CREATE POLICY "Creator can view their own agents"
  ON public.agents
  FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Creator can update their own agents"
  ON public.agents
  FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Creator can delete their own agents"
  ON public.agents
  FOR DELETE
  USING (auth.uid() = creator_id);

CREATE POLICY "Company admins can manage company agents"
  ON public.agents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.company_admins
      WHERE company_id = agents.company_id
      AND user_id = auth.uid()
    )
  );

-- Agent likes policies
CREATE POLICY "Users can view their own likes"
  ON public.agent_likes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can like agents"
  ON public.agent_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike agents"
  ON public.agent_likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Reviews policies
CREATE POLICY "Reviews are viewable by everyone"
  ON public.reviews
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create reviews"
  ON public.reviews
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
  ON public.reviews
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
  ON public.reviews
  FOR DELETE
  USING (auth.uid() = user_id);

-- Review replies policies
CREATE POLICY "Review replies are viewable by everyone"
  ON public.review_replies
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create review replies"
  ON public.review_replies
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own review replies"
  ON public.review_replies
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own review replies"
  ON public.review_replies
  FOR DELETE
  USING (auth.uid() = user_id);

-- Review votes policies
CREATE POLICY "Users can see their own votes"
  ON public.review_votes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can vote on reviews"
  ON public.review_votes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes"
  ON public.review_votes
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes"
  ON public.review_votes
  FOR DELETE
  USING (auth.uid() = user_id);
