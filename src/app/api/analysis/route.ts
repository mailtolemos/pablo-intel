import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const revalidate = 0;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Recommendation {
  commodity: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD' | 'WATCH';
  currentPrice: number;
  entryZone: string;      // e.g. "$78.00–$79.50"
  target: string;         // e.g. "$85.00"
  stopLoss: string;       // e.g. "$75.00"
  timeframe: string;      // e.g. "2–4 WEEKS"
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  rationale: string;
  risks: string[];
}

export interface AnalysisResult {
  type: 'oil' | 'minerals';
  generatedAt: string;
  nextUpdateAt: string;
  outlookLabel: string;       // e.g. "BEARISH", "CAUTIOUSLY BULLISH"
  outlookScore: number;       // -100 (bearish) to +100 (bullish)
  executiveSummary: string;
  recommendations: Recommendation[];
  keyLevels: { label: string; price: string; significance: string }[];
  catalysts: { date: string; event: string; impact: string }[];
  disclaimer: string;
}

// ── In-memory cache (1 hour per type) ────────────────────────────────────────
const cache: Record<string, { result: AnalysisResult; ts: number }> = {};
const CACHE_TTL = 60 * 60 * 1_000; // 1 hour

const BASE = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

// ── Fetch helpers ─────────────────────────────────────────────────────────────
async function fetchJSON(path: string) {
  try {
    const r = await fetch(`${BASE}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    return r.ok ? r.json() : null;
  } catch { return null; }
}

// ── Build oil context ─────────────────────────────────────────────────────────
async function buildOilContext() {
  const [priceData, newsData, shipData] = await Promise.all([
    fetchJSON('/api/prices'),
    fetchJSON('/api/news'),
    fetchJSON('/api/ships'),
  ]);

  const prices: Record<string, { price: number; change: number; changePct: number; high: number; low: number }> = {};
  for (const p of priceData?.prices ?? []) {
    prices[p.symbol] = { price: p.price, change: p.change, changePct: p.changePct, high: p.high, low: p.low };
  }

  const brt = prices['BRT'];
  const wti = prices['WTI'];
  const hh  = prices['HH'];
  const rb  = prices['RB'];
  const go  = prices['GO'];

  const spread = brt && wti ? (brt.price - wti.price).toFixed(2) : 'N/A';
  const crack  = rb && go && wti
    ? ((2 * rb.price * 42 + go.price * 42 - 3 * wti.price) / 3).toFixed(2)
    : 'N/A';

  const headlines = (newsData?.news ?? []).slice(0, 12)
    .map((n: { title: string; direction: string; impactScore: number; source: string }) =>
      `• [${n.direction.toUpperCase()} | score:${n.impactScore}] ${n.title} (${n.source})`)
    .join('\n');

  const threats = (shipData?.threats ?? [])
    .filter((t: { active: boolean }) => t.active)
    .slice(0, 8)
    .map((t: { severity: string; title: string; region: string; impact: string }) =>
      `• [${t.severity.toUpperCase()}] ${t.title} — ${t.region}: ${t.impact}`)
    .join('\n');

  const chokepoints = (shipData?.chokepoints ?? [])
    .map((c: { name: string; status: string; throughputMbpd: number; riskLevel: number }) =>
      `• ${c.name}: ${c.status.toUpperCase()} (${c.throughputMbpd} Mb/d, risk ${c.riskLevel}/5)`)
    .join('\n');

  return `
=== PABLO INTEL — OIL MARKET DATA SNAPSHOT (${new Date().toUTCString()}) ===

CURRENT PRICES:
• Brent Crude (BRT): $${brt?.price ?? 'N/A'}/bbl  Δ${brt?.changePct ?? 0}%  [H:${brt?.high ?? '-'} / L:${brt?.low ?? '-'}]
• WTI Crude (WTI):   $${wti?.price ?? 'N/A'}/bbl  Δ${wti?.changePct ?? 0}%  [H:${wti?.high ?? '-'} / L:${wti?.low ?? '-'}]
• Henry Hub (HH):    $${hh?.price ?? 'N/A'}/MMBtu Δ${hh?.changePct ?? 0}%
• RBOB Gasoline (RB):$${rb?.price ?? 'N/A'}/gal   Δ${rb?.changePct ?? 0}%
• Heating Oil (GO):  $${go?.price ?? 'N/A'}/gal   Δ${go?.changePct ?? 0}%

KEY DERIVED METRICS:
• Brent–WTI spread: $${spread}/bbl
• 3-2-1 Crack spread: $${crack}/bbl
• OPEC+ spare capacity: ~3.2 Mb/d (historically tight)
• US SPR: ~360 Mb (~40-year low, refill ongoing)

GEOPOLITICAL / CHOKEPOINTS:
${chokepoints || 'No data'}

ACTIVE THREAT MATRIX:
${threats || 'No active threats logged'}

RECENT MARKET INTELLIGENCE (news, last 24h):
${headlines || 'No recent news'}
`.trim();
}

// ── Build minerals context ────────────────────────────────────────────────────
async function buildMineralsContext() {
  const [metalData, newsData] = await Promise.all([
    fetchJSON('/api/metals'),
    fetchJSON('/api/minerals-news'),
  ]);

  const metals: Record<string, { price: number; change: number; changePct: number; source: string }> = {};
  for (const m of metalData?.metals ?? []) {
    metals[m.symbol] = { price: m.price, change: m.change, changePct: m.changePct, source: m.source };
  }

  const xau = metals['XAU'];
  const xag = metals['XAG'];
  const xpt = metals['XPT'];
  const xpd = metals['XPD'];
  const cu  = metals['CU'];

  const gsRatio  = xau && xag ? (xau.price / xag.price).toFixed(1) : 'N/A';
  const ptPdSprd = xpt && xpd ? (xpt.price - xpd.price).toFixed(0) : 'N/A';

  const headlines = (newsData?.articles ?? []).slice(0, 12)
    .map((n: { title: string; minerals: string[]; source: string }) =>
      `• [${(n.minerals ?? []).join(',')||'GENERAL'}] ${n.title} (${n.source})`)
    .join('\n');

  return `
=== PABLO INTEL — MINERALS MARKET DATA SNAPSHOT (${new Date().toUTCString()}) ===

CURRENT PRICES (source noted):
• Gold (XAU):     $${xau?.price?.toFixed(2) ?? 'N/A'}/oz  Δ${xau?.changePct ?? 0}% [${xau?.source ?? '-'}]
• Silver (XAG):   $${xag?.price?.toFixed(3) ?? 'N/A'}/oz  Δ${xag?.changePct ?? 0}% [${xag?.source ?? '-'}]
• Platinum (XPT): $${xpt?.price?.toFixed(2) ?? 'N/A'}/oz  Δ${xpt?.changePct ?? 0}% [${xpt?.source ?? '-'}]
• Palladium (XPD):$${xpd?.price?.toFixed(2) ?? 'N/A'}/oz  Δ${xpd?.changePct ?? 0}% [${xpd?.source ?? '-'}]
• Copper (CU):    $${cu?.price?.toFixed(3)  ?? 'N/A'}/lb  Δ${cu?.changePct  ?? 0}% [${cu?.source  ?? '-'}]

KEY RATIOS & SPREADS:
• Gold/Silver ratio: ${gsRatio}x  (>90 = silver historically cheap; ~80 = normal)
• Platinum–Palladium spread: $${ptPdSprd}/oz  (positive = Pt premium, negative = Pd premium)

STRUCTURAL SUPPLY CONTEXT:
• China REE/Gallium/Germanium export controls: ACTIVE since 2023
• DRC Cobalt production: 70% global share — exposed to political risk
• South Africa PGMs: Eskom load shedding constraining output (Stage 4–6)
• Russia Palladium: 40% global supply under G7 sanctions pressure
• Chile Copper: 27% global share — royalty legislation risk pending
• Indonesia Nickel: Export ban reshaping global supply chain
• Kazatomprom (Kazakhstan): Controls 45% global uranium production

RECENT MARKET INTELLIGENCE:
${headlines || 'No recent news'}
`.trim();
}

// ── Claude analysis prompt ────────────────────────────────────────────────────
function buildPrompt(type: 'oil' | 'minerals', context: string): string {
  const assetList = type === 'oil'
    ? 'Brent Crude (BRT), WTI Crude (WTI), Henry Hub Gas (HH), RBOB Gasoline (RB), Heating Oil (GO)'
    : 'Gold (XAU), Silver (XAG), Platinum (XPT), Palladium (XPD), Copper (CU)';

  return `You are a senior commodities analyst at an institutional trading desk. You have just received the following live market data snapshot.

${context}

Based ONLY on this real data, produce an honest, specific, actionable market analysis for retail and institutional traders. Be direct — avoid hedging language like "may", "could", "might" unless genuinely uncertain. Give specific price levels.

Assets to cover: ${assetList}

Respond with ONLY a valid JSON object matching this exact schema (no markdown, no explanation, just the JSON):

{
  "outlookLabel": "string (e.g. BEARISH, CAUTIOUSLY BULLISH, NEUTRAL, STRONGLY BULLISH)",
  "outlookScore": number (-100 to +100, negative=bearish, positive=bullish),
  "executiveSummary": "string (3–4 sentences: current state, key driver, main risk, actionable bottom line)",
  "recommendations": [
    {
      "commodity": "Full name e.g. Brent Crude",
      "symbol": "BRT",
      "action": "BUY | SELL | HOLD | WATCH",
      "currentPrice": number,
      "entryZone": "e.g. $78.00–$79.50 or 'current'",
      "target": "e.g. $85.00",
      "stopLoss": "e.g. $75.50",
      "timeframe": "e.g. 2–4 WEEKS",
      "confidence": "HIGH | MEDIUM | LOW",
      "rationale": "2–3 sentences explaining WHY with specific reference to the data above",
      "risks": ["risk 1", "risk 2"]
    }
  ],
  "keyLevels": [
    { "label": "e.g. Brent key support", "price": "$78.50", "significance": "one sentence" }
  ],
  "catalysts": [
    { "date": "e.g. Wed 15:30 UTC", "event": "EIA Crude Inventory", "impact": "one sentence on expected market impact" }
  ],
  "disclaimer": "short 1-sentence risk disclaimer"
}

Rules:
- Include a recommendation for EACH asset
- Use the actual live prices from the data for currentPrice
- Be specific with price levels based on technical analysis inferred from high/low/current
- If data shows a commodity is trending up strongly, say BUY and say why
- If bearish pressure is evident, say SELL or WATCH
- The rationale MUST reference specific numbers from the data (e.g. "crack spread at $X signals...")
- Keep each rationale under 60 words
- Maximum 3 keyLevels and 4 catalysts`;
}

// ── Parse and validate Claude response ───────────────────────────────────────
function parseAnalysis(raw: string, type: 'oil' | 'minerals'): AnalysisResult {
  // Strip any markdown code fences if present
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const parsed  = JSON.parse(cleaned);

  const now     = new Date();
  const nextHr  = new Date(now.getTime() + CACHE_TTL);

  return {
    type,
    generatedAt:      now.toISOString(),
    nextUpdateAt:     nextHr.toISOString(),
    outlookLabel:     parsed.outlookLabel     ?? 'NEUTRAL',
    outlookScore:     parsed.outlookScore     ?? 0,
    executiveSummary: parsed.executiveSummary ?? '',
    recommendations:  parsed.recommendations  ?? [],
    keyLevels:        parsed.keyLevels        ?? [],
    catalysts:        parsed.catalysts        ?? [],
    disclaimer:       parsed.disclaimer       ?? 'All recommendations are for informational purposes only. Not financial advice.',
  };
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const type = (req.nextUrl.searchParams.get('type') ?? 'oil') as 'oil' | 'minerals';

  // Return cached result if fresh
  const cached = cache[type];
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ ...cached.result, cached: true });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

  try {
    // Build context from live data
    const context = type === 'oil'
      ? await buildOilContext()
      : await buildMineralsContext();

    const prompt = buildPrompt(type, context);

    // Call Claude
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages:   [{ role: 'user', content: prompt }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text;
    const result = parseAnalysis(raw, type);

    // Store in cache
    cache[type] = { result, ts: Date.now() };

    return NextResponse.json(result);
  } catch (err) {
    console.error('Analysis error:', err);
    return NextResponse.json(
      { error: 'Analysis generation failed', detail: String(err) },
      { status: 500 }
    );
  }
}
