'use client';
import { useEffect, useState, useRef } from 'react';
import type { MetalPrice } from '@/app/api/metals/route';
import ThemeToggle from '@/components/ThemeToggle';
import Link from 'next/link';
import PythBadge from '@/components/PythBadge';

interface Props { initialMetals: MetalPrice[] }

function getMarketSession(): { label: string; color: string } {
  const h = new Date().getUTCHours();
  if (h >= 8  && h < 17) return { label: 'LONDON', color: '#00c8f0' };
  if (h >= 13 && h < 21) return { label: 'NEW YORK', color: '#00e87a' };
  if (h >= 21 || h < 8)  return { label: 'ASIA', color: '#ffb300' };
  return { label: 'CLOSED', color: '#6b9db8' };
}

function MetalCell({
  label, price, change, changePct, decimals = 2, flash,
}: {
  label: string; price: number; change: number; changePct: number;
  decimals?: number; flash?: 'up' | 'down' | '';
}) {
  const up    = change >= 0;
  const color = up ? 'var(--green)' : 'var(--red)';
  const arrow = up ? '▲' : '▼';

  return (
    <div className="flex flex-col justify-center px-3 py-1 border-r border-terminal-border shrink-0 min-w-0 transition-colors duration-300"
      style={{
        background: flash === 'up'   ? 'rgba(0,232,122,0.08)'
                  : flash === 'down' ? 'rgba(255,51,85,0.08)'
                  : 'transparent',
      }}>
      <div className="text-[8px] font-['Orbitron'] tracking-widest text-terminal-dim uppercase mb-0.5">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[14px] font-bold text-terminal-bright tabular-nums leading-none">
          {price > 0 ? price.toFixed(decimals) : '—'}
        </span>
        {price > 0 && (
          <span className="text-[9px] font-semibold tabular-nums" style={{ color }}>
            {arrow}{Math.abs(changePct).toFixed(2)}%
          </span>
        )}
      </div>
      {price > 0 && change !== 0 && (
        <div className="text-[8px] tabular-nums" style={{ color }}>
          {up ? '+' : ''}{change.toFixed(decimals)}
        </div>
      )}
    </div>
  );
}

export default function MineralsPriceStrip({ initialMetals }: Props) {
  const [metals,  setMetals]  = useState<MetalPrice[]>(initialMetals);
  const [time,    setTime]    = useState('');
  const [session, setSession] = useState(getMarketSession());
  const [flashes, setFlashes] = useState<Record<string, 'up' | 'down' | ''>>({});
  const prevRef               = useRef<Record<string, number>>({});

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(`${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')}:${String(now.getUTCSeconds()).padStart(2,'0')} UTC`);
      setSession(getMarketSession());
    };
    tick();
    const ti = setInterval(tick, 1000);

    const fetchMetals = async () => {
      try {
        const r = await fetch('/api/metals');
        const d = await r.json();
        const nf: Record<string, 'up' | 'down' | ''> = {};
        (d.metals as MetalPrice[]).forEach(m => {
          const prev = prevRef.current[m.symbol];
          if (prev !== undefined && prev !== m.price)
            nf[m.symbol] = m.price > prev ? 'up' : 'down';
          prevRef.current[m.symbol] = m.price;
        });
        setFlashes(nf);
        setMetals(d.metals);
        setTimeout(() => setFlashes({}), 800);
      } catch { /* stale */ }
    };
    fetchMetals();
    const pi = setInterval(fetchMetals, 15_000);
    return () => { clearInterval(ti); clearInterval(pi); };
  }, []);

  const get = (sym: string) => metals.find(m => m.symbol === sym);
  const xau = get('XAU');
  const xag = get('XAG');
  const xpt = get('XPT');
  const xpd = get('XPD');
  const cu  = get('CU');

  const gsRatio = xau && xag && xau.price > 0 && xag.price > 0
    ? +(xau.price / xag.price).toFixed(1) : null;
  const ptPdSpread = xpt && xpd && xpt.price > 0 && xpd.price > 0
    ? +(xpt.price - xpd.price).toFixed(0) : null;

  return (
    <div className="flex items-stretch h-full bg-terminal-panel border-b border-terminal-border overflow-hidden">

      {/* Logo */}
      <div className="flex items-center gap-2 px-3 border-r border-terminal-border shrink-0">
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--amber)' }} />
        <span className="text-[11px] font-['Orbitron'] font-bold tracking-widest text-terminal-bright">
          MINERALS<span style={{ color: 'var(--amber)' }}>WATCHTOWER</span>
        </span>
      </div>

      {/* Pyth live badge */}
      <PythBadge variant="strip" />

      {/* Precious metals */}
      {(['XAU', 'XAG', 'XPT', 'XPD'] as const).map(sym => {
        const m = get(sym);
        if (!m) return null;
        const dec = sym === 'XAG' ? 3 : 2;
        return (
          <MetalCell key={sym} label={sym}
            price={m.price} change={m.change} changePct={m.changePct}
            decimals={dec} flash={flashes[sym]}
          />
        );
      })}

      {/* Gold/Silver ratio */}
      {gsRatio !== null && (
        <div className="flex flex-col justify-center px-3 border-r border-terminal-border shrink-0">
          <div className="text-[7px] font-['Orbitron'] tracking-widest text-terminal-dim mb-0.5">G/S RATIO</div>
          <div className="text-[14px] font-bold tabular-nums" style={{ color: 'var(--amber)' }}>
            {gsRatio}x
          </div>
          <div className="text-[7px] text-terminal-dim">
            {gsRatio > 90 ? 'SILVER CHEAP' : gsRatio > 75 ? 'NORMAL' : 'SILVER RICH'}
          </div>
        </div>
      )}

      {/* Products divider */}
      <div className="flex items-center px-2 border-r border-terminal-border shrink-0">
        <span className="text-[7px] font-['Orbitron'] text-terminal-dim tracking-wider rotate-180"
          style={{ writingMode: 'vertical-rl' }}>BASE</span>
      </div>

      {/* Copper */}
      {cu && (
        <MetalCell label="CU" price={cu.price} change={cu.change}
          changePct={cu.changePct} decimals={3} flash={flashes['CU']} />
      )}

      {/* Pt/Pd spread */}
      {ptPdSpread !== null && (
        <div className="flex flex-col justify-center px-3 border-r border-terminal-border shrink-0">
          <div className="text-[7px] font-['Orbitron'] tracking-widest text-terminal-dim mb-0.5">PT–PD</div>
          <div className="text-[14px] font-bold tabular-nums"
            style={{ color: ptPdSpread > 0 ? 'var(--green)' : 'var(--red)' }}>
            {ptPdSpread > 0 ? '+' : ''}{ptPdSpread}
          </div>
          <div className="text-[7px] text-terminal-dim">
            {ptPdSpread > 200 ? 'PT PREMIUM' : ptPdSpread > 0 ? 'NEAR PARITY' : 'PD PREMIUM'}
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

      {/* Home link */}
      <div className="flex items-center px-3 border-l border-terminal-border shrink-0">
        <Link href="/" className="text-[8px] font-['Orbitron'] text-terminal-dim hover:text-terminal-amber transition-colors tracking-widest">
          ← HOME
        </Link>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-1.5 px-3 border-l border-terminal-border shrink-0">
        <div className="w-2 h-2 rounded-full bg-terminal-red animate-pulse" />
        <span className="text-[8px] font-['Orbitron'] font-bold text-terminal-red tracking-wider">LIVE</span>
      </div>
    </div>
  );
}
