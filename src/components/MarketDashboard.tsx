'use client';
import { useEffect, useState } from 'react';
import type { CommodityPrice } from '@/lib/types';

/* ── Upcoming market events (static schedule) ─────────────────────────── */
const WEEKLY_EVENTS = [
  { day: 3, hour: 15, min: 30, label: 'EIA Crude Inventory',  short: 'EIA',  color: 'var(--blue)' },
  { day: 2, hour: 21, min: 30, label: 'API Crude Inventory',  short: 'API',  color: 'var(--amber)' },
  { day: 5, hour: 17, min: 0,  label: 'Baker Hughes Rig Count', short: 'BH', color: 'var(--green)' },
];

function nextEventMs(dayOfWeek: number, hour: number, min: number): number {
  const now  = new Date();
  const utcDay = now.getUTCDay();         // 0=Sun
  let daysAhead = (dayOfWeek - utcDay + 7) % 7;
  const eventMinutes = hour * 60 + min;
  const nowMinutes   = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (daysAhead === 0 && nowMinutes >= eventMinutes) daysAhead = 7;
  const target = new Date(now);
  target.setUTCDate(now.getUTCDate() + daysAhead);
  target.setUTCHours(hour, min, 0, 0);
  return target.getTime() - now.getTime();
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'NOW';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 48) return `${Math.floor(h / 24)}d`;
  if (h > 0)  return `${h}h ${m}m`;
  return `${m}m`;
}

/* ── Single metric card ───────────────────────────────────────────────── */
function MetricCard({
  label, value, sub, color = 'var(--text)', tooltip,
}: {
  label: string; value: string; sub?: string; color?: string; tooltip?: string;
}) {
  return (
    <div className="bg-terminal-surface border border-terminal-border rounded p-2.5 flex flex-col gap-1 hover:border-terminal-blue/40 transition-colors duration-200"
      title={tooltip}>
      <div className="text-[8px] font-['Orbitron'] tracking-widest text-terminal-dim uppercase">{label}</div>
      <div className="text-[15px] font-bold tabular-nums leading-none" style={{ color }}>{value}</div>
      {sub && <div className="text-[8px] text-terminal-dim">{sub}</div>}
    </div>
  );
}

export default function MarketDashboard() {
  const [prices, setPrices]   = useState<CommodityPrice[]>([]);
  const [now, setNow]         = useState(Date.now());

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const r = await fetch('/api/prices');
        const d = await r.json();
        setPrices(d.prices ?? []);
      } catch { /* stale */ }
    };
    fetchPrices();
    const pi = setInterval(fetchPrices, 15_000);
    const ti = setInterval(() => setNow(Date.now()), 30_000);
    return () => { clearInterval(pi); clearInterval(ti); };
  }, []);

  const get = (sym: string) => prices.find(p => p.symbol === sym);
  const brt = get('BRT');
  const wti = get('WTI');
  const dub = get('DUB');
  const rb  = get('RB');
  const go  = get('GO');
  const hh  = get('HH');

  /* Derived metrics */
  const spread = brt && wti && brt.price > 0 && wti.price > 0
    ? +(brt.price - wti.price).toFixed(2) : null;

  const dubWtiSpread = dub && wti && dub.price > 0 && wti.price > 0
    ? +(dub.price - wti.price).toFixed(2) : null;

  // 3-2-1 crack: (2×RBOB_$/gal×42 + HO_$/gal×42 − 3×WTI_$/bbl) / 3
  const crack = rb && go && wti && rb.price > 0 && go.price > 0 && wti.price > 0
    ? +((2 * rb.price * 42 + go.price * 42 - 3 * wti.price) / 3).toFixed(2) : null;

  // Gas-to-oil ratio: HH / (BRT / 6)
  const gasOilRatio = hh && brt && hh.price > 0 && brt.price > 0
    ? +((hh.price / (brt.price / 6)) * 100).toFixed(1) : null;

  // Spread classification
  const spreadLabel = spread === null ? '—'
    : spread > 3 ? 'WIDE' : spread > 1 ? 'NORMAL' : 'TIGHT';
  const spreadColor = spread === null ? 'var(--dim)'
    : spread > 3 ? 'var(--amber)' : spread > 1 ? 'var(--text)' : 'var(--green)';

  // Crack classification
  const crackColor = crack === null ? 'var(--dim)'
    : crack > 25 ? 'var(--green)' : crack > 15 ? 'var(--amber)' : 'var(--red)';

  // Events
  const events = WEEKLY_EVENTS.map(e => ({
    ...e,
    msAway: nextEventMs(e.day, e.hour, e.min),
  })).sort((a, b) => a.msAway - b.msAway);

  const metrics = [
    {
      label: 'BRT – WTI SPREAD',
      value: spread !== null ? `$${spread.toFixed(2)}/bbl` : '—',
      sub: spreadLabel + ' · Brent premium',
      color: spreadColor,
      tooltip: 'Difference between Brent and WTI. Brent usually trades at a premium due to logistics and quality. A wide spread signals logistical stress.',
    },
    {
      label: '3-2-1 CRACK SPREAD',
      value: crack !== null ? `$${crack.toFixed(1)}/bbl` : '—',
      sub: crack !== null ? (crack > 25 ? 'HIGH — refinery margins strong' : crack > 15 ? 'NORMAL refinery margin' : 'COMPRESSED — demand weak') : 'Calculating…',
      color: crackColor,
      tooltip: 'Refinery profit proxy: converts 3 barrels crude → 2 gasoline + 1 diesel. High crack = strong product demand = bullish crude.',
    },
    {
      label: 'DUBAI – WTI (EAST-WEST)',
      value: dubWtiSpread !== null ? `$${dubWtiSpread.toFixed(2)}/bbl` : '—',
      sub: dubWtiSpread !== null ? (dubWtiSpread > 2 ? 'Asia paying premium' : 'Arb compressed') : '—',
      color: 'var(--text)',
      tooltip: 'Dubai vs WTI spread shows the East-West arbitrage. When Dubai trades at premium, Asian demand is strong.',
    },
    {
      label: 'GAS / OIL RATIO',
      value: gasOilRatio !== null ? `${gasOilRatio}%` : '—',
      sub: gasOilRatio !== null ? (gasOilRatio < 80 ? 'Gas cheap vs oil' : gasOilRatio > 120 ? 'Gas expensive vs oil' : 'Near parity') : '—',
      color: gasOilRatio !== null ? (gasOilRatio < 80 ? 'var(--amber)' : 'var(--text)') : 'var(--dim)',
      tooltip: 'Henry Hub gas vs crude on an energy-equivalent basis. Below 100% = gas historically cheap, often signals LNG export or switching opportunity.',
    },
    {
      label: 'OPEC+ SPARE CAP.',
      value: '~3.2 Mb/d',
      sub: 'Tight · Saudi + UAE buffer',
      color: 'var(--amber)',
      tooltip: 'OPEC+ effective spare capacity — the volume that can be brought online within 30 days. Below 4 Mb/d is historically tight and price-supportive.',
    },
    {
      label: 'FORWARD CURVE',
      value: 'CONTANGO',
      sub: '+$0.6/mo — market oversupplied',
      color: 'var(--dim)',
      tooltip: 'Contango = front month cheaper than later months (bearish near-term). Backwardation = front month more expensive (bullish, tight physical supply).',
    },
    {
      label: 'OIL VOLATILITY (OVX)',
      value: '~28',
      sub: 'Elevated · Options premium high',
      color: 'var(--amber)',
      tooltip: 'OVX is the CBOE Oil Volatility Index — similar to VIX but for crude oil options. >30 = elevated; >45 = crisis; <20 = calm.',
    },
    {
      label: 'US SPR LEVEL',
      value: '~360 Mb',
      sub: '~40-year low · Refill ongoing',
      color: 'var(--amber)',
      tooltip: 'US Strategic Petroleum Reserve. Low levels reduce the government\'s ability to release emergency supply, making markets more reactive to disruptions.',
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-terminal-panel">

      {/* Header */}
      <div className="section-header shrink-0">
        <div className="dot" />
        <span>MARKET METRICS</span>
        <span className="ml-auto text-[8px] text-terminal-dim">Hover any card for context</span>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex gap-0">

        {/* Metrics grid */}
        <div className="flex-1 min-w-0 p-2 overflow-y-auto">
          <div className="grid grid-cols-4 gap-1.5">
            {metrics.map((m, i) => (
              <MetricCard key={i}
                label={m.label} value={m.value} sub={m.sub}
                color={m.color} tooltip={m.tooltip}
              />
            ))}
          </div>
        </div>

        {/* Events sidebar */}
        <div className="w-[160px] shrink-0 border-l border-terminal-border flex flex-col">
          <div className="px-2.5 py-2 border-b border-terminal-border">
            <span className="text-[8px] font-['Orbitron'] tracking-widest text-terminal-dim uppercase">Key Events</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {events.map((e, i) => (
              <div key={i} className="border border-terminal-border rounded px-2 py-1.5 bg-terminal-surface">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[8px] font-bold font-['Orbitron']" style={{ color: e.color }}>{e.short}</span>
                  <span className="text-[8px] font-bold text-terminal-bright"
                    style={{ color: e.msAway < 3_600_000 ? 'var(--red)' : e.msAway < 86_400_000 ? 'var(--amber)' : 'var(--dim)' }}>
                    {fmtCountdown(e.msAway)}
                  </span>
                </div>
                <div className="text-[8px] text-terminal-dim leading-tight">{e.label}</div>
              </div>
            ))}

            {/* Context notes */}
            <div className="mt-3 space-y-1.5">
              <div className="text-[7px] font-['Orbitron'] tracking-widest text-terminal-dim uppercase">Context</div>
              {[
                { dot: 'var(--red)',   text: 'Hormuz: 21 Mb/d at risk' },
                { dot: 'var(--amber)', text: 'Red Sea: rerouting active' },
                { dot: 'var(--amber)', text: 'OPEC: cuts maintained' },
                { dot: 'var(--dim)',   text: 'Libya: ~0.3 Mb/d offline' },
              ].map((c, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full mt-0.5 shrink-0" style={{ background: c.dot }} />
                  <span className="text-[8px] text-terminal-dim leading-tight">{c.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
