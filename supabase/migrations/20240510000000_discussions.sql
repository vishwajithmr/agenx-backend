-- Create discussions table
CREATE TABLE IF NOT EXISTS public.discussions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(100) NOT NULL CHECK (length(title) >= 5),
  content TEXT NOT NULL CHECK (length(content) >= 10 AND length(content) <= 5000),
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  comment_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL CHECK (length(content) >= 1 AND length(content) <= 2000),
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  discussion_id UUID NOT NULL REFERENCES public.discussions(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  is_deleted BOOLEAN DEFAULT false,
  reply_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create votes table for both discussions and comments
CREATE TABLE IF NOT EXISTS public.votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL,
  target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('discussion', 'comment')),
  value INTEGER NOT NULL CHECK (value IN (-1, 0, 1)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_id, target_type)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_discussions_agent_id ON public.discussions(agent_id);
CREATE INDEX IF NOT EXISTS idx_discussions_author_id ON public.discussions(author_id);
CREATE INDEX IF NOT EXISTS idx_discussions_created_at ON public.discussions(created_at);
CREATE INDEX IF NOT EXISTS idx_discussions_score ON public.discussions(score);
CREATE INDEX IF NOT EXISTS idx_discussions_last_activity ON public.discussions(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_discussions_is_pinned ON public.discussions(is_pinned);

CREATE INDEX IF NOT EXISTS idx_comments_discussion_id ON public.comments(discussion_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_comment_id ON public.comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON public.comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_score ON public.comments(score);

CREATE INDEX IF NOT EXISTS idx_votes_target_id_type ON public.votes(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON public.votes(user_id);

-- Create function to update discussion last activity timestamp
CREATE OR REPLACE FUNCTION update_discussion_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.discussions
  SET last_activity_at = NOW()
  WHERE id = NEW.discussion_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update last activity when comments are added
CREATE TRIGGER update_discussion_last_activity_on_comment
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION update_discussion_last_activity();

-- Create function to increment comment count
CREATE OR REPLACE FUNCTION increment_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment discussion comment count
  UPDATE public.discussions
  SET comment_count = comment_count + 1
  WHERE id = NEW.discussion_id;
  
  -- If this is a reply, increment parent comment's reply count
  IF NEW.parent_comment_id IS NOT NULL THEN
    UPDATE public.comments
    SET reply_count = reply_count + 1
    WHERE id = NEW.parent_comment_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to increment comment count
CREATE TRIGGER increment_comment_count_trigger
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION increment_comment_count();

-- Create function to decrement comment count when comments are deleted
CREATE OR REPLACE FUNCTION decrement_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Decrement discussion comment count
  UPDATE public.discussions
  SET comment_count = comment_count - 1
  WHERE id = OLD.discussion_id;
  
  -- If this was a reply, decrement parent comment's reply count
  IF OLD.parent_comment_id IS NOT NULL THEN
    UPDATE public.comments
    SET reply_count = reply_count - 1
    WHERE id = OLD.parent_comment_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to decrement comment count
CREATE TRIGGER decrement_comment_count_trigger
AFTER DELETE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION decrement_comment_count();

-- Create function to update vote scores
CREATE OR REPLACE FUNCTION update_vote_score()
RETURNS TRIGGER AS $$
DECLARE
  score_change INTEGER;
BEGIN
  -- Calculate score change
  IF TG_OP = 'INSERT' THEN
    score_change := NEW.value;
  ELSIF TG_OP = 'UPDATE' THEN
    score_change := NEW.value - OLD.value;
  ELSIF TG_OP = 'DELETE' THEN
    score_change := -OLD.value;
  END IF;
  
  -- Update score based on target type
  IF TG_OP = 'DELETE' OR OLD.target_type = 'discussion' THEN
    UPDATE public.discussions
    SET score = score + score_change
    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.target_id ELSE NEW.target_id END;
  ELSIF OLD.target_type = 'comment' OR NEW.target_type = 'comment' THEN
    UPDATE public.comments
    SET score = score + score_change
    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.target_id ELSE NEW.target_id END;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for vote score updates
CREATE TRIGGER update_vote_score_on_insert
AFTER INSERT ON public.votes
FOR EACH ROW
EXECUTE FUNCTION update_vote_score();

CREATE TRIGGER update_vote_score_on_update
AFTER UPDATE ON public.votes
FOR EACH ROW
EXECUTE FUNCTION update_vote_score();

CREATE TRIGGER update_vote_score_on_delete
AFTER DELETE ON public.votes
FOR EACH ROW
EXECUTE FUNCTION update_vote_score();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_discussions_updated_at
BEFORE UPDATE ON public.discussions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
BEFORE UPDATE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_votes_updated_at
BEFORE UPDATE ON public.votes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
