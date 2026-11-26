-- Migration: 0002_add_watchlists
-- Adds custom watchlists table for Groww + Upstox pinned symbols

CREATE TABLE IF NOT EXISTS watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  symbol VARCHAR(100) NOT NULL,
  exchange VARCHAR(20) NOT NULL DEFAULT 'NSE',
  segment VARCHAR(20) NOT NULL DEFAULT 'FO',
  instrument_key VARCHAR(100),
  notes VARCHAR(255),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, symbol, exchange)
);

CREATE INDEX IF NOT EXISTS watchlists_user_idx ON watchlists(user_id, sort_order);
