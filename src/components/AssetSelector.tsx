'use client';
import { useState } from 'react';
import type { AssetSignal } from '@/app/api/signals/route';
import type { CommodityPrice } from '@/lib/types';

const ASSET_ICONS: Record<string, { icon: string; color: string; category: string }> = {
  WTI:   { icon: '🛢', color: '#00c8f0', category: 'Oil' },
  BRT:   { icon: '🛢', color: '#00c8f0', category: 'Oil' },
  DUB:   { icon: '🛢', color: '#00c8f0', category: 'Oil' },
  HH:    { icon: '💨', color: '#00c8f0', category: 'Gas' },
  GO:    { icon: '🔥', color: '#ff6400', category: 'Energy' },
  RB:    { icon: '⛽', color: '#ff6400', category: 'Energy' },
  GOLD:  { icon: '⬡', color: '#ffb300', category: 'Metals' },
  SILVER: { icon: '◊', color: '#c0c0c0', category: 'Metals' },
  COPPER: { icon: '█', color: '#b87333', category: 'Metals' },
  BTC:   { icon: '₿', color: '#f7931a', category: 'Crypto' },
  ETH:   { icon: 'Ξ', color: '#627eea', category: 'Crypto' },
  USOIL: { icon: '🛢', color: '#00c8f0', category: 'Oil' },
};

export default function AssetSelector({
  signals,
  prices,
}: {
  signals: Record<string, AssetSignal>;
  prices: CommodityPrice[];
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const availableSymbols = Object.keys(signals).sort();
  const categories = ['all', ...Array.from(new Set(availableSymbols.map(sym => ASSET_ICONS[sym]?.category || 'Other')))];

  const filteredSymbols = selectedCategory === 'all'
    ? availableSymbols
    : availableSymbols.filter(sym => ASSET_ICONS[sym]?.category === selectedCategory);

  return (
    <div className="h-full flex flex-col p-3 space-y-3 overflow-hidden">
      <div className="text-terminal-bright font-['Orbitron'] font-bold tracking-wider text-[11px]">
        ASSET SELECTOR
      </div>

      {/* Category tabs */}
      <div className="flex flex-col gap-1">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className="px-2 py-1.5 rounded text-[8px] font-['Orbitron'] transition-all text-left"
            style={{
              background: selectedCategory === cat ? 'rgba(0,200,240,0.2)' : 'transparent',
              border: `1px solid ${selectedCategory === cat ? 'rgba(0,200,240,0.6)' : 'rgba(0,200,240,0.2)'}`,
              color: selectedCategory === cat ? 'var(--blue)' : 'var(--dim)',
              cursor: 'pointer',
            }}
          >
            {cat.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Asset list */}
      <div className="flex-1 overflow-y-auto space-y-1.5">
        {filteredSymbols.map(sym => {
          const signal = signals[sym];
          const meta = ASSET_ICONS[sym] || { icon: '◆', color: 'var(--dim)', category: 'Other' };

          return (
            <div key={sym} className="rounded border border-terminal-border/40 p-2 hover:border-terminal-border/80 transition-all cursor-pointer" style={{ background: 'rgba(0,200,240,0.02)' }}>
              <div className="flex items-start gap-2">
                <div
                  className="w-6 h-6 rounded flex items-center justify-center text-[12px] shrink-0 font-bold"
                  style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}44`, color: meta.color }}
                >
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <div className="text-[9px] font-['Orbitron'] font-bold text-terminal-bright tracking-wider">
                      {sym}
                    </div>
                    <div
                      className="px-1.5 py-0.5 rounded text-[7px] font-['Orbitron'] font-bold"
                      style={{
                        background: signal.action === 'BUY' ? 'rgba(0,232,122,0.2)' : signal.action === 'SELL' ? 'rgba(255,51,85,0.2)' : 'rgba(0,200,240,0.2)',
                        color: signal.action === 'BUY' ? 'var(--green)' : signal.action === 'SELL' ? 'var(--red)' : 'var(--blue)',
                      }}
                    >
                      {signal.action}
                    </div>
                  </div>
                  <div className="text-[8px] text-terminal-dim flex items-center justify-between">
                    <span>${signal.priceStr}</span>
                    <span style={{ color: signal.change >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {signal.change >= 0 ? '↑' : '↓'} {Math.abs(signal.changePercent).toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1 rounded bg-terminal-border/30 overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${signal.confidence}%`,
                        background: signal.confidence >= 75 ? 'var(--green)' : signal.confidence >= 60 ? 'var(--amber)' : 'var(--blue)',
                      }}
                    />
                  </div>
                  <div className="text-[7px] text-terminal-dim mt-0.5">Confidence: {signal.confidence}%</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="text-[7px] text-terminal-dim space-y-1 border-t border-terminal-border/30 pt-2">
        <div>↑ = Price gaining</div>
        <div>↓ = Price declining</div>
        <div>Bars = Signal strength</div>
      </div>
    </div>
  );
}
