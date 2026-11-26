# Sprint 13 — Floating Layout, Global CSS & Modular `shadcn/ui`

**Sprint Dates**: 2026-11-26 → 2026-12-08  
**Theme**: Eliminate layout shifting and double scrollbars with a locked viewport shell, detached floating glass sidebar, global CSS design tokens, and modular `shadcn/ui` primitives.

---

## Tickets

### S13-001 — Global CSS Design System (`apps/web/src/index.css`) ✅
- Lock `html, body, #root` to `height: 100%; overflow: hidden;`
- Add CSS variables (`--surface-0`, `--surface-1`, `--surface-glass`, `--border-subtle`)
- Add `scrollbar-gutter: stable` and `.thin-scrollbar` utility

### S13-002 — Modular Floating Layout (`components/layout/`) ✅
- `Sidebar.tsx`: Detached floating glass rail (`rounded-2xl border bg-slate-900/75 backdrop-blur-xl shadow-2xl`)
- `Header.tsx`: Fixed `h-14` header bar with API/DB status, Data/Execution broker pills, and `DEMO MODE` badge
- `AppShell.tsx`: `h-screen overflow-hidden p-3 flex gap-3` with single scrollable `<main>`

### S13-003 — `shadcn/ui` Primitives (`components/ui/`) ✅
- Add `input.tsx`, `select.tsx`, `alert.tsx`, `skeleton.tsx`

### S13-004 — Refactor `App.tsx` & Pages ✅
- Clean `App.tsx` delegating shell to `<AppShell>`
- Upgrade `StrategyBuilderPage`, `SettingsPage`, `OptionChainPage`, `AuditLogsPage`, `PaperTradingPage` to use shared `Input`, `Select`, `Alert` primitives without unnecessary nested scrollbars
