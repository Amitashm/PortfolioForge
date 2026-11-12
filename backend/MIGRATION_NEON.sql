-- PortfolioForge backend features V1 migration.
-- Run once in Neon SQL Editor before starting the updated backend.

ALTER TABLE portfolios
    ADD COLUMN IF NOT EXISTS slug VARCHAR(80);

ALTER TABLE portfolios
    ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS ix_portfolios_slug
    ON portfolios (slug);

CREATE TABLE IF NOT EXISTS job_applications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company VARCHAR(160) NOT NULL,
    role VARCHAR(160) NOT NULL,
    location VARCHAR(160),
    status VARCHAR(30) NOT NULL DEFAULT 'Interested',
    applied_date VARCHAR(20),
    job_url VARCHAR(1000),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_job_applications_user_id
    ON job_applications(user_id);


-- Portfolio analytics event storage.
-- Counts anonymous portfolio page views; project views are supported when sent
-- with event_type="project_view" and project_title.
CREATE TABLE IF NOT EXISTS portfolio_visits (
    id SERIAL PRIMARY KEY,
    portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    event_type VARCHAR(30) NOT NULL DEFAULT 'portfolio_view',
    project_title VARCHAR(150),
    visitor_key VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_portfolio_visits_portfolio_id
    ON portfolio_visits(portfolio_id);
CREATE INDEX IF NOT EXISTS ix_portfolio_visits_visitor_key
    ON portfolio_visits(visitor_key);
CREATE INDEX IF NOT EXISTS ix_portfolio_visits_created_at
    ON portfolio_visits(created_at);

-- Multi-portfolio support: remove the old one-portfolio-per-user uniqueness.
-- Existing portfolio rows (including their slug and published state) are preserved.
DO $$
DECLARE constraint_name TEXT;
BEGIN
    FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE t.relname = 'portfolios'
          AND n.nspname = current_schema()
          AND c.contype = 'u'
          AND (
              SELECT array_agg(a.attname ORDER BY a.attname)
              FROM unnest(c.conkey) AS key(attnum)
              JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = key.attnum
          ) = ARRAY['user_id']::name[]
    LOOP
        EXECUTE format('ALTER TABLE portfolios DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS ix_portfolios_user_id
    ON portfolios(user_id);
