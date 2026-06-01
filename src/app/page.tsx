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

const GOLD_ITEMS = [
  { label: 'GOLD',     value: 'LIVE', color: 'var(--amber)' },
  { label: 'SILVER',   value: 'LIVE', color: 'var(--dim)' },
  { label: 'PLATINUM', value: 'LIVE', color: 'var(--green)' },
  { label: 'PALLADIUM',value: 'LIVE', color: 'var(--red)' },
  { label: 'G/S RATIO',value: 'LIVE', color: 'var(--blue)' },
];

const BAGS_ITEMS = [
  { label: 'DEFI',   value: 'LIVE', color: 'var(--blue)' },
  { label: 'PERPS',  value: 'LIVE', color: 'var(--green)' },
  { label: 'VAULTS', value: 'LIVE', color: 'var(--amber)' },
  { label: 'CEX',    value: 'LIVE', color: 'var(--red)' },
  { label: 'IBKR',   value: 'LIVE', color: 'var(--dim)' },
];

export default function PabloIntelHome() {
  const [hovered, setHovered] = useState<'oil' | 'gold' | 'bags' | null>(null);

  return (
    <div className="h-screen flex flex-col bg-terminal-bg overflow-hidden font-mono">

      {/* Top bar */}
      <div className="shrink-0 h-10 border-b border-terminal-border bg-terminal-panel flex items-center px-5 gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-terminal-blue animate-pulse" />
          <span className="text-[11px] font-['Orbitron'] font-bold tracking-[0.25em] text-terminal-bright">
            PABLO<span style={{ color: 'var(--blue)' }}>INTEL</span>
          </span>
        </div>
        <div className="h-4 w-px bg-terminal-border" />
        <span className="text-[9px] font-['Orbitron'] text-terminal-dim tracking-widest uppercase">
          Real-Time Intelligence Platform
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

      <div className="flex-1 flex flex-col items-center justify-center gap-10 px-8">

        <div className="text-center space-y-2">
          <div className="text-[9px] font-['Orbitron'] tracking-[0.4em] text-terminal-dim uppercase mb-3">
            Select Intelligence Module
          </div>
          <h1 className="text-[42px] font-['Orbitron'] font-bold tracking-[0.12em] leading-none"
            style={{ color: 'var(--bright)', textShadow: '0 0 40px rgba(0,200,240,0.2)' }}>
            PABLO<span style={{ color: 'var(--blue)' }}>INTEL</span>
          </h1>
          <p className="text-[11px] text-terminal-dim font-['Orbitron'] tracking-widest">
            Real-time intelligence · Oil · Gold · Bags
          </p>
        </div>

        <div className="grid grid-cols-3 gap-5 w-full max-w-6xl">

          {/* OIL */}
          <Link href="/oil"
            onMouseEnter={() => setHovered('oil')} onMouseLeave={() => setHovered(null)}
            className="group relative flex flex-col overflow-hidden rounded border transition-all duration-300 cursor-pointer"
            style={{
              background: hovered === 'oil' ? 'rgba(0,200,240,0.05)' : 'var(--panel)',
              borderColor: hovered === 'oil' ? 'rgba(0,200,240,0.5)' : 'var(--border)',
              boxShadow: hovered === 'oil' ? '0 0 40px rgba(0,200,240,0.12), inset 0 1px 0 rgba(0,200,240,0.15)' : 'none',
            }}>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-terminal-border">
              <div className="w-8 h-8 rounded flex items-center justify-center text-lg"
                style={{ background: 'rgba(0,200,240,0.1)', border: '1px solid rgba(0,200,240,0.3)' }}>
                <span style={{ color: 'var(--blue)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px' }}>OIL</span>
              </div>
              <div>
                <div className="text-[14px] font-['Orbitron'] font-bold tracking-widest text-terminal-bright">OIL WATCHTOWER</div>
                <div className="text-[8px] font-['Orbitron'] text-terminal-dim tracking-wider mt-0.5">Crude Intelligence Terminal</div>
              </div>
              <div className="ml-auto"><div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--blue)' }} /></div>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-[10px] text-terminal-dim leading-relaxed">
                Real-time Brent, WTI &amp; Dubai crude prices. Live tanker tracking, geopolitical chokepoint status, 3-2-1 crack spread, and macro market metrics.
              </p>
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {OIL_ITEMS.map(item => (
                  <div key={item.label} className="flex flex-col gap-0.5 p-1.5 rounded" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
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

          {/* GOLD */}
          <Link href="/minerals"
            onMouseEnter={() => setHovered('gold')} onMouseLeave={() => setHovered(null)}
            className="group relative flex flex-col overflow-hidden rounded border transition-all duration-300 cursor-pointer"
            style={{
              background: hovered === 'gold' ? 'rgba(255,179,0,0.04)' : 'var(--panel)',
              borderColor: hovered === 'gold' ? 'rgba(255,179,0,0.5)' : 'var(--border)',
              boxShadow: hovered === 'gold' ? '0 0 40px rgba(255,179,0,0.08), inset 0 1px 0 rgba(255,179,0,0.12)' : 'none',
            }}>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-terminal-border">
              <div className="w-8 h-8 rounded flex items-center justify-center"
                style={{ background: 'rgba(255,179,0,0.1)', border: '1px solid rgba(255,179,0,0.3)' }}>
                <span style={{ color: 'var(--amber)', fontSize: '10px', fontWeight: 800, letterSpacing: '0.5px' }}>AU</span>
              </div>
              <div>
                <div className="text-[14px] font-['Orbitron'] font-bold tracking-widest text-terminal-bright">GOLD WATCHTOWER</div>
                <div className="text-[8px] font-['Orbitron'] text-terminal-dim tracking-wider mt-0.5">Precious Metals Terminal</div>
              </div>
              <div className="ml-auto"><div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--amber)' }} /></div>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-[10px] text-terminal-dim leading-relaxed">
                Gold, silver, platinum, palladium with live pricing. Gold/silver ratio, platinum–palladium spread, copper macro indicator, supply risk tracker and sector ETF performance.
              </p>
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {GOLD_ITEMS.map(item => (
                  <div key={item.label} className="flex flex-col gap-0.5 p-1.5 rounded" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
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
            <div className="mt-auto px-5 pb-5">
              <div className="flex items-center justify-between py-2.5 px-4 rounded border transition-all duration-200"
                style={{
                  background: hovered === 'gold' ? 'rgba(255,179,0,0.1)' : 'var(--surface)',
                  borderColor: hovered === 'gold' ? 'rgba(255,179,0,0.5)' : 'var(--border)',
                  color: hovered === 'gold' ? 'var(--amber)' : 'var(--dim)',
                }}>
                <span className="text-[9px] font-['Orbitron'] font-bold tracking-widest">ENTER GOLD WATCHTOWER</span>
                <span className="text-[12px]">→</span>
              </div>
            </div>
          </Link>

          {/* BAGS */}
          <Link href="/bags"
            onMouseEnter={() => setHovered('bags')} onMouseLeave={() => setHovered(null)}
            className="group relative flex flex-col overflow-hidden rounded border transition-all duration-300 cursor-pointer"
            style={{
              background: hovered === 'bags' ? 'rgba(110,126,58,0.06)' : 'var(--panel)',
              borderColor: hovered === 'bags' ? 'rgba(110,126,58,0.55)' : 'var(--border)',
              boxShadow: hovered === 'bags' ? '0 0 40px rgba(110,126,58,0.10), inset 0 1px 0 rgba(110,126,58,0.15)' : 'none',
            }}>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-terminal-border">
              <div className="w-8 h-8 rounded flex items-center justify-center"
                style={{ background: 'rgba(110,126,58,0.12)', border: '1px solid rgba(110,126,58,0.35)' }}>
                <span style={{ color: '#a8c266', fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px' }}>$</span>
              </div>
              <div>
                <div className="text-[14px] font-['Orbitron'] font-bold tracking-widest text-terminal-bright">BAGS WATCHTOWER</div>
                <div className="text-[8px] font-['Orbitron'] text-terminal-dim tracking-wider mt-0.5">Unified Portfolio Terminal</div>
              </div>
              <div className="ml-auto"><div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#a8c266' }} /></div>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-[10px] text-terminal-dim leading-relaxed">
                Your whole portfolio in one Bloomberg-style terminal. Solana wallets, EVM across Ethereum/Arbitrum/Base, Hyperliquid perps and vaults, Binance read-only, IBKR brokerage.
              </p>
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {BAGS_ITEMS.map(item => (
                  <div key={item.label} className="flex flex-col gap-0.5 p-1.5 rounded" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <span className="text-[7px] font-['Orbitron'] text-terminal-dim tracking-wider truncate">{item.label}</span>
                    <span className="text-[8px] font-bold font-['Orbitron']" style={{ color: item.color }}>{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['Multi-Chain DeFi', 'Hyperliquid', 'Binance', 'IBKR', 'Pyth Prices', 'AES Encrypted'].map(tag => (
                  <span key={tag} className="text-[7px] font-['Orbitron'] px-2 py-0.5 rounded tracking-wider"
                    style={{ background: 'rgba(110,126,58,0.10)', border: '1px solid rgba(110,126,58,0.25)', color: '#a8c266' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-auto px-5 pb-5">
              <div className="flex items-center justify-between py-2.5 px-4 rounded border transition-all duration-200"
                style={{
                  background: hovered === 'bags' ? 'rgba(110,126,58,0.13)' : 'var(--surface)',
                  borderColor: hovered === 'bags' ? 'rgba(110,126,58,0.55)' : 'var(--border)',
                  color: hovered === 'bags' ? '#a8c266' : 'var(--dim)',
                }}>
                <span className="text-[9px] font-['Orbitron'] font-bold tracking-widest">ENTER BAGS WATCHTOWER</span>
                <span className="text-[12px]">→</span>
              </div>
            </div>
          </Link>

        </div>

        <div className="text-center space-y-1">
          <div className="text-[8px] font-['Orbitron'] text-terminal-dim tracking-[0.3em] uppercase">
            Live · Institutional · Independent
          </div>
          <div className="text-[7px] text-terminal-dim opacity-50">
            All data for informational purposes
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 h-7 border-t border-terminal-border bg-terminal-panel flex items-center px-4 gap-4">
        <span className="text-[8px] font-['Orbitron'] text-terminal-dim tracking-widest">PABLO INTEL v1.0</span>
        <div className="h-3 w-px bg-terminal-border" />
        <span className="text-[8px] text-terminal-dim">3 modules · Crude Oil · Precious Metals · Bags Watchtower</span>
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
