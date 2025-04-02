-- Extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_official BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create companies table
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_enterprise BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create company_admins junction table to track company ownership
CREATE TABLE IF NOT EXISTS public.company_admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_owner BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- Create agents table
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  is_pro BOOLEAN DEFAULT FALSE,
  likes INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  capabilities TEXT[] DEFAULT '{}',
  creator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trigger for agents updated_at
CREATE TRIGGER update_agents_updated_at
BEFORE UPDATE ON public.agents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create agent_likes table
CREATE TABLE IF NOT EXISTS public.agent_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, user_id)
);

-- Create reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT NOT NULL CHECK (LENGTH(content) >= 10),
  images TEXT[] DEFAULT '{}',
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, user_id)
);

-- Create review_replies table
CREATE TABLE IF NOT EXISTS public.review_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (LENGTH(content) >= 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create review_votes table
CREATE TABLE IF NOT EXISTS public.review_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vote INTEGER NOT NULL CHECK (vote IN (-1, 0, 1)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

-- Create triggers for updated_at
CREATE TRIGGER update_reviews_updated_at
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_review_replies_updated_at
BEFORE UPDATE ON public.review_replies
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_review_votes_updated_at
BEFORE UPDATE ON public.review_votes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (NEW.id, NEW.email, split_part(NEW.email, '@', 1));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to update agent likes count
CREATE OR REPLACE FUNCTION update_agent_likes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.agents
    SET likes = likes + 1
    WHERE id = NEW.agent_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.agents
    SET likes = likes - 1
    WHERE id = OLD.agent_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for agent likes
CREATE TRIGGER on_agent_like
  AFTER INSERT ON public.agent_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_likes();

CREATE TRIGGER on_agent_unlike
  AFTER DELETE ON public.agent_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_likes();

-- Create function to track agent views
CREATE OR REPLACE FUNCTION increment_agent_views(agent_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.agents
  SET views = views + 1
  WHERE id = agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update review vote counts
CREATE OR REPLACE FUNCTION update_review_votes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote = 1 THEN
      UPDATE public.reviews
      SET upvotes = upvotes + 1
      WHERE id = NEW.review_id;
    ELSIF NEW.vote = -1 THEN
      UPDATE public.reviews
      SET downvotes = downvotes + 1
      WHERE id = NEW.review_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.vote = 1 AND NEW.vote = -1 THEN
      UPDATE public.reviews
      SET upvotes = upvotes - 1,
          downvotes = downvotes + 1
      WHERE id = NEW.review_id;
    ELSIF OLD.vote = -1 AND NEW.vote = 1 THEN
      UPDATE public.reviews
      SET upvotes = upvotes + 1,
          downvotes = downvotes - 1
      WHERE id = NEW.review_id;
    ELSIF OLD.vote = 1 AND NEW.vote = 0 THEN
      UPDATE public.reviews
      SET upvotes = upvotes - 1
      WHERE id = NEW.review_id;
    ELSIF OLD.vote = -1 AND NEW.vote = 0 THEN
      UPDATE public.reviews
      SET downvotes = downvotes - 1
      WHERE id = NEW.review_id;
    ELSIF OLD.vote = 0 AND NEW.vote = 1 THEN
      UPDATE public.reviews
      SET upvotes = upvotes + 1
      WHERE id = NEW.review_id;
    ELSIF OLD.vote = 0 AND NEW.vote = -1 THEN
      UPDATE public.reviews
      SET downvotes = downvotes + 1
      WHERE id = NEW.review_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote = 1 THEN
      UPDATE public.reviews
      SET upvotes = upvotes - 1
      WHERE id = OLD.review_id;
    ELSIF OLD.vote = -1 THEN
      UPDATE public.reviews
      SET downvotes = downvotes - 1
      WHERE id = OLD.review_id;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for review votes
CREATE TRIGGER on_review_vote_change
  AFTER INSERT OR UPDATE OR DELETE ON public.review_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_review_votes();

-- Function to update agent rating when reviews are added/updated/deleted
CREATE OR REPLACE FUNCTION update_agent_rating()
RETURNS TRIGGER AS $$
DECLARE
  avg_rating NUMERIC;
BEGIN
  -- Calculate the new average rating
  SELECT COALESCE(AVG(rating), 0) INTO avg_rating
  FROM public.reviews
  WHERE agent_id = COALESCE(NEW.agent_id, OLD.agent_id);
  
  -- Update the agent's rating
  UPDATE public.agents
  SET rating = avg_rating
  WHERE id = COALESCE(NEW.agent_id, OLD.agent_id);
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for agent rating updates
CREATE TRIGGER on_review_change
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_rating();
