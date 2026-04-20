'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PythBadge from '@/components/PythBadge';

function LiveClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      setTime(`${h}:${m}:${s} UTC`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular-nums">{time}</span>;
}

const OIL_ITEMS = [
  { label: 'BRENT', value: 'LIVE', color: 'var(--blue)' },
  { label: 'WTI',   value: 'LIVE', color: 'var(--green)' },
  { label: 'SPREAD', value: 'LIVE', color: 'var(--amber)' },
  { label: 'HORMUZ', value: 'ELEVATED', color: 'var(--red)' },
  { label: 'RED SEA', value: 'DISRUPTED', color: 'var(--amber)' },
];

const MIN_ITEMS = [
  { label: 'GOLD',    value: 'LIVE', color: 'var(--amber)' },
  { label: 'SILVER',  value: 'LIVE', color: 'var(--dim)' },
  { label: 'COPPER',  value: 'LIVE', color: 'var(--red)' },
  { label: 'G/S RATIO', value: 'LIVE', color: 'var(--blue)' },
  { label: 'PLATINUM', value: 'LIVE', color: 'var(--green)' },
];

export default function PabloIntelHome() {
  const [hovered, setHovered] = useState<'oil' | 'minerals' | 'signals' | null>(null);

  return (
    <div className="h-screen flex flex-col bg-terminal-bg overflow-hidden font-mono">

      {/* ── Top bar ──────────────────────────────────────────────── */}
      <div className="shrink-0 h-10 border-b border-terminal-border bg-terminal-panel flex items-center px-5 gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-terminal-blue animate-pulse" />
          <span className="text-[11px] font-['Orbitron'] font-bold tracking-[0.25em] text-terminal-bright">
            PABLO<span style={{ color: 'var(--blue)' }}>INTEL</span>
          </span>
        </div>
        <div className="h-4 w-px bg-terminal-border" />
        <span className="text-[9px] font-['Orbitron'] text-terminal-dim tracking-widest uppercase">
          Commodity Intelligence Platform
        </span>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-terminal-red animate-pulse" />
            <span className="text-[8px] font-['Orbitron'] font-bold text-terminal-red tracking-wider">LIVE</span>
          </div>
          <span className="text-[8px] text-terminal-dim font-['Orbitron']">
            <LiveClock />
          </span>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-10 px-8">

        {/* Headline */}
        <div className="text-center space-y-2">
          <div className="text-[9px] font-['Orbitron'] tracking-[0.4em] text-terminal-dim uppercase mb-3">
            Select Intelligence Module
          </div>
          <h1 className="text-[42px] font-['Orbitron'] font-bold tracking-[0.12em] leading-none"
            style={{
              color: 'var(--bright)',
              textShadow: '0 0 40px rgba(0,200,240,0.2)',
            }}>
            PABLO<span style={{ color: 'var(--blue)' }}>INTEL</span>
          </h1>
          <p className="text-[11px] text-terminal-dim font-['Orbitron'] tracking-widest">
            Real-time commodity intelligence · Oil · Minerals · Metals
          </p>
        </div>

        {/* Module cards */}
        <div className="grid grid-cols-3 gap-5 w-full max-w-6xl">

          {/* Oil Watchtower */}
          <Link href="/oil"
            onMouseEnter={() => setHovered('oil')}
            onMouseLeave={() => setHovered(null)}
            className="group relative flex flex-col overflow-hidden rounded border transition-all duration-300 cursor-pointer"
            style={{
              background: hovered === 'oil'
                ? 'rgba(0,200,240,0.05)' : 'var(--panel)',
              borderColor: hovered === 'oil'
                ? 'rgba(0,200,240,0.5)' : 'var(--border)',
              boxShadow: hovered === 'oil'
                ? '0 0 40px rgba(0,200,240,0.12), inset 0 1px 0 rgba(0,200,240,0.15)'
                : 'none',
            }}>

            {/* Card header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-terminal-border">
              <div className="w-8 h-8 rounded flex items-center justify-center text-lg"
                style={{ background: 'rgba(0,200,240,0.1)', border: '1px solid rgba(0,200,240,0.3)' }}>
                🛢️
              </div>
              <div>
                <div className="text-[14px] font-['Orbitron'] font-bold tracking-widest text-terminal-bright">
                  OIL WATCHTOWER
                </div>
                <div className="text-[8px] font-['Orbitron'] text-terminal-dim tracking-wider mt-0.5">
                  Crude Intelligence Terminal
                </div>
              </div>
              <div className="ml-auto">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--blue)' }} />
              </div>
            </div>

            {/* Stats preview */}
            <div className="p-5 space-y-3">
              <p className="text-[10px] text-terminal-dim leading-relaxed">
                Real-time Brent, WTI & Dubai crude prices. Live tanker tracking, geopolitical chokepoint
                status, 3-2-1 crack spread, and macro market metrics.
              </p>
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {OIL_ITEMS.map(item => (
                  <div key={item.label} className="flex flex-col gap-0.5 p-1.5 rounded"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <span className="text-[7px] font-['Orbitron'] text-terminal-dim tracking-wider truncate">{item.label}</span>
                    <span className="text-[8px] font-bold font-['Orbitron']" style={{ color: item.color }}>{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['BRT / WTI / DUB', 'Tanker Fleet', 'Chokepoints', 'OPEC+', 'Crack Spread', 'Geopolitical Risk'].map(tag => (
                  <span key={tag} className="text-[7px] font-['Orbitron'] px-2 py-0.5 rounded tracking-wider"
                    style={{ background: 'rgba(0,200,240,0.08)', border: '1px solid rgba(0,200,240,0.2)', color: 'var(--blue)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Enter button */}
            <div className="mt-auto px-5 pb-5">
              <div className="flex items-center justify-between py-2.5 px-4 rounded border transition-all duration-200"
                style={{
                  background: hovered === 'oil' ? 'rgba(0,200,240,0.12)' : 'var(--surface)',
                  borderColor: hovered === 'oil' ? 'rgba(0,200,240,0.5)' : 'var(--border)',
                  color: hovered === 'oil' ? 'var(--blue)' : 'var(--dim)',
                }}>
                <span className="text-[9px] font-['Orbitron'] font-bold tracking-widest">ENTER OIL WATCHTOWER</span>
                <span className="text-[12px]">→</span>
              </div>
            </div>
          </Link>

          {/* Minerals Watchtower */}
          <Link href="/minerals"
            onMouseEnter={() => setHovered('minerals')}
            onMouseLeave={() => setHovered(null)}
            className="group relative flex flex-col overflow-hidden rounded border transition-all duration-300 cursor-pointer"
            style={{
              background: hovered === 'minerals'
                ? 'rgba(255,179,0,0.04)' : 'var(--panel)',
              borderColor: hovered === 'minerals'
                ? 'rgba(255,179,0,0.5)' : 'var(--border)',
              boxShadow: hovered === 'minerals'
                ? '0 0 40px rgba(255,179,0,0.08), inset 0 1px 0 rgba(255,179,0,0.12)'
                : 'none',
            }}>

            {/* Card header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-terminal-border">
              <div className="w-8 h-8 rounded flex items-center justify-center text-lg"
                style={{ background: 'rgba(255,179,0,0.1)', border: '1px solid rgba(255,179,0,0.3)' }}>
                ⬡
              </div>
              <div>
                <div className="text-[14px] font-['Orbitron'] font-bold tracking-widest text-terminal-bright">
                  MINERALS WATCHTOWER
                </div>
                <div className="text-[8px] font-['Orbitron'] text-terminal-dim tracking-wider mt-0.5">
                  Metals & Critical Minerals Terminal
                </div>
              </div>
              <div className="ml-auto">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--amber)' }} />
              </div>
            </div>

            {/* Stats preview */}
            <div className="p-5 space-y-3">
              <p className="text-[10px] text-terminal-dim leading-relaxed">
                Precious & base metals with live pricing. Gold/silver ratio, platinum–palladium spread,
                copper macro indicator, supply risk tracker and sector ETF performance.
              </p>
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {MIN_ITEMS.map(item => (
                  <div key={item.label} className="flex flex-col gap-0.5 p-1.5 rounded"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <span className="text-[7px] font-['Orbitron'] text-terminal-dim tracking-wider truncate">{item.label}</span>
                    <span className="text-[8px] font-bold font-['Orbitron']" style={{ color: item.color }}>{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['Gold / Silver / Platinum', 'Palladium', 'Copper', 'G/S Ratio', 'Supply Risk', 'Sector ETFs'].map(tag => (
                  <span key={tag} className="text-[7px] font-['Orbitron'] px-2 py-0.5 rounded tracking-wider"
                    style={{ background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.2)', color: 'var(--amber)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Enter button */}
            <div className="mt-auto px-5 pb-5">
              <div className="flex items-center justify-between py-2.5 px-4 rounded border transition-all duration-200"
                style={{
                  background: hovered === 'minerals' ? 'rgba(255,179,0,0.1)' : 'var(--surface)',
                  borderColor: hovered === 'minerals' ? 'rgba(255,179,0,0.5)' : 'var(--border)',
                  color: hovered === 'minerals' ? 'var(--amber)' : 'var(--dim)',
                }}>
                <span className="text-[9px] font-['Orbitron'] font-bold tracking-widest">ENTER MINERALS WATCHTOWER</span>
                <span className="text-[12px]">→</span>
              </div>
            </div>
          </Link>
          {/* Live Signals — third card (link to signals page) */}
          <Link href="/signals"
            onMouseEnter={() => setHovered('signals')}
            onMouseLeave={() => setHovered(null)}
            className="group relative flex flex-col overflow-hidden rounded border transition-all duration-300 cursor-pointer"
            style={{
              background: hovered === 'signals'
                ? 'rgba(255,100,0,0.05)' : 'var(--panel)',
              borderColor: hovered === 'signals'
                ? 'rgba(255,100,0,0.5)' : 'var(--border)',
              boxShadow: hovered === 'signals'
                ? '0 0 40px rgba(255,100,0,0.08), inset 0 1px 0 rgba(255,100,0,0.12)' : 'none',
            }}>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-terminal-border">
              <div className="w-8 h-8 rounded flex items-center justify-center text-lg"
                style={{ background: 'rgba(255,100,0,0.1)', border: '1px solid rgba(255,100,0,0.3)' }}>
                ⚡
              </div>
              <div>
                <div className="text-[14px] font-['Orbitron'] font-bold tracking-widest text-terminal-bright">
                  LIVE SIGNALS
                </div>
                <div className="text-[8px] font-['Orbitron'] text-terminal-dim tracking-wider mt-0.5">
                  Trading Analysis · Decision Support
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--dim)' }} />
              </div>
            </div>

            {/* Signals preview */}
            <div className="flex-1 p-4 space-y-2.5 overflow-hidden">
              <p className="text-[10px] text-terminal-dim leading-relaxed">
                Real-time price tracking for crypto, commodities, stocks & indexes.
                Monitors BTC, ETH, HYPE, SOL, PYTH, FOGO, GOLD, SP500, BRENT, WTI for moves &gt;0.75% in 5-minute windows.
              </p>
            </div>

            {/* Features & tags */}
            <div className="px-5 pb-5">
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="text-[7px] font-['Orbitron'] px-2 py-0.5 rounded tracking-wider"
                  style={{ background: 'rgba(255,100,0,0.08)', border: '1px solid rgba(255,100,0,0.2)', color: 'rgba(255,100,0,0.9)' }}>
                  RSI Analysis
                </span>
                <span className="text-[7px] font-['Orbitron'] px-2 py-0.5 rounded tracking-wider"
                  style={{ background: 'rgba(255,100,0,0.08)', border: '1px solid rgba(255,100,0,0.2)', color: 'rgba(255,100,0,0.9)' }}>
                  Risk/Reward
                </span>
                <span className="text-[7px] font-['Orbitron'] px-2 py-0.5 rounded tracking-wider"
                  style={{ background: 'rgba(255,100,0,0.08)', border: '1px solid rgba(255,100,0,0.2)', color: 'rgba(255,100,0,0.9)' }}>
                  Multi-Asset
                </span>
                <span className="text-[7px] font-['Orbitron'] px-2 py-0.5 rounded tracking-wider"
                  style={{ background: 'rgba(255,100,0,0.08)', border: '1px solid rgba(255,100,0,0.2)', color: 'rgba(255,100,0,0.9)' }}>
                  Decision Matrix
                </span>
              </div>

              {/* Enter button */}
              <div className="flex items-center justify-between py-2.5 px-4 rounded border transition-all duration-200"
                style={{
                  background: hovered === 'signals' ? 'rgba(255,100,0,0.1)' : 'var(--surface)',
                  borderColor: hovered === 'signals' ? 'rgba(255,100,0,0.5)' : 'var(--border)',
                  color: hovered === 'signals' ? 'rgba(255,100,0,0.9)' : 'var(--dim)',
                }}>
                <span className="text-[9px] font-['Orbitron'] font-bold tracking-widest">ENTER SIGNALS TERMINAL</span>
                <span className="text-[12px]">→</span>
              </div>
            </div>
          </Link>

        </div>

        {/* Bottom tagline */}
        <div className="text-center space-y-1">
          <div className="text-[8px] font-['Orbitron'] text-terminal-dim tracking-[0.3em] uppercase">
            Live · Institutional · Independent
          </div>
          <div className="text-[7px] text-terminal-dim opacity-50">
            Prices refresh every 10–60 seconds · All data for informational purposes
          </div>
        </div>
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────── */}
      <div className="shrink-0 h-7 border-t border-terminal-border bg-terminal-panel flex items-center px-4 gap-4">
        <span className="text-[8px] font-['Orbitron'] text-terminal-dim tracking-widest">PABLO INTEL v1.0</span>
        <div className="h-3 w-px bg-terminal-border" />
        <span className="text-[8px] text-terminal-dim">3 modules · Crude Oil · Metals & Minerals · Live Signals</span>
        <div className="ml-auto flex items-center gap-4">
          <PythBadge variant="bar" />
          <div className="h-3 w-px bg-terminal-border" />
          <span className="text-[7px] text-terminal-dim font-['Orbitron'] tracking-wider">
            + Stooq · Yahoo Finance
          </span>
        </div>
      </div>
    </div>
  );
}
