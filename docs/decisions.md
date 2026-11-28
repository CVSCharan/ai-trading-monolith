# Architectural Decision Records (ADRs)

> **Status:** Authoritative  
> **Last Updated:** 2026-11-28

---

## ADR-001 · Monorepo with Bun Workspaces & Turborepo
- **Decision:** Use Bun workspaces + Turborepo across `apps/api`, `apps/engine`, `apps/web`, `packages/shared`, and `packages/strategy-core`.
- **Rationale:** Native TypeScript execution, fast test runner (`bun test`), and strict compile-time separation between pure strategy logic (`strategy-core`, zero external deps) and runtime I/O (`api`, `engine`).

## ADR-002 · Split Control Plane (`apps/api`) & Execution Engine (`apps/engine`)
- **Decision:** Keep HTTP/auth/UI APIs on port `3000` (`apps/api`) and long-lived broker WebSockets, tick aggregation, and order execution on port `3001` (`apps/engine`), communicating via PostgreSQL (`engine_commands`, `engine_state`, `LISTEN/NOTIFY`).
- **Rationale:** NSE INSP77559 mandates a registered Static IP for automated order execution. Splitting allows `apps/web` and `apps/api` to scale serverlessly while `apps/engine` runs on a static-IP host.

## ADR-003 · Dual-Broker Routing (Groww + Upstox)
- **Decision:** Separate `ACTIVE_DATA_BROKER` and `ACTIVE_EXECUTION_BROKER` behind `BrokerAdapter`.
- **Rationale:** Upstox Analytics Token provides 1-year read-only market data & option chains without a static IP, while Groww TOTP or Upstox v3 handles execution.

## ADR-004 · Host-Timezone-Independent IST Math
- **Decision:** Compute all IST wall-clock dates and session windows using fixed `UTC+05:30` epoch arithmetic (`330 * 60_000` ms) in `packages/shared/src/timezone.ts`.
- **Rationale:** Avoids OS-timezone-dependent `toLocaleString` + `.toISOString()` shifts between `00:00` and `05:29` IST.

## ADR-005 · PostgreSQL-Backed Durability & Append-Only Audit Trail
- **Decision:** Store encrypted broker credentials (`AES-256-GCM`), live order idempotency keys (`live_fills`), and immutable audit events (`audit_logs` protected by `audit_logs_immutable_trigger`) in Neon PostgreSQL.
- **Rationale:** Guarantees crash recovery (`reconciliation.ts`), prevents duplicate broker orders, and enforces tamper-evident audit logging.

## ADR-006 · Optional n8n Sidecar (Never in Order Execution)
- **Decision:** Keep order execution, stop-losses, and risk checks strictly inside `apps/engine`. Use n8n only as an optional external sidecar via HMAC-signed webhooks for multi-channel alert fan-out (WhatsApp/Slack/Email).
- **Rationale:** Preserves sub-second deterministic execution latency and regulatory audit boundaries.
