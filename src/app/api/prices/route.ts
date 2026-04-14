import { NextResponse } from 'next/server';
import type { CommodityPrice } from '@/lib/types';

export const runtime = 'nodejs';
export const revalidate = 0;

let cachedPrices: CommodityPrice[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 12_000;

// Stooq symbols — works from all server IPs, no auth required
const COMMODITIES = [
  { stooq: 'cb.f', yahoo: 'BZ=F', symbol: 'BRT', name: 'Brent Crude',   unit: 'USD/bbl'   },
  { stooq: 'cl.f', yahoo: 'CL=F', symbol: 'WTI', name: 'WTI Crude',     unit: 'USD/bbl'   },
  { stooq: 'ng.f', yahoo: 'NG=F', symbol: 'HH',  name: 'Henry Hub Gas', unit: 'USD/MMBtu' },
  { stooq: 'ho.f', yahoo: 'HO=F', symbol: 'GO',  name: 'Heating Oil',   unit: 'USD/gal'   },
  { stooq: 'rb.f', yahoo: 'RB=F', symbol: 'RB',  name: 'RBOB Gasoline', unit: 'USD/gal'   },
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── Stooq quote: returns current OHLCV in one line of CSV ────────────────────
// Format: Symbol,Date,Time,Open,High,Low,Close,Volume
async function fetchStooq(sym: string) {
  const url = `https://stooq.com/q/l/?s=${sym}&f=sd2t2ohlcv&h&e=csv`;
  const r = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`Stooq HTTP ${r.status}`);
  const text = await r.text();
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('Stooq: no data row');
  const [, , , open, high, low, close] = lines[1].split(',');
  return {
    price: parseFloat(close),
    open:  parseFloat(open),
    high:  parseFloat(high),
    low:   parseFloat(low),
  };
}

// ── Yahoo v8 chart: used for 90-day history sparklines only ──────────────────
async function fetchHistory(yahooTicker: string): Promise<{ t: number; v: number }[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?interval=1d&range=90d`;
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, Referer: 'https://finance.yahoo.com/' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const data = await r.json();
    const ts:  number[]         = data?.chart?.result?.[0]?.timestamp ?? [];
    const cls: (number | null)[] = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    return ts
      .map((t, i) => ({ t: t * 1000, v: cls[i] as number }))
      .filter(p => p.v != null && p.v > 0);
  } catch { return []; }
}

export async function GET() {
  if (cachedPrices && Date.now() - cacheTime < CACHE_TTL) {
    return NextResponse.json({ prices: cachedPrices, updatedAt: new Date(cacheTime).toISOString(), cached: true });
  }

  const results: CommodityPrice[] = [];

  await Promise.allSettled(COMMODITIES.map(async (c) => {
    let price = 0, change = 0, changePct = 0, high = 0, low = 0, open = 0;

    try {
      const q = await fetchStooq(c.stooq);
      price = q.price;
      open  = q.open;
      high  = q.high;
      low   = q.low;
      // Use open as prev-close proxy for intraday change
      change    = +(price - open).toFixed(4);
      changePct = open !== 0 ? +((change / open) * 100).toFixed(4) : 0;
    } catch (err) {
      console.error(`[prices] Stooq ${c.stooq} failed:`, err);
    }

    const history = await fetchHistory(c.yahoo);

    results.push({
      symbol:    c.symbol,
      name:      c.name,
      shortName: c.symbol,
      price:     Math.round(price     * 100) / 100,
      change:    Math.round(change    * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
      high:      Math.round(high      * 100) / 100,
      low:       Math.round(low       * 100) / 100,
      open:      Math.round(open      * 100) / 100,
      unit:      c.unit,
      trend:     changePct > 0.05 ? 'up' : changePct < -0.05 ? 'down' : 'flat',
      history,
    });
  }));

  // Dubai Crude = Brent − $0.92
  const brt = results.find(p => p.symbol === 'BRT');
  if (brt && brt.price > 0) {
    const d = (n: number) => Math.round((n - 0.92) * 100) / 100;
    results.push({
      symbol: 'DUB', name: 'Dubai Crude', shortName: 'DUB',
      price: d(brt.price), change: brt.change, changePct: brt.changePct,
      high:  d(brt.high),  low:   d(brt.low),  open:     d(brt.open),
      unit:  'USD/bbl',    trend: brt.trend,
      history: brt.history.map(h => ({ ...h, v: d(h.v) })),
    });
  }

  const ORDER = ['BRT', 'WTI', 'DUB', 'HH', 'GO', 'RB'];
  results.sort((a, b) => ORDER.indexOf(a.symbol) - ORDER.indexOf(b.symbol));

  if (results.some(r => r.price > 0)) {
    cachedPrices = results;
    cacheTime    = Date.now();
  }

  return NextResponse.json({ prices: results, updatedAt: new Date().toISOString() });
}
