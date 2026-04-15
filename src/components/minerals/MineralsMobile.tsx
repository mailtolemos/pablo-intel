'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { MetalPrice } from '@/app/api/metals/route';
import MineralMap from '@/components/minerals/MineralMap';
import MineralsNewsFeed from '@/components/minerals/MineralsNewsFeed';
import SupplyRisk from '@/components/minerals/SupplyRisk';
import AnalysisPanel from '@/components/AnalysisPanel';

type Tab = 'signals' | 'prices' | 'map' | 'news' | 'risk';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'signals', label: 'AI',     icon: '🤖' },
  { id: 'prices',  label: 'PRICES', icon: '💰' },
  { id: 'map',     label: 'MAP',    icon: '🗺️' },
  { id: 'news',    label: 'NEWS',   icon: '📰' },
  { id: 'risk',    label: 'RISK',   icon: '⚠️' },
];

const TICKER_ITEMS = [
  '⬡ MINERALS WATCHTOWER — Real-time precious & base metals',
  '🟡 GOLD: Central bank buying >1,000t/year — structural floor',
  '🔴 CHINA: REE export controls — gallium, germanium active since 2023',
  '🇿🇦 SOUTH AFRICA: PGM output curtailed by load shedding',
  '🇷🇺 RUSSIA: Palladium (40% global) under G7 sanctions pressure',
  '🇨🇩 DRC: Cobalt (70% global) exposed to political instability',
];

interface Props { initialMetals: MetalPrice[] }

function PriceTile({ metal, decimals = 2 }: { metal: MetalPrice; decimals?: number }) {
  const up    = metal.change >= 0;
  const color = up ? 'var(--green)' : 'var(--red)';
  const arrow = up ? '▲' : '▼';
  return (
    <div className="flex flex-col p-4 border border-terminal-border rounded bg-terminal-surface">
      <div className="text-[10px] font-['Orbitron'] tracking-widest text-terminal-dim uppercase mb-1">{metal.symbol}</div>
      <div className="text-[22px] font-bold tabular-nums text-terminal-bright leading-none">
        {metal.price > 0 ? metal.price.toFixed(decimals) : '—'}
      </div>
      <div className="flex items-center gap-2 mt-1">
        {metal.price > 0 && (
          <span className="text-[12px] font-semibold tabular-nums" style={{ color }}>
            {arrow}{Math.abs(metal.changePct).toFixed(2)}%
          </span>
        )}
        {metal.price > 0 && (
          <span className="text-[11px] tabular-nums" style={{ color }}>
            {up ? '+' : ''}{metal.change.toFixed(decimals)}
          </span>
        )}
      </div>
      <div className="text-[9px] font-['Orbitron'] text-terminal-dim mt-1">{metal.source?.toUpperCase()}</div>
    </div>
  );
}

export default function MineralsMobile({ initialMetals }: Props) {
  const [tab, setTab]       = useState<Tab>('signals');
  const [metals, setMetals] = useState<MetalPrice[]>(initialMetals);
  const [time, setTime]     = useState('');

  useEffect(() => {
    const ti = setInterval(() => setTime(new Date().toUTCString().slice(17, 25) + ' UTC'), 1000);
    setTime(new Date().toUTCString().slice(17, 25) + ' UTC');

    const fetchMetals = async () => {
      try {
        const r = await fetch('/api/metals');
        const d = await r.json();
        setMetals(d.metals ?? []);
      } catch { /* stale */ }
    };
    const pi = setInterval(fetchMetals, 15_000);
    return () => { clearInterval(ti); clearInterval(pi); };
  }, []);

  const get = (sym: string) => metals.find(m => m.symbol === sym);
  const xau = get('XAU');
  const xag = get('XAG');
  const gsRatio = xau && xag && xau.price > 0 && xag.price > 0
    ? +(xau.price / xag.price).toFixed(1) : null;
  const xpt = get('XPT');
  const xpd = get('XPD');
  const ptPdSpread = xpt && xpd && xpt.price > 0 && xpd.price > 0
    ? +(xpt.price - xpd.price).toFixed(0) : null;

  const PRECIOUS = ['XAU', 'XAG', 'XPT', 'XPD'];
  const BASE     = ['CU'];

  return (
    <div className="flex flex-col bg-terminal-bg transition-colors duration-300"
         style={{ height: '100dvh', maxHeight: '100dvh', overflow: 'hidden' }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div className="shrink-0 border-b border-terminal-border bg-terminal-panel" style={{ zIndex: 20, position: 'relative' }}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-terminal-border bg-terminal-surface">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: 'var(--amber)' }} />
            <span className="font-['Orbitron'] text-[13px] tracking-widest text-terminal-bright font-bold">
              MINERALS<span style={{ color: 'var(--amber)' }}>WATCHTOWER</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-terminal-red animate-pulse" />
              <span className="text-[10px] font-['Orbitron'] font-bold text-terminal-red">LIVE</span>
            </div>
            <span className="text-terminal-dim text-[10px] tabular-nums" suppressHydrationWarning>{time}</span>
            {/* Home button */}
            <Link href="/"
              className="flex items-center gap-1 px-2.5 py-1 rounded border transition-colors duration-200"
              style={{ borderColor: 'rgba(255,179,0,0.4)', background: 'rgba(255,179,0,0.08)', color: 'var(--amber)' }}>
              <span className="text-[12px]">⌂</span>
              <span className="text-[10px] font-['Orbitron'] font-bold tracking-wider">HOME</span>
            </Link>
          </div>
        </div>

        {/* Horizontal price scroll */}
        <div className="flex overflow-x-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {metals.map(m => {
            const up  = m.change >= 0;
            const col = up ? 'value-up' : 'value-down';
            const dec = m.symbol === 'XAG' || m.symbol === 'CU' ? 3 : 2;
            return (
              <div key={m.symbol}
                   className="flex flex-col justify-center px-4 py-2.5 border-r border-terminal-border shrink-0 min-w-[100px]">
                <span className="font-['Orbitron'] text-[9px] tracking-wider text-terminal-dim">{m.symbol}</span>
                <div className={`text-[17px] font-bold leading-none tabular-nums ${col}`}>
                  {m.price > 0 ? m.price.toFixed(dec) : '—'}
                </div>
                <div className={`text-[10px] font-semibold tabular-nums ${col}`}>
                  {m.price > 0 ? `${up ? '+' : ''}${m.changePct.toFixed(2)}%` : '—'}
                </div>
              </div>
            );
          })}

          {/* G/S Ratio */}
          {gsRatio !== null && (
            <div className="flex flex-col justify-center px-4 py-2.5 border-r border-terminal-border shrink-0 min-w-[90px]">
              <span className="font-['Orbitron'] text-[9px] tracking-wider text-terminal-dim">G/S</span>
              <span className="text-[17px] font-bold tabular-nums" style={{ color: 'var(--amber)' }}>{gsRatio}x</span>
              <span className="text-[10px] text-terminal-dim">
                {gsRatio > 90 ? 'CHEAP' : gsRatio > 75 ? 'NORMAL' : 'RICH'}
              </span>
            </div>
          )}

          {/* Pt-Pd Spread */}
          {ptPdSpread !== null && (
            <div className="flex flex-col justify-center px-4 py-2.5 border-r border-terminal-border shrink-0 min-w-[90px]">
              <span className="font-['Orbitron'] text-[9px] tracking-wider text-terminal-dim">PT–PD</span>
              <span className="text-[17px] font-bold tabular-nums"
                style={{ color: ptPdSpread > 0 ? 'var(--green)' : 'var(--red)' }}>
                {ptPdSpread > 0 ? '+' : ''}{ptPdSpread}
              </span>
              <span className="text-[10px] text-terminal-dim">
                {ptPdSpread > 200 ? 'PT PREM' : ptPdSpread > 0 ? 'PARITY' : 'PD PREM'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ───────────────────────────────── */}
      <div className="flex-1 overflow-hidden" style={{ position: 'relative', isolation: 'isolate', zIndex: 1 }}>

        {/* AI SIGNALS tab */}
        <div className={`h-full w-full overflow-y-auto ${tab === 'signals' ? 'block' : 'hidden'}`}>
          <AnalysisPanel type="minerals" accentColor="var(--amber)" />
        </div>

        {/* PRICES tab */}
        <div className={`h-full w-full overflow-y-auto ${tab === 'prices' ? 'block' : 'hidden'}`}>
          <div className="p-4 space-y-4">

            {/* Precious metals */}
            <div>
              <div className="text-[9px] font-['Orbitron'] tracking-widest text-terminal-dim uppercase mb-2">Precious Metals</div>
              <div className="grid grid-cols-2 gap-3">
                {PRECIOUS.map(sym => {
                  const m = get(sym);
                  if (!m) return null;
                  const dec = sym === 'XAG' ? 3 : 2;
                  return <PriceTile key={sym} metal={m} decimals={dec} />;
                })}
              </div>
            </div>

            {/* Base metals */}
            <div>
              <div className="text-[9px] font-['Orbitron'] tracking-widest text-terminal-dim uppercase mb-2">Base Metals</div>
              <div className="grid grid-cols-2 gap-3">
                {BASE.map(sym => {
                  const m = get(sym);
                  if (!m) return null;
                  return <PriceTile key={sym} metal={m} decimals={3} />;
                })}
                {/* G/S ratio card */}
                {gsRatio !== null && (
                  <div className="flex flex-col p-4 border border-terminal-border rounded bg-terminal-surface">
                    <div className="text-[10px] font-['Orbitron'] tracking-widest text-terminal-dim uppercase mb-1">G/S RATIO</div>
                    <div className="text-[22px] font-bold tabular-nums leading-none" style={{ color: 'var(--amber)' }}>
                      {gsRatio}x
                    </div>
                    <div className="text-[11px] mt-1 text-terminal-dim">
                      {gsRatio > 90 ? 'Silver historically cheap' : gsRatio > 75 ? 'Near historical average' : 'Silver premium'}
                    </div>
                  </div>
                )}
                {/* Pt-Pd spread card */}
                {ptPdSpread !== null && (
                  <div className="flex flex-col p-4 border border-terminal-border rounded bg-terminal-surface">
                    <div className="text-[10px] font-['Orbitron'] tracking-widest text-terminal-dim uppercase mb-1">PT–PD SPREAD</div>
                    <div className="text-[22px] font-bold tabular-nums leading-none"
                      style={{ color: ptPdSpread > 0 ? 'var(--green)' : 'var(--red)' }}>
                      {ptPdSpread > 0 ? '+' : ''}{ptPdSpread}
                    </div>
                    <div className="text-[11px] mt-1 text-terminal-dim">
                      {ptPdSpread > 200 ? 'Platinum premium' : ptPdSpread > 0 ? 'Near parity' : 'Palladium premium'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Context note */}
            <div className="px-3 py-2.5 rounded border border-terminal-border bg-terminal-surface/50">
              <div className="text-[9px] font-['Orbitron'] text-terminal-dim tracking-widest uppercase mb-1.5">Data Sources</div>
              <div className="text-[10px] text-terminal-dim leading-relaxed">
                Precious metals (XAU, XAG, XPT) via Pyth Network live feed. Base metals via Stooq futures. All prices in USD.
              </div>
            </div>
          </div>
        </div>

        {/* MAP tab */}
        <div className={`h-full w-full ${tab === 'map' ? 'block' : 'hidden'}`}><MineralMap /></div>

        {/* NEWS tab */}
        <div className={`h-full w-full ${tab === 'news' ? 'block' : 'hidden'}`}><MineralsNewsFeed /></div>

        {/* RISK tab */}
        <div className={`h-full w-full overflow-y-auto ${tab === 'risk' ? 'block' : 'hidden'}`}><SupplyRisk /></div>
      </div>

      {/* ── Ticker ─────────────────────────────────────── */}
      <div className="shrink-0 h-7 border-t border-terminal-border bg-terminal-surface flex items-center overflow-hidden"
           style={{ position: 'relative', zIndex: 30 }}>
        <div className="flex-1 overflow-hidden relative">
          <div className="ticker-text text-[9px] text-terminal-text font-medium">
            {TICKER_ITEMS.join('  ·  ')}&nbsp;&nbsp;&nbsp;{TICKER_ITEMS.join('  ·  ')}
          </div>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────── */}
      <div className="shrink-0 grid grid-cols-5 border-t border-terminal-border bg-terminal-panel"
           style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', position: 'relative', zIndex: 40 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex flex-col items-center justify-center py-3 gap-1 transition-all text-center
              ${tab === t.id
                ? 'border-t-2 bg-terminal-surface'
                : 'border-t-2 border-transparent text-terminal-dim'}`}
            style={tab === t.id ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : {}}>
            <span className="text-[18px] leading-none">{t.icon}</span>
            <span className="font-['Orbitron'] text-[8px] tracking-widest font-bold">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
