'use client';
import { useEffect, useState } from 'react';
import type { AssetSignal, SignalsPayload } from '@/app/api/signals/route';

const ACTION_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  BUY:   { color: 'var(--green)', bg: 'rgba(0,232,122,0.10)',  border: 'rgba(0,232,122,0.45)' },
  SELL:  { color: 'var(--red)',   bg: 'rgba(255,51,85,0.10)',  border: 'rgba(255,51,85,0.45)' },
  HOLD:  { color: 'var(--blue)',  bg: 'rgba(0,200,240,0.08)',  border: 'rgba(0,200,240,0.35)' },
};

export default function SignalsDetailPanel({ signals, isMobile = false }: { signals: Record<string, AssetSignal>; isMobile?: boolean }) {
  const [selected, setSelected] = useState<string>('');
  const [data, setData] = useState<SignalsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const availableSymbols = Object.keys(signals).sort();

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const r = await fetch('/api/signals', { cache: 'no-store' });
        if (r.ok) {
          const d = await r.json();
          setData(d);
          if (!selected && Object.keys(d.signals).length > 0) {
            setSelected(Object.keys(d.signals)[0]);
          }
        }
      } catch { /* error */ } finally { setLoading(false); }
    };
    fetch_();
    const iv = setInterval(fetch_, 60_000);
    return () => clearInterval(iv);
  }, [selected]);

  const currentSignals = data?.signals ?? signals;
  const selectedSignal = selected ? currentSignals[selected] : null;

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 space-y-3">
      <div className="text-terminal-bright font-['Orbitron'] font-bold tracking-wider text-[11px] mb-2">
        SIGNAL DETAILS
      </div>

      {/* Symbol selector */}
      <div className="flex flex-wrap gap-1.5">
        {availableSymbols.slice(0, isMobile ? 4 : 6).map(sym => (
          <button
            key={sym}
            onClick={() => setSelected(sym)}
            className="px-2.5 py-1 rounded text-[8px] font-['Orbitron'] font-bold transition-all"
            style={{
              background: selected === sym ? 'rgba(0,200,240,0.2)' : 'rgba(0,200,240,0.05)',
              border: `1px solid ${selected === sym ? 'rgba(0,200,240,0.6)' : 'rgba(0,200,240,0.2)'}`,
              color: selected === sym ? 'var(--blue)' : 'var(--dim)',
              cursor: 'pointer',
            }}
          >
            {sym}
          </button>
        ))}
      </div>

      {!selectedSignal ? (
        <div className="flex-1 flex items-center justify-center text-terminal-dim text-[9px]">
          Select an asset
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3 text-[9px]">
          {/* Price & Action */}
          <div className="rounded border p-3" style={{ background: ACTION_STYLE[selectedSignal.action].bg, borderColor: ACTION_STYLE[selectedSignal.action].border }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-[10px] font-['Orbitron'] font-bold text-terminal-bright">{selectedSignal.symbol}</div>
                <div className="text-[8px] text-terminal-dim">{selectedSignal.name}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-bold font-['Orbitron']">${selectedSignal.priceStr}</div>
                <div style={{ color: selectedSignal.change >= 0 ? 'var(--green)' : 'var(--red)' }} className="text-[8px]">
                  {selectedSignal.change >= 0 ? '+' : ''}{selectedSignal.changePercent.toFixed(2)}%
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-terminal-dim text-[8px]">Action</div>
              <div className="px-3 py-1 rounded text-[9px] font-['Orbitron'] font-bold" style={{ background: ACTION_STYLE[selectedSignal.action].border, color: '#000' }}>
                {selectedSignal.action}
              </div>
            </div>
          </div>

          {/* Confidence */}
          <div className="rounded border border-terminal-border/50 p-2 bg-terminal-surface/40">
            <div className="flex items-center justify-between mb-1">
              <span className="text-terminal-dim text-[8px]">CONFIDENCE</span>
              <span className="font-bold text-terminal-bright">{selectedSignal.confidence}%</span>
            </div>
            <div className="h-1 rounded bg-terminal-border/30 overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${selectedSignal.confidence}%`,
                  background: selectedSignal.confidence >= 75 ? 'var(--green)' : selectedSignal.confidence >= 60 ? 'var(--amber)' : 'var(--blue)',
                }}
              />
            </div>
          </div>

          {/* Price Levels */}
          <div className="space-y-1.5 text-[8px]">
            <div className="flex justify-between p-1.5 rounded bg-terminal-surface/40 border border-terminal-border/30">
              <span className="text-terminal-dim">ENTRY ZONE</span>
              <span className="font-['Orbitron'] font-bold">{selectedSignal.entryZone}</span>
            </div>
            <div className="flex justify-between p-1.5 rounded bg-terminal-surface/40 border border-terminal-border/30" style={{ borderColor: 'rgba(0,232,122,0.3)' }}>
              <span className="text-terminal-dim">TARGET</span>
              <span className="font-['Orbitron'] font-bold" style={{ color: 'var(--green)' }}>${selectedSignal.target}</span>
            </div>
            <div className="flex justify-between p-1.5 rounded bg-terminal-surface/40 border border-terminal-border/30" style={{ borderColor: 'rgba(255,51,85,0.3)' }}>
              <span className="text-terminal-dim">STOP LOSS</span>
              <span className="font-['Orbitron'] font-bold" style={{ color: 'var(--red)' }}>${selectedSignal.stopLoss}</span>
            </div>
          </div>

          {/* Rationale */}
          <div className="rounded border border-terminal-border/50 p-2 bg-terminal-surface/40">
            <div className="text-terminal-dim text-[8px] mb-1 font-bold">RATIONALE</div>
            <div className="text-[8px] text-terminal-text leading-relaxed">{selectedSignal.rationale}</div>
          </div>

          {/* Indicators */}
          {selectedSignal.indicators && (
            <div className="rounded border border-terminal-border/50 p-2 bg-terminal-surface/40">
              <div className="text-terminal-dim text-[8px] mb-1 font-bold">INDICATORS</div>
              <div className="grid grid-cols-2 gap-1 text-[8px]">
                {Object.entries(selectedSignal.indicators).map(([key, val]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-terminal-dim">{key}:</span>
                    <span className="font-['Orbitron'] font-bold">{typeof val === 'object' ? JSON.stringify(val) : val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
