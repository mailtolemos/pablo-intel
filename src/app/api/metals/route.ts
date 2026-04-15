import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 0;

export interface MetalPrice {
  symbol:    string;
  name:      string;
  price:     number;
  change:    number;
  changePct: number;
  high:      number;
  low:       number;
  open:      number;
  unit:      string;
  category:  'precious' | 'base' | 'etf';
  trend:     'up' | 'down' | 'flat';
  source:    'pyth' | 'stooq' | 'yahoo';
  history:   { t: number; v: number }[];
}

let cachedMetals: MetalPrice[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 15_000;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── Pyth feed IDs — spot CFDs with active publishers ─────────────────────────
// Source: hermes.pyth.network/v2/price_feeds?asset_type=metals
const PYTH_METALS: Record<string, string> = {
  XAU: '765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2', // Gold spot CFD
  XAG: 'f2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e', // Silver spot CFD
  XPT: '398e4bbc7cbf89d6648c21e08019d878967677753b3096799595c78f805a34e5', // Platinum spot CFD
};

// ── Stooq futures symbols ─────────────────────────────────────────────────────
const STOOQ_METALS = [
  { stooq: 'gc.f', symbol: 'XAU', name: 'Gold',     unit: 'USD/oz', category: 'precious' as const },
  { stooq: 'si.f', symbol: 'XAG', name: 'Silver',   unit: 'USD/oz', category: 'precious' as const },
  { stooq: 'pl.f', symbol: 'XPT', name: 'Platinum', unit: 'USD/oz', category: 'precious' as const },
  { stooq: 'pa.f', symbol: 'XPD', name: 'Palladium',unit: 'USD/oz', category: 'precious' as const },
  { stooq: 'hg.f', symbol: 'CU',  name: 'Copper',   unit: 'USD/lb', category: 'base'     as const },
];

// ── Yahoo Finance ETF tickers (sector proxies) ────────────────────────────────
const YAHOO_ETFS = [
  { yahoo: 'GDX',  symbol: 'GDX',  name: 'Gold Miners ETF',       unit: 'USD',   category: 'etf' as const },
  { yahoo: 'SIL',  symbol: 'SIL',  name: 'Silver Miners ETF',     unit: 'USD',   category: 'etf' as const },
  { yahoo: 'COPX', symbol: 'COPX', name: 'Copper Miners ETF',     unit: 'USD',   category: 'etf' as const },
  { yahoo: 'LIT',  symbol: 'LIT',  name: 'Lithium & Battery ETF', unit: 'USD',   category: 'etf' as const },
  { yahoo: 'REMX', symbol: 'REMX', name: 'Rare Earth ETF',        unit: 'USD',   category: 'etf' as const },
  { yahoo: 'URNM', symbol: 'URNM', name: 'Uranium Miners ETF',    unit: 'USD',   category: 'etf' as const },
];

interface StooqQuote { price: number; open: number; high: number; low: number; }

async function fetchStooq(sym: string): Promise<StooqQuote> {
  const url = `https://stooq.com/q/l/?s=${sym}&f=sd2t2ohlcv&h&e=csv`;
  const r   = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(7000) });
  if (!r.ok) throw new Error(`Stooq HTTP ${r.status}`);
  const text  = await r.text();
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('Stooq: empty');
  const parts = lines[1].split(',');
  return {
    price: parseFloat(parts[6]),
    open:  parseFloat(parts[3]),
    high:  parseFloat(parts[4]),
    low:   parseFloat(parts[5]),
  };
}

interface PythPrice { price: number; publishTime: number; }

async function fetchPythPrices(): Promise<Record<string, PythPrice>> {
  const apiKey = process.env.PYTH_API_KEY;
  const ids = Object.values(PYTH_METALS).map(id => `ids[]=${id}`).join('&');
  const url  = `https://hermes.pyth.network/v2/updates/price/latest?${ids}${apiKey ? `&api-key=${apiKey}` : ''}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`Pyth HTTP ${r.status}`);
  const data = await r.json();
  const idToSym = Object.fromEntries(Object.entries(PYTH_METALS).map(([s, id]) => [id, s]));
  const result: Record<string, PythPrice> = {};
  for (const item of data?.parsed ?? []) {
    const sym = idToSym[item.id];
    if (!sym) continue;
    const p = item.price;
    const expo = parseInt(p.expo, 10);
    const price = parseInt(p.price, 10) * Math.pow(10, expo);
    if (price > 0) result[sym] = { price, publishTime: p.publish_time };
  }
  return result;
}

async function fetchHistory(yahoo: string): Promise<{ t: number; v: number }[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}?interval=1d&range=90d`;
    const r   = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://finance.yahoo.com/' }, signal: AbortSignal.timeout(7000) });
    if (!r.ok) return [];
    const data = await r.json();
    const ts:  number[]         = data?.chart?.result?.[0]?.timestamp ?? [];
    const cls: (number | null)[] = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    return ts.map((t, i) => ({ t: t * 1000, v: cls[i] as number })).filter(p => p.v != null && p.v > 0);
  } catch { return []; }
}

// Fetch a Yahoo Finance ETF quote (price, change, changePct, high, low, open)
async function fetchYahooETF(ticker: string): Promise<StooqQuote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2d`;
    const r   = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://finance.yahoo.com/' }, signal: AbortSignal.timeout(7000) });
    if (!r.ok) return null;
    const data = await r.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    return {
      price: meta.regularMarketPrice,
      open:  meta.regularMarketOpen  ?? meta.regularMarketPrice,
      high:  meta.regularMarketDayHigh ?? meta.regularMarketPrice,
      low:   meta.regularMarketDayLow  ?? meta.regularMarketPrice,
    };
  } catch { return null; }
}

export async function GET() {
  if (cachedMetals && Date.now() - cacheTime < CACHE_TTL) {
    return NextResponse.json({ metals: cachedMetals, updatedAt: new Date(cacheTime).toISOString(), cached: true });
  }

  // Fetch everything in parallel
  const [pythResult, ...stooqAndEtf] = await Promise.allSettled([
    fetchPythPrices(),
    ...STOOQ_METALS.map(m => fetchStooq(m.stooq).then(q => ({ symbol: m.symbol, quote: q }))),
    ...YAHOO_ETFS.map(e => fetchYahooETF(e.yahoo).then(q => ({ symbol: e.symbol, quote: q }))),
    ...STOOQ_METALS.map(m => {
      const yahooMap: Record<string, string> = {
        XAU: 'GC=F', XAG: 'SI=F', XPT: 'PL=F', XPD: 'PA=F', CU: 'HG=F',
      };
      return fetchHistory(yahooMap[m.symbol] || m.symbol);
    }),
  ]);

  const pyth: Record<string, PythPrice> = pythResult.status === 'fulfilled' ? pythResult.value : {};

  // Split stooqAndEtf: first STOOQ_METALS.length are stooq, next YAHOO_ETFS.length are ETFs, rest are histories
  const stooqResults = stooqAndEtf.slice(0, STOOQ_METALS.length);
  const etfResults   = stooqAndEtf.slice(STOOQ_METALS.length, STOOQ_METALS.length + YAHOO_ETFS.length);
  const histResults  = stooqAndEtf.slice(STOOQ_METALS.length + YAHOO_ETFS.length);

  const metals: MetalPrice[] = [];

  // Build precious/base metals from Stooq + Pyth overlay
  for (let i = 0; i < STOOQ_METALS.length; i++) {
    const m = STOOQ_METALS[i];
    const r = stooqResults[i];
    const stooq: StooqQuote | null = r.status === 'fulfilled' ? (r.value as { symbol: string; quote: StooqQuote }).quote : null;
    const pythPrice = pyth[m.symbol];

    const price = (pythPrice && pythPrice.price > 0) ? pythPrice.price : (stooq?.price ?? 0);
    const open  = stooq?.open ?? price;
    const high  = stooq?.high ?? price;
    const low   = stooq?.low  ?? price;
    const change    = +(price - open).toFixed(4);
    const changePct = open !== 0 ? +((change / open) * 100).toFixed(4) : 0;

    const histResult = histResults[i];
    const history = histResult?.status === 'fulfilled' ? (histResult.value as { t: number; v: number }[]) : [];

    const usedPyth = !!(pythPrice && pythPrice.price > 0);
    metals.push({
      symbol: m.symbol, name: m.name, unit: m.unit, category: m.category,
      price:  Math.round(price     * 100) / 100,
      change: Math.round(change    * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
      high:   Math.round(high      * 100) / 100,
      low:    Math.round(low       * 100) / 100,
      open:   Math.round(open      * 100) / 100,
      trend:  changePct > 0.05 ? 'up' : changePct < -0.05 ? 'down' : 'flat',
      source: usedPyth ? 'pyth' : 'stooq',
      history,
    });
  }

  // Build ETF entries
  for (let i = 0; i < YAHOO_ETFS.length; i++) {
    const e   = YAHOO_ETFS[i];
    const r   = etfResults[i];
    const q: StooqQuote | null = r.status === 'fulfilled' ? (r.value as { symbol: string; quote: StooqQuote | null }).quote : null;
    if (!q || q.price <= 0) continue;

    const change    = +(q.price - q.open).toFixed(4);
    const changePct = q.open !== 0 ? +((change / q.open) * 100).toFixed(4) : 0;

    metals.push({
      symbol: e.symbol, name: e.name, unit: e.unit, category: e.category,
      price:     Math.round(q.price * 100) / 100,
      change:    Math.round(change  * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
      high:      Math.round(q.high  * 100) / 100,
      low:       Math.round(q.low   * 100) / 100,
      open:      Math.round(q.open  * 100) / 100,
      trend:     changePct > 0.05 ? 'up' : changePct < -0.05 ? 'down' : 'flat',
      source:    'yahoo',
      history:   [],
    });
  }

  if (metals.some(m => m.price > 0)) {
    cachedMetals = metals;
    cacheTime    = Date.now();
  }

  return NextResponse.json({ metals, updatedAt: new Date().toISOString() });
}
