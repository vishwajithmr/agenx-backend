-- Function to increment agent views
CREATE OR REPLACE FUNCTION increment_agent_views(agent_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.agents
  SET views = COALESCE(views, 0) + 1,
      usage_count = COALESCE(usage_count, 0) + 1
  WHERE id = agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to like an agent
CREATE OR REPLACE FUNCTION like_agent(agent_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.agents
  SET likes = COALESCE(likes, 0) + 1
  WHERE id = agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
