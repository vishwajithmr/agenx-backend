-- Sample companies
INSERT INTO public.companies (id, name, logo_url, description, is_verified, is_enterprise) VALUES
  ('11111111-1111-1111-1111-111111111111', 'AgenX Inc', 'https://example.com/logos/agenx.png', 'Creator of the AgenX platform', true, true),
  ('22222222-2222-2222-2222-222222222222', 'AI Solutions', 'https://example.com/logos/aisolutions.png', 'Enterprise AI solutions', true, true),
  ('33333333-3333-3333-3333-333333333333', 'SmartAgent Labs', 'https://example.com/logos/smartagent.png', 'Innovative agent development', true, false)
ON CONFLICT DO NOTHING;

-- Sample agents (only add if there are no agents yet)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.agents LIMIT 1) THEN
    INSERT INTO public.agents (id, name, description, image_url, is_pro, capabilities, company_id, is_public) VALUES
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CodeBot', 'AI assistant for programming tasks', 'https://example.com/agents/codebot.png', true, ARRAY['programming', 'code review', 'debugging'], '11111111-1111-1111-1111-111111111111', true),
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'WriterPro', 'Professional writing assistant', 'https://example.com/agents/writerpro.png', true, ARRAY['content creation', 'proofreading', 'research'], '22222222-2222-2222-2222-222222222222', true),
      ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'DataAnalyst', 'AI for data analysis', 'https://example.com/agents/dataanalyst.png', false, ARRAY['data visualization', 'statistical analysis', 'reporting'], '33333333-3333-3333-3333-333333333333', true),
      ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'DesignMaster', 'Design assistant for creative work', 'https://example.com/agents/designmaster.png', true, ARRAY['UI design', 'graphic design', 'illustrations'], '22222222-2222-2222-2222-222222222222', true),
      ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'ProductivityCoach', 'Stay productive with AI guidance', 'https://example.com/agents/productivitycoach.png', false, ARRAY['task management', 'time tracking', 'goal setting'], '11111111-1111-1111-1111-111111111111', true);
  END IF;
END $$;
