import { describe, expect, test } from 'bun:test';
import {
  classifyHeadlineDeterministic,
  matchWatchlistSymbol,
  parseRssItems,
} from '../src/services/news-service';

describe('NewsIngestion & AI Classifier', () => {
  test('parseRssItems extracts clean title, url, summary, and date from RSS XML', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss><channel>
        <item>
          <title><![CDATA[RELIANCE profit jumps 18% on Q3 retail surge]]></title>
          <link>https://example.com/news/reliance-q3</link>
          <description><![CDATA[<p>Strong <b>EBITDA</b> growth beats estimates.</p>]]></description>
          <pubDate>Fri, 28 Nov 2026 09:00:00 GMT</pubDate>
        </item>
      </channel></rss>`;
    const items = parseRssItems(xml, 'TestFeed');
    expect(items.length).toBe(1);
    expect(items[0]?.title).toBe('RELIANCE profit jumps 18% on Q3 retail surge');
    expect(items[0]?.url).toBe('https://example.com/news/reliance-q3');
    expect(items[0]?.summary).toBe('Strong EBITDA growth beats estimates.');
  });

  test('matchWatchlistSymbol matches pinned symbols and NIFTY/BANKNIFTY', () => {
    expect(matchWatchlistSymbol('TCS wins $500M cloud deal', ['RELIANCE', 'TCS'])).toBe('TCS');
    expect(matchWatchlistSymbol('Bank Nifty breaks 52000 resistance', ['RELIANCE'])).toBe('BANKNIFTY');
    expect(matchWatchlistSymbol('RBI holds repo rate steady', ['RELIANCE'])).toBeNull();
  });

  test('classifyHeadlineDeterministic assigns sentiment, eventType, and regime', () => {
    const bull = classifyHeadlineDeterministic(
      'RELIANCE profit jumps on strong Q3 results and order win',
      'Beats consensus estimates with record margin',
      'RELIANCE'
    );
    expect(bull.sentiment).toBe('BULLISH');
    expect(bull.eventType).toBe('EARNINGS');
    expect(bull.impactLevel).toBe('HIGH');

    const bear = classifyHeadlineDeterministic(
      'Stock plunges 9% after SEBI notice and earnings downgrade',
      'FII selling accelerates',
      'ABC'
    );
    expect(bear.sentiment).toBe('BEARISH');
    expect(bear.impactLevel).toBe('HIGH');
  });
});
