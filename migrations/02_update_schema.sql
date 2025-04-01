-- Add new columns to agents table
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT false;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS rating NUMERIC(3,1) DEFAULT 0;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS capabilities TEXT[] DEFAULT '{}';
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS company_id UUID;

-- Create companies table
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_enterprise BOOLEAN DEFAULT false,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint to agents table for company_id
ALTER TABLE public.agents ADD CONSTRAINT fk_company 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) 
  ON DELETE SET NULL;

-- Enable RLS for companies table
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Companies policies
CREATE POLICY "Companies are viewable by everyone"
  ON public.companies FOR SELECT
  USING (true);

CREATE POLICY "Only company creators can insert"
  ON public.companies FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Only company creators can update"
  ON public.companies FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Only company creators can delete"
  ON public.companies FOR DELETE
  USING (auth.uid() = creator_id);
