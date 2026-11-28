-- GAP-02: Enforce immutable append-only audit_logs via trigger
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is immutable: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_immutable_trigger ON audit_logs;
CREATE TRIGGER audit_logs_immutable_trigger
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

-- GAP-14 & GAP-29: Encrypted Upstox credentials table
CREATE TABLE IF NOT EXISTS "upstox_credentials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE cascade,
  "upstox_user_id" varchar(100),
  "access_token_encrypted" text,
  "analytics_token_encrypted" text,
  "token_expires_at" timestamp with time zone,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
