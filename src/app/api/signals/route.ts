import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 0;

// ── Signal types ──────────────────────────────────────────────────────────────
export type SignalAction = 'BUY' | 'SELL' | 'HOLD' | 'WATCH';

export interface AssetSignal {
  symbol:      string;           // BTC, GOLD, USOIL
  name:        string;           // Bitcoin, Gold, WTI Crude
  action:      SignalAction;
  price:       number;
  priceStr:    string;           // formatted, e.g. "$94,500" or "$2,310.50"
  change:      number;           // % change on the day
  entryZone:   string;
  target:      string;
  stopLoss:    string;
  timeframe:   string;
  confidence:  'HIGH' | 'MEDIUM' | 'LOW';
  rationale:   string;
  indicators?: string;           // optional: RSI, EMA status, etc.
  updatedAt:   string;           // ISO timestamp
}

export interface SignalsPayload {
  signals:     Record<string, AssetSignal>;  // keyed by symbol
  updatedAt:   string;
}

// ── In-memory store ───────────────────────────────────────────────────────────
let store: SignalsPayload = {
  signals:   {},
  updatedAt: '',
};

// ── GET: return current signals ───────────────────────────────────────────────
export async function GET() {
  return NextResponse.json(store);
}

// ── POST: update one or more signals (requires auth token) ────────────────────
export async function POST(req: NextRequest) {
  const secret = process.env.SIGNALS_SECRET;

  // If SIGNALS_SECRET is set, require it; if not configured, allow open writes
  if (secret) {
    const auth = req.headers.get('authorization') ?? '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (token !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: Partial<SignalsPayload> & { signal?: AssetSignal };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Accept either a full payload or a single signal object
  if (body.signal) {
    // Single signal update
    const s = body.signal;
    if (!s.symbol) return NextResponse.json({ error: 'signal.symbol required' }, { status: 400 });
    store.signals[s.symbol] = { ...s, updatedAt: s.updatedAt ?? new Date().toISOString() };
    store.updatedAt = new Date().toISOString();
  } else if (body.signals) {
    // Full payload replacement or merge
    store.signals  = { ...store.signals, ...body.signals };
    store.updatedAt = new Date().toISOString();
  } else {
    return NextResponse.json({ error: 'Provide signal or signals field' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, updatedAt: store.updatedAt });
}
