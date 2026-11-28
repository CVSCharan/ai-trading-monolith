CREATE TABLE IF NOT EXISTS "price_alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "symbol" varchar(50) NOT NULL,
  "condition" varchar(10) DEFAULT 'ABOVE' NOT NULL,
  "target_price" numeric(12, 2) NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "triggered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "price_alerts_user_active_idx"
  ON "price_alerts" ("user_id", "is_active");
