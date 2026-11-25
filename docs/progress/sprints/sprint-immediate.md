# 🚀 Sprint Immediate — GitHub Push + CI Enable

> **Date**: 2026-11-26  
> **Effort**: 1–2 hours  
> **Status**: 🔵 IN PROGRESS  
> **Gate to Sprint 1.5**: CI matrix must be green before coding

---

## Goal

Push the 6 existing commits to GitHub and enable CI so every future PR is auto-validated.

---

## Tickets

### S0-001 — Push to GitHub {#S0-001}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🔴 Critical |
| **ETA** | 2026-11-26 |
| **Files** | — (git operation) |

**Steps**:
```bash
git remote -v                     # verify remote exists
git push origin main              # push 6 commits
```

- [ ] Remote confirmed
- [ ] Push succeeds
- [ ] GitHub shows all 6 commits on main

---

### S0-002 — Enable GitHub Actions CI {#S0-002}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🔴 Critical |
| **ETA** | 2026-11-26 |
| **Files** | `.github/workflows/ci.yml` |

**Steps**:
- [ ] Go to repo Settings → Actions → Allow all actions
- [ ] Trigger a manual run or push a small commit
- [ ] Actions tab shows workflow running

---

### S0-003 — Verify UTC+EDT Matrix Passes {#S0-003}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🔴 Critical |
| **ETA** | 2026-11-26 |
| **Expected** | 20/20 tests green across both TZ jobs |

- [ ] UTC job: 20/20 tests pass
- [ ] EDT job: 20/20 tests pass
- [ ] No type errors in typecheck step

---

### S0-004 — Branch Protection {#S0-004}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🟡 Important |
| **ETA** | 2026-11-26 |

**Steps**:
- [ ] Settings → Branches → Add rule for `main`
- [ ] Require CI to pass before merge
- [ ] Require at least 1 approval (or disable for solo)

---

## ✅ Sprint Immediate Checklist

- [ ] `git push origin main` — 6 commits on GitHub
- [ ] CI runs automatically on push
- [ ] Both timezone jobs pass (20/20 tests each)
- [ ] Branch protection set

**Completion**: When all 4 boxes above are checked, Sprint 1.5 begins.
