import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 0;

interface NewsItem {
  id:          string;
  title:       string;
  summary:     string;
  url:         string;
  source:      string;
  publishedAt: string;
  category:    string;
  relevance:   number;
  minerals:    string[];
}

interface NewsCache {
  articles: NewsItem[];
  updatedAt: string;
  sourceCount: number;
}

let newsCache: NewsCache | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const UA = 'Mozilla/5.0 (compatible; MineralsWatchtower/1.0; +https://pablo-intel.vercel.app)';

// ── RSS feeds focused on metals, mining, and critical minerals ───────────────
const RSS_FEEDS = [
  // Mining specific
  { url: 'https://www.mining.com/feed/',                    source: 'Mining.com' },
  { url: 'https://www.miningweekly.com/rss/latest',         source: 'Mining Weekly' },
  { url: 'https://www.northernminer.com/feed/',             source: 'Northern Miner' },
  { url: 'https://www.miningmagazine.com/feed/',            source: 'Mining Magazine' },

  // Metals/commodities
  { url: 'https://www.kitco.com/rss/news.rss',              source: 'Kitco' },
  { url: 'https://www.metalsbulletin.com/rss/latest/',      source: 'Metals Bulletin' },
  { url: 'https://www.resourceworld.com/feed/',             source: 'Resource World' },

  // Finance/macro (metals angle)
  { url: 'https://feeds.bloomberg.com/markets/news.rss',   source: 'Bloomberg Markets' },
  { url: 'https://feeds.reuters.com/reuters/businessNews',  source: 'Reuters Business' },
  { url: 'https://www.ft.com/rss/home',                    source: 'Financial Times' },

  // Critical minerals / EV / battery
  { url: 'https://www.benchmarkminerals.com/feed/',         source: 'Benchmark Mineral' },
  { url: 'https://www.spglobal.com/commodityinsights/en/rss', source: 'S&P Commodity' },

  // General commodity
  { url: 'https://oilprice.com/rss/main',                   source: 'OilPrice.com' },
  { url: 'https://www.investing.com/rss/news_14.rss',       source: 'Investing.com Commodities' },
  { url: 'https://seekingalpha.com/tag/gold.xml',            source: 'Seeking Alpha Gold' },
];

// Keywords by mineral category for relevance scoring
const MINERAL_KEYWORDS: Record<string, string[]> = {
  gold:      ['gold', 'xau', 'bullion', 'comex gold', 'lbma', 'gold futures', 'gold price', 'gold reserve', 'central bank gold'],
  silver:    ['silver', 'xag', 'silver price', 'silver futures', 'silver mining'],
  platinum:  ['platinum', 'xpt', 'pgm', 'platinum group', 'platinum price'],
  palladium: ['palladium', 'xpd', 'palladium price', 'pgm', 'auto catalyst'],
  copper:    ['copper', 'hg futures', 'copper price', 'copper mining', 'comex copper', 'dr copper'],
  lithium:   ['lithium', 'lithium price', 'lithium carbonate', 'lioh', 'battery metal', 'ev metal'],
  cobalt:    ['cobalt', 'cobalt price', 'drc cobalt', 'battery cobalt'],
  nickel:    ['nickel', 'lme nickel', 'nickel price', 'nickel sulfate'],
  uranium:   ['uranium', 'uranium price', 'nuclear fuel', 'sprott uranium', 'uranium miner'],
  rare_earth: ['rare earth', 'neodymium', 'praseodymium', 'dysprosium', 'lanthanum', 'cerium', 'remx', 'mp materials', 'china rare earth'],
  general:   ['mining', 'mineral', 'metal price', 'commodity', 'lme', 'comex', 'precious metal', 'base metal', 'critical mineral'],
};

const ALL_KEYWORDS = Object.values(MINERAL_KEYWORDS).flat();

function detectMinerals(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const [mineral, keywords] of Object.entries(MINERAL_KEYWORDS)) {
    if (mineral === 'general') continue;
    if (keywords.some(kw => lower.includes(kw))) found.push(mineral);
  }
  return found.filter((v, i, a) => a.indexOf(v) === i);
}

function scoreRelevance(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const kw of ALL_KEYWORDS) {
    if (lower.includes(kw)) score += kw.split(' ').length > 1 ? 3 : 1;
  }
  return Math.min(score, 10);
}

async function fetchFeed(url: string, source: string): Promise<NewsItem[]> {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const xml = await r.text();

    const items: NewsItem[] = [];
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const get = (tag: string) => {
        const m = block.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
        return m ? m[1].trim() : '';
      };

      const title   = get('title').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '');
      const link    = get('link') || get('guid');
      const desc    = get('description').replace(/<[^>]+>/g, '').trim().slice(0, 300);
      const pubDate = get('pubDate') || get('dc:date') || get('published');

      if (!title || !link) continue;

      const combined = `${title} ${desc}`.toLowerCase();
      const relevance = scoreRelevance(combined);
      if (relevance < 2) continue;

      const minerals = detectMinerals(combined);

      items.push({
        id:          `${source}-${Buffer.from(link).toString('base64').slice(0, 12)}`,
        title,
        summary:     desc || 'No summary available.',
        url:         link,
        source,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        category:    minerals.length > 0 ? minerals[0] : 'general',
        relevance,
        minerals,
      });
    }
    return items;
  } catch {
    return [];
  }
}

export async function GET() {
  if (newsCache && Date.now() - cacheTime < CACHE_TTL) {
    return NextResponse.json({ ...newsCache, cached: true });
  }

  const results = await Promise.allSettled(
    RSS_FEEDS.map(f => fetchFeed(f.url, f.source))
  );

  const all: NewsItem[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // Deduplicate by title similarity, sort by relevance then recency
  const seenKeys: string[] = [];
  const deduped = all.filter(item => {
    const key = item.title.toLowerCase().slice(0, 60);
    if (seenKeys.includes(key)) return false;
    seenKeys.push(key);
    return true;
  });

  deduped.sort((a, b) => {
    const scoreDiff = b.relevance - a.relevance;
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  const final = deduped.slice(0, 60);

  const payload: NewsCache = {
    articles:    final,
    updatedAt:   new Date().toISOString(),
    sourceCount: RSS_FEEDS.length,
  };

  if (final.length > 0) {
    newsCache = payload;
    cacheTime = Date.now();
  }

  return NextResponse.json(payload);
}
