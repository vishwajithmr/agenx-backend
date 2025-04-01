-- Drop the existing foreign key constraint if it exists
ALTER TABLE agents DROP CONSTRAINT IF EXISTS fk_company_id;

-- Alter the company_id column to use the uuid type
ALTER TABLE agents ALTER COLUMN company_id TYPE UUID USING company_id::uuid;

-- Reapply the foreign key constraint
ALTER TABLE agents
ADD CONSTRAINT fk_company_id
FOREIGN KEY (company_id)
REFERENCES companies (id)
ON DELETE SET NULL;
