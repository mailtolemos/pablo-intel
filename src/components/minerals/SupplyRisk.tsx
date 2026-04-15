'use client';
import { useEffect, useState } from 'react';
import type { MetalPrice } from '@/app/api/metals/route';

/* ── Static supply concentration data ──────────────────────────────── */
const SUPPLY_RISKS = [
  {
    id: 'china-ree',
    title: 'China REE Export Controls',
    region: 'China',
    minerals: ['Gallium', 'Germanium', 'Graphite', 'Rare Earths'],
    status: 'active' as const,
    severity: 'critical' as const,
    detail: 'China controls ~85% of REE processing. Export licence regime introduced 2023 for gallium, germanium, graphite.',
    priceImpact: '⚡ Immediate upstream cost pressure',
  },
  {
    id: 'drc-cobalt',
    title: 'DRC Political Instability',
    region: 'Congo (DRC)',
    minerals: ['Cobalt'],
    status: 'active' as const,
    severity: 'high' as const,
    detail: 'DRC produces ~70% of global cobalt. Artisanal mining risks, M23 rebel activity in eastern provinces.',
    priceImpact: '↑ Cobalt supply premium ~$2/lb',
  },
  {
    id: 'russia-pd',
    title: 'Russia Palladium Supply',
    region: 'Russia',
    minerals: ['Palladium', 'Nickel', 'Platinum'],
    status: 'active' as const,
    severity: 'high' as const,
    detail: 'Norilsk Nickel = ~40% of global palladium. G7 sanctions created logistical complexity, higher lease rates.',
    priceImpact: '↑ Physical tightness in spot market',
  },
  {
    id: 'sa-pgm',
    title: 'South Africa Load Shedding',
    region: 'South Africa',
    minerals: ['Platinum', 'Palladium', 'Rhodium'],
    status: 'elevated' as const,
    severity: 'medium' as const,
    detail: 'Eskom power grid failures (load shedding stages 4–6) force South African PGM mines to curtail output. SA = 85% of global Pt.',
    priceImpact: '↑ Mine output -5% to -8% vs plan',
  },
  {
    id: 'chile-copper',
    title: 'Chile Copper Royalty Risk',
    region: 'Chile',
    minerals: ['Copper', 'Lithium'],
    status: 'elevated' as const,
    severity: 'medium' as const,
    detail: 'New mining royalty legislation and Codelco operational issues. Chile = ~27% of global copper. Lithium nationalisation risk.',
    priceImpact: '⚠ Long-term supply growth risk',
  },
  {
    id: 'indonesia-ni',
    title: 'Indonesia Nickel Export Ban',
    region: 'Indonesia',
    minerals: ['Nickel'],
    status: 'active' as const,
    severity: 'medium' as const,
    detail: 'Indonesia banned raw nickel ore exports (2020, extended). Forces downstream processing investment. Reshaping LME supply chain.',
    priceImpact: '⚡ LME nickel premium restructured',
  },
];

const SEV_COLOR: Record<string, string> = {
  low: 'var(--dim)', medium: 'var(--amber)', high: 'var(--red)', critical: 'var(--red)',
};
const STATUS_COLOR: Record<string, string> = {
  active: 'var(--red)', elevated: 'var(--amber)', watch: 'var(--dim)',
};
const STATUS_LABEL: Record<string, string> = {
  active: 'ACTIVE', elevated: 'ELEVATED', watch: 'WATCH',
};

/* ── Sector ETF tracker ──────────────────────────────────────────── */
const ETF_META: Record<string, { name: string; color: string }> = {
  GDX:  { name: 'Gold Miners',       color: 'var(--amber)' },
  SIL:  { name: 'Silver Miners',     color: 'var(--dim)' },
  COPX: { name: 'Copper Miners',     color: 'var(--red)' },
  LIT:  { name: 'Lithium & Battery', color: 'var(--green)' },
  REMX: { name: 'Rare Earth Metals', color: 'var(--blue)' },
  URNM: { name: 'Uranium Miners',    color: 'var(--amber)' },
};

export default function SupplyRisk() {
  const [metals, setMetals] = useState<MetalPrice[]>([]);
  const [tab,    setTab]    = useState<'risk' | 'etfs'>('risk');

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const r = await fetch('/api/metals');
        const d = await r.json();
        setMetals(d.metals ?? []);
      } catch { /* stale */ }
    };
    fetch_();
    const iv = setInterval(fetch_, 60_000);
    return () => clearInterval(iv);
  }, []);

  const etfs = metals.filter(m => m.category === 'etf' && ETF_META[m.symbol]);
  const activeRisks = SUPPLY_RISKS.filter(r => r.status === 'active' || r.status === 'elevated').length;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-terminal-panel">
      {/* Header */}
      <div className="section-header shrink-0">
        <div className="dot" style={{ background: 'var(--amber)', boxShadow: '0 0 6px var(--amber)' }} />
        <span>SUPPLY & SECTOR</span>
        {activeRisks > 0 && (
          <span className="ml-auto text-terminal-red text-[8px] font-bold font-['Orbitron'] animate-pulse">
            ⚠ {activeRisks} ACTIVE
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="shrink-0 flex border-b border-terminal-border">
        {(['risk', 'etfs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-1.5 text-[8px] font-['Orbitron'] tracking-widest uppercase transition-colors"
            style={{
              color:      tab === t ? 'var(--amber)' : 'var(--dim)',
              background: tab === t ? 'rgba(255,179,0,0.06)' : 'transparent',
              borderBottom: tab === t ? '1px solid var(--amber)' : 'none',
            }}>
            {t === 'risk' ? 'Supply Risk' : 'Sector ETFs'}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'risk' ? (
          <div className="p-2.5 space-y-2">
            {SUPPLY_RISKS.map(risk => (
              <div key={risk.id} className="border border-terminal-border rounded px-2.5 py-2 bg-terminal-surface">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] font-semibold text-terminal-bright leading-snug">{risk.title}</div>
                    <div className="text-[8px] text-terminal-dim mt-0.5">{risk.region}</div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-0.5">
                    <span className="text-[7px] font-bold font-['Orbitron'] px-1.5 py-0.5 rounded"
                      style={{
                        color:      STATUS_COLOR[risk.status],
                        background: `${STATUS_COLOR[risk.status]}18`,
                        border:     `1px solid ${STATUS_COLOR[risk.status]}40`,
                      }}>
                      {STATUS_LABEL[risk.status]}
                    </span>
                    <span className="text-[8px] font-bold font-['Orbitron']"
                      style={{ color: SEV_COLOR[risk.severity] }}>
                      {risk.severity.toUpperCase()}
                    </span>
                  </div>
                </div>
                {/* Mineral tags */}
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {risk.minerals.map(m => (
                    <span key={m} className="text-[7px] px-1.5 py-0.5 rounded font-['Orbitron']"
                      style={{ background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.2)', color: 'var(--amber)' }}>
                      {m}
                    </span>
                  ))}
                </div>
                <div className="text-[8px] text-terminal-dim leading-snug">{risk.detail}</div>
                {risk.priceImpact && (
                  <div className="mt-1 text-[8px] font-semibold" style={{ color: 'var(--amber)' }}>
                    {risk.priceImpact}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-2.5 space-y-1.5">
            <div className="text-[8px] text-terminal-dim px-1 mb-2 leading-snug">
              Sector ETFs as tradeable proxies for illiquid minerals markets.
            </div>
            {etfs.length === 0 ? (
              <div className="space-y-1.5">
                {Object.entries(ETF_META).map(([sym, meta]) => (
                  <div key={sym} className="flex items-center gap-2 px-2 py-2 rounded border border-terminal-border bg-terminal-surface">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                      style={{ background: meta.color }} />
                    <div className="flex-1">
                      <div className="text-[9px] font-bold font-['Orbitron']" style={{ color: meta.color }}>{sym}</div>
                      <div className="text-[8px] text-terminal-dim">{meta.name}</div>
                    </div>
                    <div className="text-[8px] text-terminal-dim">Loading…</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(ETF_META).map(([sym, meta]) => {
                  const m = etfs.find(e => e.symbol === sym);
                  const up = m && m.change >= 0;
                  return (
                    <div key={sym} className="flex items-center gap-2 px-2 py-2 rounded border border-terminal-border bg-terminal-surface">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] font-bold font-['Orbitron']" style={{ color: meta.color }}>{sym}</div>
                        <div className="text-[8px] text-terminal-dim truncate">{meta.name}</div>
                      </div>
                      {m && m.price > 0 ? (
                        <div className="flex flex-col items-end shrink-0">
                          <span className="text-[10px] font-bold text-terminal-bright tabular-nums">
                            ${m.price.toFixed(2)}
                          </span>
                          <span className="text-[8px] font-semibold tabular-nums"
                            style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
                            {up ? '▲' : '▼'}{Math.abs(m.changePct).toFixed(2)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-[8px] text-terminal-dim">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
