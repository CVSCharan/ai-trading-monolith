# Sprint 12 — Autonomous Trading Bot Control & Audit

**Sprint Dates**: 2026-11-26 → 2026-12-05  
**Theme**: Complete autonomous bot lifecycle controls, strategy management, live order/margin visibility, editable risk guardrails, and audit trail UI.

---

## Tickets

### S12-001 — Bot Control Center (`BotControlPage.tsx` + `/bot`) ✅
- Engine health & heartbeat (`GET /api/engine/health`, `GET /api/engine/state`)
- Active data & execution broker status (`GET /api/upstox/status`)
- Strategy selector + **Start Paper Bot** (`POST /api/paper/start`) / **Stop Paper Bot** (`POST /api/paper/stop`)
- **Emergency Kill Switch** (`POST /api/live/emergency-stop`)

### S12-002 — Strategy Lifecycle Actions (`StrategyBuilderPage.tsx`) ✅
- Activate / Pause (`PATCH /api/strategies/:id`)
- Clone (`POST /api/strategies/:id/clone`)
- Delete (`DELETE /api/strategies/:id`)
- 1-click **Launch Bot** (`POST /api/paper/start`)

### S12-003 — Live Desk Execution Tables & Margins (`LiveTradingPage.tsx`) ✅
- Display `GET /api/live/orders`, `GET /api/live/positions`, `GET /api/groww/margins`
- Wrap live controls in `<RoleGuard role="SUPER_ADMIN">` for `DEMO` users

### S12-004 — Bot Audit Trail (`GET /api/audit` + `AuditLogsPage.tsx`) ✅
- `apps/api/src/routes/audit.ts`: `GET /api/audit` returning recent `auditLogs`
- `apps/web/src/pages/AuditLogsPage.tsx`: Filterable timeline of bot actions & auth events

### S12-005 — Editable Risk Guardrails (`SettingsPage.tsx`) ✅
- Load `GET /api/user/profile` and save via `PATCH /api/user/risk-limits`
- Wrap Groww/Risk forms in `<RoleGuard role="SUPER_ADMIN">` for `DEMO` users
