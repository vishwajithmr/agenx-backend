-- Add tsvector column for full-text search
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS name_description_vector tsvector;

-- Create GIN index for fast text search
CREATE INDEX IF NOT EXISTS agents_name_description_idx
ON public.agents
USING gin(name_description_vector);

-- Create function to automatically update tsvector column
CREATE OR REPLACE FUNCTION public.agents_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.name_description_vector = 
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to keep the vector column updated
DROP TRIGGER IF EXISTS tsvectorupdate ON public.agents;
CREATE TRIGGER tsvectorupdate 
  BEFORE INSERT OR UPDATE OF name, description
  ON public.agents 
  FOR EACH ROW 
  EXECUTE FUNCTION public.agents_vector_update();

-- Simplified function for weighted search scoring
CREATE OR REPLACE FUNCTION public.search_agents(
  search_query text,
  poffset integer DEFAULT 0,
  plimit integer DEFAULT 10
) RETURNS TABLE (
  id uuid,
  name text,
  description text,
  image_url text,
  is_pro boolean,
  likes integer,
  views integer,
  rating numeric,
  usage_count integer,
  capabilities text[],
  creator_id uuid,
  company_id uuid,
  is_public boolean,
  created_at timestamptz,
  updated_at timestamptz,
  search_score real
) AS $$
DECLARE
  query_tsquery tsquery;
BEGIN
  -- Convert the search query to a tsquery
  query_tsquery := websearch_to_tsquery('english', search_query);
  
  -- Return results with calculated relevance score
  RETURN QUERY
  SELECT 
    a.id,
    a.name,
    a.description,
    a.image_url,
    a.is_pro,
    a.likes,
    a.views,
    a.rating,
    a.usage_count,
    a.capabilities,
    a.creator_id,
    a.company_id,
    a.is_public,
    a.created_at,
    a.updated_at,
    COALESCE(ts_rank(a.name_description_vector, query_tsquery)::real, 0.0) AS search_score
  FROM agents a
  WHERE 
    a.is_public = true AND
    a.name_description_vector @@ query_tsquery
  ORDER BY search_score DESC
  LIMIT plimit
  OFFSET poffset;
END;
$$ LANGUAGE plpgsql;

-- Generate vector data for existing records
UPDATE public.agents 
SET name = name 
WHERE name_description_vector IS NULL;

-- Create RLS policy for the search function
ALTER FUNCTION public.search_agents SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.search_agents FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_agents TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_agents TO anon;
GRANT EXECUTE ON FUNCTION public.search_agents TO service_role;

-- Add permissions
GRANT EXECUTE ON FUNCTION public.count_search_results TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_search_results TO anon;
GRANT EXECUTE ON FUNCTION public.count_search_results TO service_role;

