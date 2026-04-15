'use client';
import { useEffect, useState, useRef } from 'react';
import type { CommodityPrice } from '@/lib/types';
import ThemeToggle from '@/components/ThemeToggle';

interface Props { initialPrices: CommodityPrice[] }

function getMarketSession(): { label: string; color: string } {
  const h = new Date().getUTCHours();
  if (h >= 7  && h < 16) return { label: 'LONDON', color: '#00c8f0' };
  if (h >= 13 && h < 22) return { label: 'NEW YORK', color: '#00e87a' };
  if (h >= 22 || h < 7)  return { label: 'ASIA', color: '#ffb300' };
  return { label: 'CLOSED', color: '#6b9db8' };
}

function fmt(n: number, decimals = 2) {
  return n.toFixed(decimals);
}

function PriceCell({
  label, price, change, changePct, unit, flash,
}: {
  label: string; price: number; change: number; changePct: number;
  unit?: string; flash?: 'up' | 'down' | '';
}) {
  const up    = change >= 0;
  const color = up ? 'var(--green)' : 'var(--red)';
  const arrow = up ? '▲' : '▼';
  const decimals = label === 'HH' ? 3 : 2;

  return (
    <div
      className="flex flex-col justify-center px-3 py-1 border-r border-terminal-border shrink-0 min-w-0 transition-colors duration-300"
      style={{
        background: flash === 'up'   ? 'rgba(0,232,122,0.08)'
                  : flash === 'down' ? 'rgba(255,51,85,0.08)'
                  : 'transparent',
      }}
    >
      <div className="text-[8px] font-['Orbitron'] tracking-widest text-terminal-dim uppercase mb-0.5">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[15px] font-bold text-terminal-bright tabular-nums leading-none">
          {price > 0 ? fmt(price, decimals) : '—'}
        </span>
        {price > 0 && (
          <span className="text-[9px] font-semibold tabular-nums" style={{ color }}>
            {arrow}{Math.abs(changePct).toFixed(2)}%
          </span>
        )}
      </div>
      {price > 0 && change !== 0 && (
        <div className="text-[8px] tabular-nums" style={{ color }}>
          {up ? '+' : ''}{fmt(change, decimals)}
        </div>
      )}
    </div>
  );
}

export default function PriceStrip({ initialPrices }: Props) {
  const [prices, setPrices]   = useState<CommodityPrice[]>(initialPrices);
  const [time, setTime]       = useState('');
  const [session, setSession] = useState(getMarketSession());
  const [flashes, setFlashes] = useState<Record<string, 'up' | 'down' | ''>>({});
  const prevRef               = useRef<Record<string, number>>({});

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hh  = String(now.getUTCHours()).padStart(2, '0');
      const mm  = String(now.getUTCMinutes()).padStart(2, '0');
      const ss  = String(now.getUTCSeconds()).padStart(2, '0');
      setTime(`${hh}:${mm}:${ss} UTC`);
      setSession(getMarketSession());
    };
    tick();
    const ti = setInterval(tick, 1000);

    const fetchPrices = async () => {
      try {
        const r = await fetch('/api/prices');
        const d = await r.json();
        const nf: Record<string, 'up' | 'down' | ''> = {};
        (d.prices as CommodityPrice[]).forEach(p => {
          const prev = prevRef.current[p.symbol];
          if (prev !== undefined && prev !== p.price)
            nf[p.symbol] = p.price > prev ? 'up' : 'down';
          prevRef.current[p.symbol] = p.price;
        });
        setFlashes(nf);
        setPrices(d.prices);
        setTimeout(() => setFlashes({}), 800);
      } catch { /* stale */ }
    };
    fetchPrices();
    const pi = setInterval(fetchPrices, 10_000);
    return () => { clearInterval(ti); clearInterval(pi); };
  }, []);

  const get = (sym: string) => prices.find(p => p.symbol === sym);
  const brt = get('BRT');
  const wti = get('WTI');
  const rb  = get('RB');
  const go  = get('GO');

  const spread = brt && wti && brt.price > 0 && wti.price > 0
    ? +(brt.price - wti.price).toFixed(2) : null;

  // 3-2-1 crack spread: (2×RBOB×42 + HO×42 − 3×WTI) / 3
  const crack = rb && go && wti && rb.price > 0 && go.price > 0 && wti.price > 0
    ? +((2 * rb.price * 42 + go.price * 42 - 3 * wti.price) / 3).toFixed(2) : null;

  return (
    <div className="flex items-stretch h-full bg-terminal-panel border-b border-terminal-border overflow-hidden">

      {/* Logo */}
      <div className="flex items-center gap-2 px-4 border-r border-terminal-border shrink-0">
        <div className="w-2 h-2 rounded-full bg-terminal-blue animate-pulse" />
        <span className="text-[11px] font-['Orbitron'] font-bold tracking-widest text-terminal-bright">
          OIL<span className="text-terminal-blue">SENTINEL</span>
        </span>
      </div>

      {/* Crude benchmarks */}
      {(['BRT', 'WTI', 'DUB'] as const).map(sym => {
        const p = get(sym);
        if (!p) return null;
        return (
          <PriceCell key={sym} label={sym}
            price={p.price} change={p.change} changePct={p.changePct}
            flash={flashes[sym]}
          />
        );
      })}

      {/* BRT-WTI spread badge */}
      {spread !== null && (
        <div className="flex flex-col justify-center px-3 border-r border-terminal-border shrink-0">
          <div className="text-[7px] font-['Orbitron'] tracking-widest text-terminal-dim mb-0.5">BRT–WTI</div>
          <div className="text-[13px] font-bold text-terminal-blue tabular-nums">
            +${spread.toFixed(2)}
          </div>
          <div className="text-[7px] text-terminal-dim">
            {spread > 3 ? 'WIDE' : spread > 1 ? 'NORMAL' : 'TIGHT'}
          </div>
        </div>
      )}

      {/* Divider: Products */}
      <div className="flex items-center px-2 border-r border-terminal-border shrink-0">
        <span className="text-[7px] font-['Orbitron'] text-terminal-dim tracking-wider rotate-180"
          style={{ writingMode: 'vertical-rl' }}>PRODUCTS</span>
      </div>

      {/* Products */}
      {(['HH', 'GO', 'RB'] as const).map(sym => {
        const p = get(sym);
        if (!p) return null;
        return (
          <PriceCell key={sym} label={sym}
            price={p.price} change={p.change} changePct={p.changePct}
            flash={flashes[sym]}
          />
        );
      })}

      {/* Crack spread */}
      {crack !== null && (
        <div className="flex flex-col justify-center px-3 border-r border-terminal-border shrink-0">
          <div className="text-[7px] font-['Orbitron'] tracking-widest text-terminal-dim mb-0.5">3-2-1 CRACK</div>
          <div className="text-[13px] font-bold tabular-nums"
            style={{ color: crack > 20 ? 'var(--green)' : crack > 10 ? 'var(--amber)' : 'var(--red)' }}>
            ${crack.toFixed(1)}/bbl
          </div>
          <div className="text-[7px] text-terminal-dim">
            {crack > 25 ? 'HIGH MARGIN' : crack > 15 ? 'NORMAL' : 'COMPRESSED'}
          </div>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Market session */}
      <div className="flex items-center gap-2 px-3 border-l border-terminal-border shrink-0">
        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: session.color }} />
        <div className="flex flex-col">
          <span className="text-[8px] font-['Orbitron'] font-bold tracking-wider"
            style={{ color: session.color }}>{session.label}</span>
          <span className="text-[8px] text-terminal-dim tabular-nums">{time}</span>
        </div>
      </div>

      {/* Theme toggle */}
      <div className="flex items-center px-3 border-l border-terminal-border shrink-0">
        <ThemeToggle />
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-1.5 px-3 border-l border-terminal-border shrink-0">
        <div className="w-2 h-2 rounded-full bg-terminal-red animate-pulse" />
        <span className="text-[8px] font-['Orbitron'] font-bold text-terminal-red tracking-wider">LIVE</span>
      </div>
    </div>
  );
}
