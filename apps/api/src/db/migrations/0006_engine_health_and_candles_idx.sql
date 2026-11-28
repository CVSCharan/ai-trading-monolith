-- GAP-13: Deduplicate engine_health per host_id and enforce unique index for upserts
DELETE FROM "engine_health" a
USING "engine_health" b
WHERE a.host_id = b.host_id
  AND a.last_check < b.last_check;

CREATE UNIQUE INDEX IF NOT EXISTS "engine_health_host_uidx"
  ON "engine_health" ("host_id");

-- GAP-06: Non-destructive BRIN index on candles_1m(bar_time) for multi-year time-range scans
CREATE INDEX IF NOT EXISTS "candles_1m_bar_time_brin_idx"
  ON "candles_1m" USING brin ("bar_time");
