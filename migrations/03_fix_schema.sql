-- Add is_public column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'agents' 
        AND column_name = 'is_public'
    ) THEN
        ALTER TABLE public.agents ADD COLUMN is_public BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Update policies to handle case where is_public might have been missing
DROP POLICY IF EXISTS "Public agents are viewable by everyone" ON public.agents;
CREATE POLICY "Public agents are viewable by everyone"
  ON public.agents FOR SELECT
  USING (is_public OR auth.uid() = creator_id);
