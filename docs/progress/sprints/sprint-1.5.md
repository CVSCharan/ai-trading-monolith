# 🛠️ Sprint 1.5 — Critical Bug Fixes + API Foundation

> **Start**: 2026-11-26 IST  
> **Target End**: 2026-11-28 IST (3 days)  
> **Status**: 🔵 IN PROGRESS  
> **Effort**: ~2-3 days (infra items resolved in pre-sprint)

---

## Goal

Fix all 6 critical bugs found in architectural review. API server starts cleanly. Encryption is correct. No engine deadlocks.

---

## Sprint Checklist (Must-pass gate to Sprint 2)

- [ ] CI passes on GitHub push (UTC + EDT matrix green)
- [ ] `bun run build` succeeds across all packages
- [ ] `bun run typecheck` zero errors
- [ ] API starts and returns `{ status: 'ok' }` on `GET /`
- [ ] No CryptoJS dependency in any package
- [ ] `generator.test.ts` — entry fires after exit (bracket bug regression)
- [ ] `generator.test.ts` — exit signal carries correct `optionSymbol`

---

## Tickets

### S1-001 — Replace CryptoJS → AES-256-GCM {#S1-001}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🔴 Critical |
| **ETA** | 2026-11-26 |
| **Bug** | BUG-001 |
| **Files** | `apps/api/src/utils/encryption.ts` (new), `apps/engine/src/services/groww-client.ts` |

**Problem**: CryptoJS CBC has no authentication tag — vulnerable to padding oracle and bit-flip attacks. Node native `crypto` supports AES-256-GCM (authenticated).

**Implementation**:
```typescript
// apps/api/src/utils/encryption.ts
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

export function encrypt(plaintext: string, masterKey: Buffer): string {
  const iv = randomBytes(12);                    // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();           // 16-byte auth tag
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decrypt(ciphertext: string, masterKey: Buffer): string {
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', masterKey, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

export function getMasterKey(): Buffer {
  const hex = process.env.ENCRYPTION_MASTER_KEY;
  if (!hex || hex.length !== 64) throw new Error('ENCRYPTION_MASTER_KEY must be 32 bytes hex');
  return Buffer.from(hex, 'hex');
}
```

- [ ] Create `apps/api/src/utils/encryption.ts`
- [ ] Update `groww-client.ts` to use new util (remove all CryptoJS usage)
- [ ] Remove `crypto-js` from `apps/api/package.json`
- [ ] Remove `crypto-js` from `apps/engine/package.json`
- [ ] Add migration script for re-encrypting existing stored credentials
- [ ] Add `ENCRYPTION_MASTER_KEY` to `.env.example`

**Definition of Done**: `bun run typecheck` passes, no CryptoJS import anywhere, existing credentials can be re-encrypted.

---

### S1-002 — Fix Relative Import in instrument-resolver.ts {#S1-002}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🟡 Important |
| **ETA** | 2026-11-26 |
| **Bug** | BUG-006 |
| **Files** | `packages/strategy-core/src/execution/instrument-resolver.ts:6` |

**Fix**:
```typescript
// ❌ Before
import { getISTDateString } from '../../../../packages/shared/src/timezone';

// ✅ After
import { getISTDateString } from '@groww-trading/shared';
```

- [ ] Fix import
- [ ] `bun run typecheck` zero errors

---

### S1-003 — Fix StreamingSignalGenerator Bracket Bug {#S1-003}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🔴 Critical |
| **ETA** | 2026-11-27 |
| **Bug** | BUG-004 |
| **Files** | `packages/strategy-core/src/signals/generator.ts` |

**Problem**: The new-entry block is nested INSIDE `if (currentPosition !== null)`. After the first exit, the system can never open a new position — a **silent trading deadlock**.

**Fix**: Move the new-entry `if` block outside the position check block:
```typescript
  // ... exit handling ...
  } // ← close the "if (currentPosition !== null)" block HERE

  // Check NEW ENTRY — outside exit block
  if (this.currentPosition === null && crossover !== 'NONE') {
    // ... entry logic ...
  }

  return signals;
} // end processBar
```

- [ ] Fix bracket structure in `generator.ts`
- [ ] Write regression test: `expect(signals.length).toBeGreaterThan(1)` after first exit

---

### S1-004 — Fix createExitSignal optionSymbol {#S1-004}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🔴 Critical |
| **ETA** | 2026-11-27 |
| **Bug** | BUG-005 |
| **Files** | `packages/strategy-core/src/signals/generator.ts` |

**Problem**: `createExitSignal` returns `optionSymbol: ''` — exits cannot execute because the engine doesn't know which instrument to sell.

**Fix**: Track open position state in StreamingSignalGenerator:
```typescript
// Add to class:
private openTradeSymbol: string = '';
private openTradeStrike: number = 0;
private openTradeOptionType: OptionType = 'CE';
private openTradeExpiryDate: Date = new Date(0);

// Set on entry, clear on exit
// Use in createExitSignal() to populate the signal
```

- [ ] Add 4 private state fields to `StreamingSignalGenerator`
- [ ] Set fields when entry signal is generated
- [ ] Clear fields when exit signal is generated
- [ ] Use fields in `createExitSignal()`
- [ ] Test: exit signal has non-empty `optionSymbol` matching entry

---

### S1-005 — Fix Reconciliation realizedPnl: 0 {#S1-005}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🔴 Critical |
| **ETA** | 2026-11-27 |
| **Bug** | BUG-007 |
| **Files** | `apps/engine/src/services/reconciliation.ts:153` |

**Problem**: On crash recovery, all closed positions are recorded with `realizedPnl: 0` — financial data corruption.

**Fix**:
```typescript
// ❌ Before
.set({ closedAt: new Date(), realizedPnl: 0 })

// ✅ After
const pnl = this.computePnL(dbPos, lastKnownPrice);
.set({ closedAt: new Date(), realizedPnl: pnl, closedReason: 'reconciliation' })
```

- [ ] Add `closedReason VARCHAR(50)` to `live_positions` and `paper_positions` via migration
- [ ] Implement `computePnL(position, currentPrice)` helper
- [ ] Log PnL discrepancy to `audit_logs`
- [ ] Create migration `0003_positions_closed_reason.ts`

---

### S1-006 — Create All 9 API Route Stub Files {#S1-006}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🔴 Critical |
| **ETA** | 2026-11-28 |
| **Bug** | BUG-003 |
| **Files** | `apps/api/src/routes/` (9 new files) |

**Files to create** (all return 501 until Sprint 3 implements them):

```
apps/api/src/routes/user.ts
apps/api/src/routes/strategy.ts
apps/api/src/routes/backtest.ts
apps/api/src/routes/trade.ts
apps/api/src/routes/market-data.ts
apps/api/src/routes/paper-trading.ts
apps/api/src/routes/live-trading.ts
apps/api/src/routes/groww.ts
apps/api/src/routes/engine.ts
```

Each stub pattern:
```typescript
import { Elysia } from 'elysia';
export const userRoutes = new Elysia({ prefix: '/api/user' })
  .get('/profile', () => new Response('Not Implemented', { status: 501 }));
```

- [ ] Create all 9 route files
- [ ] Wire all into `apps/api/src/index.ts`
- [ ] `bun run dev` starts without import errors

---

### S1-007 — Create apps/api/src/config.ts {#S1-007}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🟡 Important |
| **ETA** | 2026-11-28 |
| **Files** | `apps/api/src/config.ts` (new) |

Zod-validated environment config:
```typescript
import { z } from 'zod';
const schema = z.object({
  DATABASE_URL: z.string().url(),
  ENCRYPTION_MASTER_KEY: z.string().length(64),
  BETTER_AUTH_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
});
export const config = schema.parse(process.env);
```

- [ ] Create `config.ts`
- [ ] Update `index.ts` to import config
- [ ] All env vars documented in `.env.example`

---

### S1-008 — Create apps/api/src/logger.ts {#S1-008}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🟡 Important |
| **ETA** | 2026-11-28 |
| **Files** | `apps/api/src/logger.ts` (new) |

```typescript
import pino from 'pino';
export const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
```

- [ ] Create `logger.ts`
- [ ] Import in `index.ts`

---

### S1-009 — Regression Test: Entry After Exit {#S1-009}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🟡 Important |
| **ETA** | 2026-11-28 |
| **Files** | `packages/strategy-core/test/generator.test.ts` |

- [ ] Write test: feed bars that cause crossover → exit → another crossover
- [ ] Assert: second entry signal is generated
- [ ] Test must fail BEFORE S1-003 fix and pass AFTER

---

### S1-010 — Regression Test: Exit Signal Symbol {#S1-010}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🟡 Important |
| **ETA** | 2026-11-28 |
| **Files** | `packages/strategy-core/test/generator.test.ts` |

- [ ] Write test: entry signal captured with `optionSymbol`
- [ ] Exit signal `optionSymbol` matches entry signal
- [ ] Test must fail BEFORE S1-004 fix and pass AFTER

---

### S1-011 — Align Groww Auth Schema & Client to TOTP Token + QR Flow {#S1-011}

| Field | Value |
|-------|-------|
| **Status** | ⬜ Open |
| **Priority** | 🔴 Critical |
| **ETA** | 2026-11-28 |
| **Files** | `apps/api/src/db/schema.ts`, `apps/engine/src/services/groww-client.ts`, `docs/architecture.md`, `docs/phase1-spec.md` |

**Problem**: Groww's TOTP Trading API flow provides **only** `TOTP Token` (JWT-style string) and `TOTP Secret` (from QR code) — there is no `API Secret` or `Redirect URI`. Currently `growwCredentials.apiSecretEncrypted` is `.notNull()` and `groww-client.ts` requires `apiKey` + `apiSecret`.

- [ ] Make `apiSecretEncrypted` nullable in `apps/api/src/db/schema.ts` (support TOTP-only credentials)
- [ ] Update `groww-client.ts` login flow to authenticate using `totpToken` + `otplib` 6-digit OTP from `totpSecret`
- [ ] Support seeding/reading `GROWW_TOTP_TOKEN` + `GROWW_TOTP_SECRET` from `.env` for local dev
- [ ] Update `docs/architecture.md` & `docs/phase1-spec.md` env/schema examples

---

## 🚦 Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Existing encrypted creds need re-encryption | Medium | High | Write migration script in S1-001; test with dummy key first |
| Bracket fix in generator.ts breaks other logic | Medium | High | Write regression tests BEFORE fixing (S1-009, S1-010) |
| Pino not in api package.json | Low | Low | `bun add pino` |

---

*Sprint 1.5 · Target: 2026-11-28 · 10 tickets*
