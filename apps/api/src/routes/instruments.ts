// ============================================
// Live Broker Instruments Search & Sync
// Fetches Upstox NSE Instrument Master (NSE.json.gz)
// Falls back to local Postgres instruments table if offline
// ============================================

import { Elysia, t } from 'elysia';
import { eq, ilike, or } from 'drizzle-orm';
import { db } from '../db';
import { instruments } from '../db/schema';
import { authPlugin, requireAuth } from '../middleware/auth-middleware';
import { logger } from '../logger';

const UPSTOX_NSE_MASTER_URL =
  'https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz';

export interface LiveInstrumentItem {
  symbol: string;
  name: string;
  exchange: string;
  segment: string;
  instrumentType: string;
  instrumentKey: string;
  lotSize: number;
  tickSize: number;
}

interface RawUpstoxInstrument {
  trading_symbol?: string;
  name?: string;
  short_name?: string;
  exchange?: string;
  segment?: string;
  instrument_type?: string;
  instrument_key?: string;
  lot_size?: number;
  tick_size?: number;
}

let cachedMaster: LiveInstrumentItem[] = [];
let cacheLoadedAt = 0;
let loadingPromise: Promise<LiveInstrumentItem[]> | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function loadUpstoxMaster(force = false): Promise<LiveInstrumentItem[]> {
  if (!force && cachedMaster.length > 0 && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedMaster;
  }
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const res = await fetch(UPSTOX_NSE_MASTER_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const gzBuffer = new Uint8Array(await res.arrayBuffer());
      const jsonText = new TextDecoder().decode(Bun.gunzipSync(gzBuffer));
      const rawList = JSON.parse(jsonText) as RawUpstoxInstrument[];

      const mapped: LiveInstrumentItem[] = [];
      for (const r of rawList) {
        if (!r.trading_symbol || !r.instrument_key) continue;
        if (r.segment !== 'NSE_EQ' && r.segment !== 'NSE_INDEX' && r.segment !== 'NSE_FO') continue;
        mapped.push({
          symbol: r.trading_symbol,
          name: r.name || r.short_name || r.trading_symbol,
          exchange: r.exchange ?? 'NSE',
          segment: r.segment ?? 'NSE_EQ',
          instrumentType: r.instrument_type ?? 'EQ',
          instrumentKey: r.instrument_key,
          lotSize: r.lot_size ?? 1,
          tickSize: r.tick_size ?? 0.05,
        });
      }
      cachedMaster = mapped;
      cacheLoadedAt = Date.now();
      logger.info({ count: mapped.length }, 'Loaded Upstox NSE instrument master');
      return mapped;
    } catch (err) {
      logger.warn({ err }, 'Failed to fetch Upstox NSE instrument master; using DB fallback');
      return cachedMaster;
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

export const instrumentRoutes = new Elysia({ prefix: '/api/instruments' })
  .use(authPlugin)

  // ── GET /api/instruments/search?q=RELIANCE ────────────────────
  .get(
    '/search',
    async ({ query, userId, set }) => {
      if (!requireAuth(userId, set)) return { error: 'Unauthorized' };

      const q = (query.q ?? '').trim().toUpperCase();
      const seg = (query.segment ?? 'ALL').toUpperCase();
      const master = await loadUpstoxMaster();

      if (master.length > 0) {
        const filtered = master.filter((item) => {
          if (seg !== 'ALL' && !item.segment.includes(seg)) return false;
          if (!q) return item.segment === 'NSE_INDEX' || item.symbol === 'RELIANCE' || item.symbol === 'TCS';
          return item.symbol.toUpperCase().includes(q) || item.name.toUpperCase().includes(q);
        });

        // Prioritize exact & prefix symbol matches, then EQ/INDEX before F&O contracts
        filtered.sort((a, b) => {
          const aExact = a.symbol.toUpperCase() === q ? 0 : a.symbol.toUpperCase().startsWith(q) ? 1 : 2;
          const bExact = b.symbol.toUpperCase() === q ? 0 : b.symbol.toUpperCase().startsWith(q) ? 1 : 2;
          if (aExact !== bExact) return aExact - bExact;
          const aSeg = a.segment === 'NSE_INDEX' ? 0 : a.segment === 'NSE_EQ' ? 1 : 2;
          const bSeg = b.segment === 'NSE_INDEX' ? 0 : b.segment === 'NSE_EQ' ? 1 : 2;
          return aSeg - bSeg;
        });

        return { source: 'upstox-master', totalMasterCount: master.length, results: filtered.slice(0, 25) };
      }

      // DB fallback
      const pattern = `%${q}%`;
      const rows = await db
        .select()
        .from(instruments)
        .where(q ? or(ilike(instruments.symbol, pattern), ilike(instruments.name, pattern)) : eq(instruments.isActive, true))
        .limit(25);

      return {
        source: 'db',
        results: rows.map((r) => ({
          symbol: r.symbol,
          name: r.name ?? r.symbol,
          exchange: r.exchange ?? 'NSE',
          segment: r.segment ?? 'FO',
          instrumentType: r.instrumentType,
          instrumentKey: r.growwToken ?? r.symbol,
          lotSize: r.lotSize,
          tickSize: Number(r.tickSize ?? 0.05),
        })),
      };
    },
    {
      query: t.Object({
        q: t.Optional(t.String()),
        segment: t.Optional(t.String()),
      }),
    },
  )

  // ── POST /api/instruments/sync ────────────────────────────────
  .post('/sync', async ({ userId, set }) => {
    if (!requireAuth(userId, set)) return { error: 'Unauthorized' };
    const master = await loadUpstoxMaster(true);
    return { synced: true, count: master.length, source: 'upstox-master' };
  });
