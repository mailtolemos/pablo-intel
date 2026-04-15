'use client';
import { useEffect, useState } from 'react';
import type { MetalPrice } from '@/app/api/metals/route';

/* ── Key macro events ────────────────────────────────────────────── */
// FOMC meets 8×/year; these are approximate 2026 dates
const KEY_EVENTS = [
  { month: 1,  day: 29, label: 'FOMC Decision',   short: 'FOMC', color: 'var(--red)' },
  { month: 3,  day: 19, label: 'FOMC Decision',   short: 'FOMC', color: 'var(--red)' },
  { month: 5,  day: 7,  label: 'FOMC Decision',   short: 'FOMC', color: 'var(--red)' },
  { month: 6,  day: 18, label: 'FOMC Decision',   short: 'FOMC', color: 'var(--red)' },
  { month: 7,  day: 30, label: 'FOMC Decision',   short: 'FOMC', color: 'var(--red)' },
  { month: 9,  day: 17, label: 'FOMC Decision',   short: 'FOMC', color: 'var(--red)' },
  { month: 11, day: 5,  label: 'FOMC Decision',   short: 'FOMC', color: 'var(--red)' },
  { month: 12, day: 16, label: 'FOMC Decision',   short: 'FOMC', color: 'var(--red)' },
  // COT reports every Friday
  { day: 5, label: 'CFTC COT Report', short: 'COT', color: 'var(--blue)', weekly: true },
];

function nextFOMC(): { label: string; msAway: number } {
  const now  = new Date();
  const year = now.getUTCFullYear();
  const fomc = KEY_EVENTS.filter(e => !e.weekly).map(e => {
    const d = new Date(Date.UTC(year, (e.month as number) - 1, e.day as number, 14, 0, 0));
    if (d.getTime() < now.getTime()) d.setUTCFullYear(year + 1);
    return { label: e.label, short: e.short, color: e.color, msAway: d.getTime() - now.getTime() };
  });
  fomc.sort((a, b) => a.msAway - b.msAway);
  return fomc[0];
}

function nextCOT(): { msAway: number } {
  const now = new Date();
  const utcDay = now.getUTCDay(); // 0=Sun, 5=Fri
  let daysAhead = (5 - utcDay + 7) % 7;
  const eventMinutes = 15 * 60 + 30; // 15:30 UTC
  const nowMinutes   = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (daysAhead === 0 && nowMinutes >= eventMinutes) daysAhead = 7;
  const target = new Date(now);
  target.setUTCDate(now.getUTCDate() + daysAhead);
  target.setUTCHours(15, 30, 0, 0);
  return { msAway: target.getTime() - now.getTime() };
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'NOW';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 48) return `${Math.floor(h / 24)}d`;
  if (h > 0)  return `${h}h ${m}m`;
  return `${m}m`;
}

function MetricCard({ label, value, sub, color = 'var(--text)', tooltip }:
  { label: string; value: string; sub?: string; color?: string; tooltip?: string }) {
  return (
    <div className="bg-terminal-surface border border-terminal-border rounded p-2.5 flex flex-col gap-1 hover:border-terminal-amber/40 transition-colors duration-200"
      title={tooltip}>
      <div className="text-[8px] font-['Orbitron'] tracking-widest text-terminal-dim uppercase">{label}</div>
      <div className="text-[15px] font-bold tabular-nums leading-none" style={{ color }}>{value}</div>
      {sub && <div className="text-[8px] text-terminal-dim">{sub}</div>}
    </div>
  );
}

export default function MetalsMarket() {
  const [metals, setMetals] = useState<MetalPrice[]>([]);
  const [now,    setNow]    = useState(Date.now());

  useEffect(() => {
    const fetchMetals = async () => {
      try {
        const r = await fetch('/api/metals');
        const d = await r.json();
        setMetals(d.metals ?? []);
      } catch { /* stale */ }
    };
    fetchMetals();
    const pi = setInterval(fetchMetals, 15_000);
    const ti = setInterval(() => setNow(Date.now()), 30_000);
    return () => { clearInterval(pi); clearInterval(ti); };
  }, []);

  const get = (sym: string) => metals.find(m => m.symbol === sym);
  const xau = get('XAU');
  const xag = get('XAG');
  const xpt = get('XPT');
  const xpd = get('XPD');
  const cu  = get('CU');

  /* Derived */
  const gsRatio = xau && xag && xau.price > 0 && xag.price > 0
    ? +(xau.price / xag.price).toFixed(1) : null;
  const ptPd = xpt && xpd && xpt.price > 0 && xpd.price > 0
    ? +(xpt.price - xpd.price).toFixed(0) : null;
  const ptAu = xpt && xau && xpt.price > 0 && xau.price > 0
    ? +(xpt.price / xau.price).toFixed(3) : null;

  const gsColor = gsRatio === null ? 'var(--dim)'
    : gsRatio > 90 ? 'var(--amber)' : gsRatio > 75 ? 'var(--text)' : 'var(--green)';
  const cuColor = (cu == null || cu.price <= 0) ? 'var(--dim)'
    : cu.price > 4.5 ? 'var(--green)' : cu.price > 3.5 ? 'var(--amber)' : 'var(--red)';

  const fomc = nextFOMC();
  const cot  = nextCOT();

  const metrics = [
    {
      label: 'GOLD / SILVER RATIO',
      value: gsRatio !== null ? `${gsRatio}x` : '—',
      sub:   gsRatio !== null ? (gsRatio > 90 ? 'SILVER HISTORICALLY CHEAP' : gsRatio > 75 ? 'NEAR HISTORICAL AVG' : 'SILVER EXPENSIVE') : '—',
      color: gsColor,
      tooltip: 'How many oz of silver to buy 1 oz of gold. Historical average ~65x. Above 90x = silver is cheap vs gold; below 50x = silver expensive.',
    },
    {
      label: 'PLATINUM / PALLADIUM',
      value: ptPd !== null ? `$${Math.abs(ptPd)}/oz` : '—',
      sub:   ptPd !== null ? (ptPd > 0 ? 'Pt at premium · auto demand' : 'Pd at premium · supply squeeze') : '—',
      color: ptPd !== null ? (ptPd > 0 ? 'var(--green)' : 'var(--amber)') : 'var(--dim)',
      tooltip: 'Pt–Pd spread. Palladium historically at premium due to Russia supply dominance (~40%). EV shift is bearish for both (ICE catalyst metals).',
    },
    {
      label: 'PLATINUM / GOLD',
      value: ptAu !== null ? `${ptAu}x` : '—',
      sub:   ptAu !== null ? (ptAu < 0.7 ? 'Pt historically cheap vs Au' : ptAu > 1 ? 'Pt at premium' : 'Near parity') : '—',
      color: ptAu !== null && ptAu < 0.7 ? 'var(--amber)' : 'var(--text)',
      tooltip: 'Platinum used to trade at a premium to gold. Currently at deep discount due to EV uncertainty and South African supply issues.',
    },
    {
      label: 'COPPER (DR. COPPER)',
      value: cu && cu.price > 0 ? `$${cu.price.toFixed(3)}/lb` : '—',
      sub:   cu && cu.price > 0 ? (cu.price > 4.5 ? 'HIGH — strong global demand' : cu.price > 3.5 ? 'MODERATE — mixed signals' : 'LOW — recession risk') : '—',
      color: cuColor,
      tooltip: '"Dr. Copper" — copper has a PhD in economics. High price signals strong industrial activity. Below $3.50/lb historically signals slowdown.',
    },
    {
      label: 'REAL RATE PROXY',
      value: '~1.8%',
      sub:   'Bearish gold · Fed still restrictive',
      color: 'var(--red)',
      tooltip: 'Real rate = 10Y yield minus inflation. Positive real rates are bearish for gold (opportunity cost of holding non-yielding bullion). <0% = bullish gold.',
    },
    {
      label: 'CENTRAL BANK BUYING',
      value: '>1,000t/yr',
      sub:   'Structural floor — EM diversification',
      color: 'var(--green)',
      tooltip: 'Central banks globally have bought >1,000 tonnes/year since 2022, led by China, India, Poland. This is a structural price floor for gold.',
    },
    {
      label: 'RUSSIA PALLADIUM',
      value: '~40% supply',
      sub:   'Sanctions risk — ongoing disruption',
      color: 'var(--amber)',
      tooltip: 'Russia supplies ~40% of global palladium (Norilsk Nickel). G7 sanctions have created supply chain complexity and higher lease rates.',
    },
    {
      label: 'GOLD OVX (VOL)',
      value: '~16',
      sub:   'Calm · Options premium low',
      color: 'var(--dim)',
      tooltip: 'Gold volatility index. Below 20 = calm market. Above 25 = elevated. Gold tends to spike on geopolitical events and Fed surprises.',
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-terminal-panel">
      <div className="section-header shrink-0">
        <div className="dot" style={{ background: 'var(--amber)', boxShadow: '0 0 6px var(--amber)' }} />
        <span>MARKET METRICS</span>
        <span className="ml-auto text-[8px] text-terminal-dim">Hover any card for context</span>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex gap-0">
        {/* Metrics grid */}
        <div className="flex-1 min-w-0 p-2 overflow-y-auto">
          <div className="grid grid-cols-4 gap-1.5">
            {metrics.map((m, i) => (
              <MetricCard key={i} label={m.label} value={m.value}
                sub={m.sub} color={m.color} tooltip={m.tooltip} />
            ))}
          </div>
        </div>

        {/* Events sidebar */}
        <div className="w-[150px] shrink-0 border-l border-terminal-border flex flex-col">
          <div className="px-2.5 py-2 border-b border-terminal-border">
            <span className="text-[8px] font-['Orbitron'] tracking-widest text-terminal-dim uppercase">Key Events</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {/* FOMC */}
            <div className="border border-terminal-border rounded px-2 py-1.5 bg-terminal-surface">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[8px] font-bold font-['Orbitron']" style={{ color: 'var(--red)' }}>FOMC</span>
                <span className="text-[8px] font-bold"
                  style={{ color: fomc.msAway < 86_400_000 ? 'var(--red)' : fomc.msAway < 7*86_400_000 ? 'var(--amber)' : 'var(--dim)' }}>
                  {fmtCountdown(fomc.msAway)}
                </span>
              </div>
              <div className="text-[8px] text-terminal-dim leading-tight">Fed Rate Decision</div>
            </div>

            {/* COT */}
            <div className="border border-terminal-border rounded px-2 py-1.5 bg-terminal-surface">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[8px] font-bold font-['Orbitron']" style={{ color: 'var(--blue)' }}>COT</span>
                <span className="text-[8px] font-bold"
                  style={{ color: cot.msAway < 86_400_000 ? 'var(--amber)' : 'var(--dim)' }}>
                  {fmtCountdown(cot.msAway)}
                </span>
              </div>
              <div className="text-[8px] text-terminal-dim leading-tight">CFTC Commitment of Traders</div>
            </div>

            {/* Context notes */}
            <div className="mt-3 space-y-1.5">
              <div className="text-[7px] font-['Orbitron'] tracking-widest text-terminal-dim uppercase">Drivers</div>
              {[
                { dot: 'var(--red)',   text: 'Real rates: still positive' },
                { dot: 'var(--green)', text: 'CB buying: structural' },
                { dot: 'var(--amber)', text: 'Russia Pd: sanctions risk' },
                { dot: 'var(--amber)', text: 'China: REE export curbs' },
                { dot: 'var(--dim)',   text: 'EV: PGM demand shift' },
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
