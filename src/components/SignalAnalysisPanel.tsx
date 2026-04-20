'use client';
import type { AssetSignal } from '@/app/api/signals/route';

export default function SignalAnalysisPanel({ signals }: { signals: Record<string, AssetSignal> }) {
  const allSignals = Object.values(signals);
  const buyCount = allSignals.filter(s => s.action === 'BUY').length;
  const sellCount = allSignals.filter(s => s.action === 'SELL').length;
  const holdCount = allSignals.filter(s => s.action === 'HOLD').length;
  const avgConfidence = allSignals.length > 0 ? Math.round(allSignals.reduce((sum, s) => sum + s.confidence, 0) / allSignals.length) : 0;

  const topBuys = allSignals.filter(s => s.action === 'BUY').sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  const topSells = allSignals.filter(s => s.action === 'SELL').sort((a, b) => b.confidence - a.confidence).slice(0, 3);

  return (
    <div className="h-full flex flex-col p-4 space-y-4 overflow-y-auto">
      <div className="text-terminal-bright font-['Orbitron'] font-bold tracking-wider text-[12px]">
        MARKET ANALYSIS
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded border border-terminal-border/50 p-3 bg-terminal-surface/40">
          <div className="text-[10px] font-['Orbitron'] font-bold" style={{ color: 'var(--green)' }}>
            {buyCount}
          </div>
          <div className="text-[8px] text-terminal-dim tracking-wider">BUY</div>
        </div>
        <div className="rounded border border-terminal-border/50 p-3 bg-terminal-surface/40">
          <div className="text-[10px] font-['Orbitron'] font-bold" style={{ color: 'var(--red)' }}>
            {sellCount}
          </div>
          <div className="text-[8px] text-terminal-dim tracking-wider">SELL</div>
        </div>
        <div className="rounded border border-terminal-border/50 p-3 bg-terminal-surface/40">
          <div className="text-[10px] font-['Orbitron'] font-bold" style={{ color: 'var(--blue)' }}>
            {holdCount}
          </div>
          <div className="text-[8px] text-terminal-dim tracking-wider">HOLD</div>
        </div>
        <div className="rounded border border-terminal-border/50 p-3 bg-terminal-surface/40">
          <div className="text-[10px] font-['Orbitron'] font-bold" style={{ color: 'var(--amber)' }}>
            {avgConfidence}%
          </div>
          <div className="text-[8px] text-terminal-dim tracking-wider">AVG CONF</div>
        </div>
      </div>

      {/* Top recommendations */}
      <div className="space-y-3">
        {/* Top BUY signals */}
        {topBuys.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] font-['Orbitron'] font-bold text-terminal-bright tracking-wider">
              🟢 TOP BUY OPPORTUNITIES
            </div>
            <div className="space-y-1.5">
              {topBuys.map(signal => (
                <div
                  key={signal.symbol}
                  className="rounded border p-2.5"
                  style={{
                    background: 'rgba(0,232,122,0.08)',
                    borderColor: 'rgba(0,232,122,0.3)',
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <div className="text-[9px] font-['Orbitron'] font-bold text-terminal-bright">{signal.symbol}</div>
                      <div className="text-[8px] text-terminal-dim">{signal.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold font-['Orbitron'] text-terminal-bright">${signal.priceStr}</div>
                      <div className="text-[8px] text-terminal-dim">{signal.confidence}% Confidence</div>
                    </div>
                  </div>
                  <div className="text-[8px] text-terminal-dim leading-relaxed mb-1.5">{signal.rationale}</div>
                  <div className="grid grid-cols-3 gap-1 text-[7px]">
                    <div className="bg-terminal-surface/60 rounded px-1.5 py-1">
                      <div className="text-terminal-dim">Entry</div>
                      <div className="font-['Orbitron'] font-bold">{signal.entryZone}</div>
                    </div>
                    <div className="bg-terminal-surface/60 rounded px-1.5 py-1">
                      <div className="text-terminal-dim">Target</div>
                      <div className="font-['Orbitron'] font-bold text-terminal-green">${signal.target}</div>
                    </div>
                    <div className="bg-terminal-surface/60 rounded px-1.5 py-1">
                      <div className="text-terminal-dim">Stop</div>
                      <div className="font-['Orbitron'] font-bold text-terminal-red">${signal.stopLoss}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top SELL signals */}
        {topSells.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] font-['Orbitron'] font-bold text-terminal-bright tracking-wider">
              🔴 TOP SELL SIGNALS
            </div>
            <div className="space-y-1.5">
              {topSells.map(signal => (
                <div
                  key={signal.symbol}
                  className="rounded border p-2.5"
                  style={{
                    background: 'rgba(255,51,85,0.08)',
                    borderColor: 'rgba(255,51,85,0.3)',
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <div className="text-[9px] font-['Orbitron'] font-bold text-terminal-bright">{signal.symbol}</div>
                      <div className="text-[8px] text-terminal-dim">{signal.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold font-['Orbitron'] text-terminal-bright">${signal.priceStr}</div>
                      <div className="text-[8px] text-terminal-dim">{signal.confidence}% Confidence</div>
                    </div>
                  </div>
                  <div className="text-[8px] text-terminal-dim leading-relaxed mb-1.5">{signal.rationale}</div>
                  <div className="grid grid-cols-3 gap-1 text-[7px]">
                    <div className="bg-terminal-surface/60 rounded px-1.5 py-1">
                      <div className="text-terminal-dim">Entry</div>
                      <div className="font-['Orbitron'] font-bold">{signal.entryZone}</div>
                    </div>
                    <div className="bg-terminal-surface/60 rounded px-1.5 py-1">
                      <div className="text-terminal-dim">Target</div>
                      <div className="font-['Orbitron'] font-bold text-terminal-red">${signal.target}</div>
                    </div>
                    <div className="bg-terminal-surface/60 rounded px-1.5 py-1">
                      <div className="text-terminal-dim">Stop</div>
                      <div className="font-['Orbitron'] font-bold text-terminal-green">${signal.stopLoss}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
