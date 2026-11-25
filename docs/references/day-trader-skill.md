# 📚 External Reference: `day-trader-skill`

> **Source**: <https://github.com/Jakeschincariol/day-trader-skill>  
> **Evaluated**: 2026-11-26 IST  
> **Decision**: **Do not integrate code** — adopt UX & safety patterns only.

---

## Summary

`day-trader-skill` is an open-source collection of 11 Claude/AI agent `SKILL.md` playbooks backed by Python scripts for US-equity day trading (Yahoo Finance, Nasdaq Trader, SEC EDGAR, House Clerk).

---

## Why Code Was Not Integrated

| Dimension | `day-trader-skill` | Groww AI Trading Monolith |
|-----------|--------------------|---------------------------|
| **Market** | US equities (SEC 8-K, Nasdaq) | NSE F&O (`NIFTY` / `BANKNIFTY` options) |
| **Pricing & Costs** | US equity feeds; no option chain/expiry roll | Groww API + Indian STT, SEBI, stamp duty, GST (`cost_configs`) |
| **Runtime** | Interactive Python CLI for AI chat | Deterministic Bun + TypeScript `strategy-core` & `engine` |

---

## Patterns Adopted

1. **Bar-by-Bar Trade Replay (`trader-timemachine`) → Sprint 5 (`TradeAuditorPage`)**:
   - Step through trades (`←` / `→`) with 1m candle context, EMA9/EMA21 overlays, and option chain/cost breakdown.
2. **Confirmation-Gated Paper-First Execution → Sprint 6 (`S6-001`)**:
   - `ENABLE_LIVE_TRADING=false` default + 6-prerequisite live gate (≥ 100 paper trades, PF > 1.5, DD < 10%, 2FA).
3. **Modular `SKILL.md` Ops Playbooks (Optional, Sprint 5+)**:
   - Future repo-local skills (e.g., `groww-trade-auditor`, `groww-risk-check`) can query `apps/api` and Neon Postgres directly using the `SKILL.md` convention.
