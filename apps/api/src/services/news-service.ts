import { desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { getISTDateString, getISTTimeString } from '@groww-trading/shared';
import { db } from '../db';
import { aiMarketBriefs, marketNews, watchlists } from '../db/schema';
import { logger } from '../logger';

export type NewsSentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type ImpactLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type EventType = 'EARNINGS' | 'CORPORATE' | 'MACRO' | 'TECHNICAL' | 'GENERAL';

export interface AnalyzedNewsItem {
  symbol: string | null;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: Date;
  sentiment: NewsSentiment;
  impactLevel: ImpactLevel;
  eventType: EventType;
  aiRationale: string;
  suggestedRegime: string;
}

const RSS_FEEDS: Array<{ source: string; url: string }> = [
  {
    source: 'Economic Times Markets',
    url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
  },
  {
    source: 'Livemint Markets',
    url: 'https://www.livemint.com/rss/markets',
  },
  {
    source: 'Moneycontrol Market Reports',
    url: 'https://www.moneycontrol.com/rss/marketreports.xml',
  },
];

const BULLISH_TERMS = [
  'surge', 'rally', 'beats', 'profit jumps', 'order win', 'upgrade', 'buyback',
  'breakout', 'bullish', 'record high', 'fii buying', 'rate cut', 'growth', 'outperform',
];
const BEARISH_TERMS = [
  'plunge', 'slump', 'falls', 'misses', 'downgrade', 'loss widens', 'penalty',
  'probe', 'sebi notice', 'fii selling', 'bearish', 'breakdown', 'default', 'warning',
];
const EARNINGS_TERMS = ['q1', 'q2', 'q3', 'q4', 'results', 'earnings', 'ebitda', 'margin', 'revenue'];
const MACRO_TERMS = ['rbi', 'inflation', 'cpi', 'gdp', 'fed', 'us yield', 'crude', 'fii', 'dii', 'nifty', 'sensex'];
const CORPORATE_TERMS = ['order', 'acquisition', 'merger', 'dividend', 'buyback', 'board', 'stake', 'ipo'];

function decodeHtml(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match?.[1] ? decodeHtml(match[1]) : '';
}

export function parseRssItems(
  xml: string,
  source: string
): Array<{ title: string; summary: string; url: string; publishedAt: Date }> {
  const items: Array<{ title: string; summary: string; url: string; publishedAt: Date }> = [];
  const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  for (const rawItem of itemMatches.slice(0, 20)) {
    const title = extractTag(rawItem, 'title');
    const url = extractTag(rawItem, 'link');
    const summary = extractTag(rawItem, 'description').slice(0, 400);
    const pubRaw = extractTag(rawItem, 'pubDate');
    const publishedAt = pubRaw && !Number.isNaN(Date.parse(pubRaw)) ? new Date(pubRaw) : new Date();

    if (title && url) {
      items.push({ title, summary, url, publishedAt });
    }
  }
  return items;
}

export function matchWatchlistSymbol(text: string, symbols: string[]): string | null {
  const upper = text.toUpperCase();
  for (const sym of symbols) {
    const clean = sym.trim().toUpperCase();
    if (!clean) continue;
    if (upper.includes(clean)) return clean;
  }
  if (upper.includes('BANK NIFTY') || upper.includes('BANKNIFTY')) return 'BANKNIFTY';
  if (upper.includes('NIFTY')) return 'NIFTY';
  return null;
}

export function classifyHeadlineDeterministic(
  title: string,
  summary: string,
  symbol: string | null
): Omit<AnalyzedNewsItem, 'symbol' | 'title' | 'summary' | 'source' | 'url' | 'publishedAt'> {
  const text = `${title} ${summary}`.toLowerCase();

  let bullScore = 0;
  let bearScore = 0;
  for (const w of BULLISH_TERMS) if (text.includes(w)) bullScore++;
  for (const w of BEARISH_TERMS) if (text.includes(w)) bearScore++;

  const sentiment: NewsSentiment =
    bullScore > bearScore ? 'BULLISH' : bearScore > bullScore ? 'BEARISH' : 'NEUTRAL';

  let eventType: EventType = 'GENERAL';
  if (EARNINGS_TERMS.some((t) => text.includes(t))) eventType = 'EARNINGS';
  else if (CORPORATE_TERMS.some((t) => text.includes(t))) eventType = 'CORPORATE';
  else if (MACRO_TERMS.some((t) => text.includes(t))) eventType = 'MACRO';

  const impactLevel: ImpactLevel =
    Math.abs(bullScore - bearScore) >= 2 || eventType === 'EARNINGS' || eventType === 'MACRO'
      ? 'HIGH'
      : bullScore + bearScore > 0
        ? 'MEDIUM'
        : 'LOW';

  const suggestedRegime =
    eventType === 'EARNINGS'
      ? 'WAIT_FOR_IV_CRUSH_OR_ORB'
      : sentiment === 'BULLISH'
        ? 'TREND_LONG_9_21_EMA'
        : sentiment === 'BEARISH'
          ? 'TREND_SHORT_OR_HEDGE'
          : 'RANGEBOUND_VWAP';

  const target = symbol ?? 'Broad Market';
  const aiRationale =
    sentiment === 'BULLISH'
      ? `Positive momentum catalyst detected for ${target} (${eventType.toLowerCase()}). Favor pullback entries above VWAP or bullish 9/21 EMA confirmation.`
      : sentiment === 'BEARISH'
        ? `Risk-off / negative catalyst detected for ${target} (${eventType.toLowerCase()}). Tighten stop-losses and avoid catching falling knives without reversal confirmation.`
        : `Informational ${eventType.toLowerCase()} update for ${target}. Wait for price-action breakout before committing directional risk.`;

  return { sentiment, impactLevel, eventType, aiRationale, suggestedRegime };
}

async function classifyHeadlineWithOptionalLLM(
  title: string,
  summary: string,
  symbol: string | null
): Promise<Omit<AnalyzedNewsItem, 'symbol' | 'title' | 'summary' | 'source' | 'url' | 'publishedAt'>> {
  const openAiKey = process.env['OPENAI_API_KEY'];
  if (openAiKey && !openAiKey.startsWith('your-')) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey}`,
        },
        signal: AbortSignal.timeout(6_000),
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are an Indian equity & F&O quant analyst. Return JSON with keys: sentiment (BULLISH|BEARISH|NEUTRAL), impactLevel (HIGH|MEDIUM|LOW), eventType (EARNINGS|CORPORATE|MACRO|TECHNICAL|GENERAL), aiRationale (max 2 sentences), suggestedRegime (short snake_case label).',
            },
            {
              role: 'user',
              content: `Symbol: ${symbol ?? 'MARKET'}\nTitle: ${title}\nSummary: ${summary}`,
            },
          ],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const raw = data.choices?.[0]?.message?.content;
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<AnalyzedNewsItem>;
          if (parsed.sentiment && parsed.impactLevel && parsed.eventType && parsed.aiRationale) {
            return {
              sentiment: parsed.sentiment,
              impactLevel: parsed.impactLevel,
              eventType: parsed.eventType,
              aiRationale: parsed.aiRationale,
              suggestedRegime: parsed.suggestedRegime ?? 'TREND_FOLLOWING',
            };
          }
        }
      }
    } catch (err) {
      logger.warn({ err }, 'LLM news classification failed; falling back to deterministic classifier');
    }
  }

  return classifyHeadlineDeterministic(title, summary, symbol);
}

export async function refreshWatchlistNews(userId: string): Promise<{ inserted: number; briefId: string | null }> {
  const userWatchlist = await db
    .select({ symbol: watchlists.symbol })
    .from(watchlists)
    .where(eq(watchlists.userId, userId));

  const pinnedSymbols = Array.from(
    new Set(['NIFTY', 'BANKNIFTY', ...userWatchlist.map((w) => w.symbol.toUpperCase())])
  );

  let inserted = 0;

  for (const feed of RSS_FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: { 'User-Agent': 'AI-Trader-Monolith/1.0' },
        signal: AbortSignal.timeout(6_000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const parsedItems = parseRssItems(xml, feed.source);

      for (const item of parsedItems) {
        const matchedSymbol = matchWatchlistSymbol(`${item.title} ${item.summary}`, pinnedSymbols);
        const analysis = await classifyHeadlineWithOptionalLLM(item.title, item.summary, matchedSymbol);

        const rows = await db
          .insert(marketNews)
          .values({
            symbol: matchedSymbol,
            title: item.title,
            summary: item.summary,
            source: feed.source,
            url: item.url,
            publishedAt: item.publishedAt,
            sentiment: analysis.sentiment,
            impactLevel: analysis.impactLevel,
            eventType: analysis.eventType,
            aiRationale: analysis.aiRationale,
            suggestedRegime: analysis.suggestedRegime,
          })
          .onConflictDoNothing({ target: marketNews.url })
          .returning({ id: marketNews.id });

        inserted += rows.length;
      }
    } catch (err) {
      logger.warn({ err, source: feed.source }, 'Failed fetching RSS feed');
    }
  }

  const brief = await generateAndStoreMarketBrief(userId, pinnedSymbols);
  return { inserted, briefId: brief?.id ?? null };
}

export async function generateAndStoreMarketBrief(userId: string, pinnedSymbols: string[]) {
  const recent = await db
    .select()
    .from(marketNews)
    .where(or(isNull(marketNews.symbol), inArray(marketNews.symbol, pinnedSymbols)))
    .orderBy(desc(marketNews.publishedAt))
    .limit(20);

  const bullishCount = recent.filter((n) => n.sentiment === 'BULLISH').length;
  const bearishCount = recent.filter((n) => n.sentiment === 'BEARISH').length;
  const highImpactCount = recent.filter((n) => n.impactLevel === 'HIGH').length;

  const marketRegime =
    highImpactCount >= 4
      ? 'HIGH_VOLATILITY'
      : Math.abs(bullishCount - bearishCount) >= 3
        ? 'TRENDING'
        : 'RANGEBOUND';

  const now = new Date();
  const istTime = getISTTimeString(now);
  const briefType = istTime < '09:15' ? 'PRE_MARKET' : istTime >= '15:30' ? 'POST_MARKET' : 'INTRADAY';
  const istDate = getISTDateString(now);

  const headline =
    recent.length === 0
      ? `Market Pulse (${istDate}): No new RSS catalysts ingested yet — stick to 9/21 EMA & VWAP price action.`
      : `${briefType.replace('_', ' ')} Bias: ${bullishCount} Bullish vs ${bearishCount} Bearish catalysts (${marketRegime})`;

  const highlights = pinnedSymbols.slice(0, 6).map((sym) => {
    const symNews = recent.filter((n) => n.symbol === sym);
    const top = symNews[0];
    return {
      symbol: sym,
      count: symNews.length,
      sentiment: top?.sentiment ?? 'NEUTRAL',
      topHeadline: top?.title ?? 'No symbol-specific news in latest feed',
    };
  });

  const summaryLines = [
    `**Regime:** \`${marketRegime}\` | **Signals scanned:** ${recent.length} (${highImpactCount} high-impact)`,
    `**Watchlist coverage:** ${pinnedSymbols.join(', ')}`,
    ...recent.slice(0, 4).map((n) => `- [${n.sentiment}] **${n.symbol ?? 'MARKET'}**: ${n.title}`),
  ];

  const [created] = await db
    .insert(aiMarketBriefs)
    .values({
      userId,
      briefType,
      istDate,
      headline,
      summaryMarkdown: summaryLines.join('\n'),
      marketRegime,
      watchlistHighlights: highlights,
    })
    .returning();

  return created;
}
