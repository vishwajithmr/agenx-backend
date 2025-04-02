-- Add alt_text column to review_images table if it doesn't exist
ALTER TABLE review_images 
ADD COLUMN IF NOT EXISTS alt_text TEXT;
