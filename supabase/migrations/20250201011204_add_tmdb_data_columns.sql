-- Add TMDB data columns to personal_catalog table
ALTER TABLE personal_catalog
ADD COLUMN IF NOT EXISTS poster_path TEXT,
ADD COLUMN IF NOT EXISTS genres JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS overview TEXT,
ADD COLUMN IF NOT EXISTS vote_average DECIMAL(3,1),
ADD COLUMN IF NOT EXISTS release_date DATE,
ADD COLUMN IF NOT EXISTS watch_providers JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS last_tmdb_update TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add an index on last_tmdb_update to help with finding stale data
CREATE INDEX IF NOT EXISTS idx_personal_catalog_last_tmdb_update ON personal_catalog(last_tmdb_update);

-- Add comment explaining the purpose of these columns
COMMENT ON TABLE personal_catalog IS 'Stores user''s personal catalog items with cached TMDB data';
