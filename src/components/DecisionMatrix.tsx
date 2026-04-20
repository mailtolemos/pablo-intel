'use client';
import type { AssetSignal } from '@/app/api/signals/route';

export default function DecisionMatrix({ signals }: { signals: Record<string, AssetSignal> }) {
  const allSignals = Object.values(signals);

  // Calculate risk/reward ratios
  const signalsWithRR = allSignals.map(s => {
    const entryMatch = s.entryZone.match(/[\d.]+/);
    const targetMatch = s.target.match(/[\d.]+/);
    const stopMatch = s.stopLoss.match(/[\d.]+/);

    const entry = entryMatch ? parseFloat(entryMatch[0]) : s.price;
    const target = targetMatch ? parseFloat(targetMatch[0]) : s.price;
    const stop = stopMatch ? parseFloat(stopMatch[0]) : s.price;

    let reward = 0, risk = 0;
    if (s.action === 'BUY') {
      reward = target - entry;
      risk = entry - stop;
    } else if (s.action === 'SELL') {
      reward = entry - target;
      risk = stop - entry;
    }

    const ratio = risk > 0 ? Math.round((reward / risk) * 100) / 100 : 0;
    return { ...s, riskReward: ratio };
  });

  // Sort by risk/reward
  const topRR = signalsWithRR.filter(s => s.riskReward > 0).sort((a, b) => b.riskReward - a.riskReward).slice(0, 4);

  // Distribution of confidence levels
  const highConf = allSignals.filter(s => s.confidence >= 75).length;
  const medConf = allSignals.filter(s => s.confidence >= 60 && s.confidence < 75).length;
  const lowConf = allSignals.filter(s => s.confidence < 60).length;
  const total = allSignals.length;

  return (
    <div className="h-full flex flex-col p-4 space-y-3 overflow-y-auto">
      <div className="text-terminal-bright font-['Orbitron'] font-bold tracking-wider text-[11px]">
        DECISION MATRIX
      </div>

      {/* Risk/Reward Top Performers */}
      <div className="space-y-2">
        <div className="text-[9px] font-['Orbitron'] font-bold text-terminal-blue tracking-wider">
          💎 BEST RISK/REWARD
        </div>
        <div className="space-y-1.5">
          {topRR.length > 0 ? (
            topRR.map(signal => (
              <div
                key={signal.symbol}
                className="rounded border border-terminal-border/50 p-2 bg-terminal-surface/40"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-['Orbitron'] font-bold text-terminal-bright">
                    {signal.symbol}
                  </span>
                  <span className="text-[8px] font-['Orbitron'] font-bold" style={{ color: 'var(--amber)' }}>
                    RR: 1:{signal.riskReward.toFixed(2)}
                  </span>
                </div>
                <div className="text-[7px] text-terminal-dim">{signal.action} @ ${signal.priceStr}</div>
              </div>
            ))
          ) : (
            <div className="text-[8px] text-terminal-dim text-center py-2">No signals available</div>
          )}
        </div>
      </div>

      {/* Confidence Distribution */}
      <div className="space-y-2">
        <div className="text-[9px] font-['Orbitron'] font-bold text-terminal-green tracking-wider">
          📊 CONFIDENCE DISTRIBUTION
        </div>
        <div className="space-y-1.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] text-terminal-dim">High (75%+)</span>
              <span className="text-[8px] font-bold">{highConf}/{total}</span>
            </div>
            <div className="h-2 rounded bg-terminal-border/30 overflow-hidden">
              <div
                className="h-full"
                style={{
                  width: `${total > 0 ? (highConf / total) * 100 : 0}%`,
                  background: 'var(--green)',
                }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] text-terminal-dim">Medium (60-74%)</span>
              <span className="text-[8px] font-bold">{medConf}/{total}</span>
            </div>
            <div className="h-2 rounded bg-terminal-border/30 overflow-hidden">
              <div
                className="h-full"
                style={{
                  width: `${total > 0 ? (medConf / total) * 100 : 0}%`,
                  background: 'var(--amber)',
                }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] text-terminal-dim">Low (&lt;60%)</span>
              <span className="text-[8px] font-bold">{lowConf}/{total}</span>
            </div>
            <div className="h-2 rounded bg-terminal-border/30 overflow-hidden">
              <div
                className="h-full"
                style={{
                  width: `${total > 0 ? (lowConf / total) * 100 : 0}%`,
                  background: 'var(--blue)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Trading Rules */}
      <div className="space-y-2 border-t border-terminal-border/30 pt-3">
        <div className="text-[9px] font-['Orbitron'] font-bold text-terminal-amber tracking-wider">
          ⚠️ TRADING RULES
        </div>
        <div className="text-[8px] text-terminal-dim space-y-1 leading-relaxed">
          <div>
            <strong className="text-terminal-blue">✓ Strong Signal:</strong> Confidence 75%+ + Risk/Reward 1:2+
          </div>
          <div>
            <strong className="text-terminal-amber">~ Moderate Signal:</strong> Confidence 60-74% + Risk/Reward 1:1.5+
          </div>
          <div>
            <strong className="text-terminal-red">⚠ Weak Signal:</strong> Confidence &lt;60% - Consider waiting
          </div>
          <div className="border-t border-terminal-border/30 pt-1 mt-1">
            <div className="font-bold">Position Sizing:</div>
            <div>• High confidence → 2-3% of portfolio</div>
            <div>• Medium confidence → 1-2% of portfolio</div>
            <div>• Low confidence → 0.5-1% or skip</div>
          </div>
        </div>
      </div>
    </div>
  );
}
