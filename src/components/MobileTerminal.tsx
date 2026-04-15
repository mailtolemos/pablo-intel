'use client';
import { useState, useEffect } from 'react';
import type { CommodityPrice } from '@/lib/types';
import Link from 'next/link';
import WorldMap from '@/components/WorldMap';
import NewsFeed from '@/components/NewsFeed';
import ThreatMatrix from '@/components/ThreatMatrix';
import AlJazeeraPanel from '@/components/AlJazeeraPanel';
import AnalysisPanel from '@/components/AnalysisPanel';

type Tab = 'signals' | 'map' | 'news' | 'threats' | 'live';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'signals', label: 'AI',      icon: '🤖' },
  { id: 'map',     label: 'MAP',     icon: '🌍' },
  { id: 'news',    label: 'NEWS',    icon: '📰' },
  { id: 'threats', label: 'THREATS', icon: '⚠️' },
  { id: 'live',    label: 'AJ LIVE', icon: '📺' },
];

const TICKER_ITEMS = [
  '🔴 BRENT CRUDE — Real-time price intelligence',
  '⚡ STRAIT OF HORMUZ: Elevated tension — 20 Mb/d at risk',
  '🚢 RED SEA: Houthi attacks — tankers rerouting via Cape (+10 days)',
  '🛢️ OPEC+ maintaining voluntary cuts',
  '⚠️ RUSSIA SANCTIONS: 3.5 Mb/d under G7 price cap',
  '🌍 LIBYA: Sharara field disrupted — 0.3 Mb/d offline',
];

interface Props { initialPrices: CommodityPrice[] }

export default function MobileTerminal({ initialPrices }: Props) {
  const [tab, setTab]       = useState<Tab>('signals');
  const [prices, setPrices] = useState<CommodityPrice[]>(initialPrices);
  const [time, setTime]     = useState('');

  useEffect(() => {
    const ti = setInterval(() => setTime(new Date().toUTCString().slice(17, 25) + ' UTC'), 1000);
    setTime(new Date().toUTCString().slice(17, 25) + ' UTC');

    const fetchPrices = async () => {
      try {
        const r = await fetch('/api/prices');
        const d = await r.json();
        setPrices(d.prices);
      } catch { /* stale */ }
    };
    const pi = setInterval(fetchPrices, 15_000);
    return () => { clearInterval(ti); clearInterval(pi); };
  }, []);

  const brt = prices.find(p => p.symbol === 'BRT');
  const wti = prices.find(p => p.symbol === 'WTI');
  const spread = brt && wti ? +(brt.price - wti.price).toFixed(2) : null;

  return (
    <div className="flex flex-col bg-terminal-bg transition-colors duration-300"
         style={{ height: '100dvh', maxHeight: '100dvh', overflow: 'hidden' }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div className="shrink-0 border-b border-terminal-border bg-terminal-panel" style={{ zIndex: 20, position: 'relative' }}>

        {/* Logo row */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-terminal-border bg-terminal-surface">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-terminal-blue animate-pulse" />
            <span className="font-['Orbitron'] text-[13px] tracking-widest text-terminal-bright font-bold">
              OIL<span className="text-terminal-blue">WATCHTOWER</span>
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
              style={{ borderColor: 'rgba(0,200,240,0.4)', background: 'rgba(0,200,240,0.08)', color: 'var(--blue)' }}>
              <span className="text-[12px]">⌂</span>
              <span className="text-[10px] font-['Orbitron'] font-bold tracking-wider">HOME</span>
            </Link>
          </div>
        </div>

        {/* Price tiles — horizontal scroll */}
        <div className="flex overflow-x-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {prices.map(p => {
            const col = p.trend === 'up' ? 'value-up' : p.trend === 'down' ? 'value-down' : 'text-terminal-bright';
            const isGas = p.symbol === 'HH';
            const fmt = (v: number) => isGas ? v.toFixed(3) : v.toFixed(2);
            return (
              <div key={p.symbol}
                   className="flex flex-col justify-center px-4 py-2.5 border-r border-terminal-border shrink-0 min-w-[100px]">
                <div className="flex items-center gap-1.5">
                  <span className="font-['Orbitron'] text-[9px] tracking-wider text-terminal-dim">{p.symbol}</span>
                  {p.trend !== 'flat' && <span className={`text-[10px] font-bold ${col}`}>{p.trend === 'up' ? '▲' : '▼'}</span>}
                </div>
                <div className={`text-[17px] font-bold leading-none tabular-nums ${col}`}>${fmt(p.price)}</div>
                <div className={`text-[10px] font-semibold tabular-nums ${p.changePct >= 0 ? 'value-up' : 'value-down'}`}>
                  {p.changePct >= 0 ? '+' : ''}{p.changePct.toFixed(2)}%
                </div>
              </div>
            );
          })}

          {/* Spread tile */}
          {spread !== null && (
            <div className="flex flex-col justify-center px-4 py-2.5 border-r border-terminal-border shrink-0 min-w-[90px]">
              <span className="font-['Orbitron'] text-[9px] tracking-wider text-terminal-dim mb-0.5">BRT–WTI</span>
              <span className={`text-[17px] font-bold tabular-nums ${spread > 3 ? 'text-terminal-amber' : spread > 1 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                +${spread.toFixed(2)}
              </span>
              <span className="text-[10px] text-terminal-dim">{spread > 3 ? 'WIDE' : spread > 1 ? 'NORMAL' : 'TIGHT'}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ───────────────────────────────── */}
      <div className="flex-1 overflow-hidden" style={{ position: 'relative', isolation: 'isolate', zIndex: 1 }}>
        <div className={`h-full w-full overflow-y-auto ${tab === 'signals' ? 'block' : 'hidden'}`}><AnalysisPanel type="oil" accentColor="var(--blue)" /></div>
        <div className={`h-full w-full ${tab === 'map'     ? 'block' : 'hidden'}`}><WorldMap /></div>
        <div className={`h-full w-full ${tab === 'news'    ? 'block' : 'hidden'}`}><NewsFeed /></div>
        <div className={`h-full w-full overflow-y-auto ${tab === 'live'    ? 'block' : 'hidden'}`}><AlJazeeraPanel /></div>
        <div className={`h-full w-full overflow-y-auto ${tab === 'threats' ? 'block' : 'hidden'}`}><ThreatMatrix /></div>
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
                ? 'text-terminal-blue border-t-2 border-terminal-blue bg-terminal-accent-blue'
                : 'text-terminal-dim border-t-2 border-transparent'}`}>
            <span className="text-[18px] leading-none">{t.icon}</span>
            <span className="font-['Orbitron'] text-[8px] tracking-widest font-bold">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
