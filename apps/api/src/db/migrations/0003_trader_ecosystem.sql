-- Track 2, 3, 4: News/AI Briefs, Academy Progress, Trade Journal, Strategy Extensions
CREATE TABLE IF NOT EXISTS "market_news" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "symbol" varchar(50),
  "title" text NOT NULL,
  "summary" text DEFAULT '' NOT NULL,
  "source" varchar(100) NOT NULL,
  "url" text NOT NULL UNIQUE,
  "published_at" timestamp with time zone NOT NULL,
  "sentiment" varchar(20) DEFAULT 'NEUTRAL' NOT NULL,
  "impact_level" varchar(20) DEFAULT 'MEDIUM' NOT NULL,
  "event_type" varchar(30) DEFAULT 'GENERAL' NOT NULL,
  "ai_rationale" text DEFAULT '' NOT NULL,
  "suggested_regime" varchar(50) DEFAULT 'TREND_FOLLOWING' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "market_news_symbol_pub_idx" ON "market_news" ("symbol", "published_at");
CREATE INDEX IF NOT EXISTS "market_news_pub_idx" ON "market_news" ("published_at");

CREATE TABLE IF NOT EXISTS "ai_market_briefs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) REFERENCES "user"("id") ON DELETE cascade,
  "brief_type" varchar(20) DEFAULT 'INTRADAY' NOT NULL,
  "ist_date" date NOT NULL,
  "headline" text NOT NULL,
  "summary_markdown" text NOT NULL,
  "market_regime" varchar(30) DEFAULT 'TRENDING' NOT NULL,
  "watchlist_highlights" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ai_market_briefs_user_date_idx" ON "ai_market_briefs" ("user_id", "ist_date");

CREATE TABLE IF NOT EXISTS "academy_progress" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "module_id" varchar(50) NOT NULL,
  "lesson_id" varchar(50) NOT NULL,
  "quiz_score" integer DEFAULT 0,
  "quiz_attempts" integer DEFAULT 0,
  "completed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "academy_progress_user_lesson_uidx"
  ON "academy_progress" ("user_id", "module_id", "lesson_id");

CREATE TABLE IF NOT EXISTS "trade_journal_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "trade_id" varchar(100) NOT NULL,
  "trade_source" varchar(20) DEFAULT 'BACKTEST' NOT NULL,
  "setup_tag" varchar(50) DEFAULT '9_21_EMA' NOT NULL,
  "emotion_tag" varchar(30) DEFAULT 'CALM' NOT NULL,
  "followed_rules" boolean DEFAULT true NOT NULL,
  "rating" integer DEFAULT 4 NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "trade_journal_user_trade_uidx"
  ON "trade_journal_entries" ("user_id", "trade_id");
