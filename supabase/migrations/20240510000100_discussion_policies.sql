-- Enable Row Level Security on all tables
ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- Discussions Policies
CREATE POLICY "Discussions are viewable by everyone"
  ON public.discussions
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create discussions"
  ON public.discussions
  FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own discussions"
  ON public.discussions
  FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own discussions"
  ON public.discussions
  FOR DELETE
  USING (auth.uid() = author_id);

-- Comments Policies
CREATE POLICY "Comments are viewable by everyone"
  ON public.comments
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create comments"
  ON public.comments
  FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own comments"
  ON public.comments
  FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own comments"
  ON public.comments
  FOR DELETE
  USING (auth.uid() = author_id);

-- Votes Policies
CREATE POLICY "Users can see their own votes"
  ON public.votes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can vote"
  ON public.votes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes"
  ON public.votes
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes"
  ON public.votes
  FOR DELETE
  USING (auth.uid() = user_id);
