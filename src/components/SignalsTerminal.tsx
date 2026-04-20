'use client';
import { useEffect, useState } from 'react';
import type { ExtendedSignal, ExtendedSignalsPayload } from '@/app/api/signals-extended/route';

type FilterType = 'all' | 'crypto' | 'stock' | 'commodity' | 'index';
type SortField = 'symbol' | 'confidence' | 'change';

const TYPE_COLORS: Record<string, string> = {
  crypto: 'rgba(247, 147, 26, 0.2)',
  stock: 'rgba(0, 200, 240, 0.2)',
  commodity: 'rgba(255, 179, 0, 0.2)',
  index: 'rgba(0, 232, 122, 0.2)',
};

const TYPE_BADGES: Record<string, { bg: string; text: string }> = {
  crypto: { bg: 'rgba(247, 147, 26, 0.3)', text: '#f7931a' },
  stock: { bg: 'rgba(0, 200, 240, 0.3)', text: '#00c8f0' },
  commodity: { bg: 'rgba(255, 179, 0, 0.3)', text: '#ffb300' },
  index: { bg: 'rgba(0, 232, 122, 0.3)', text: '#00e87a' },
};

export default function SignalsTerminal() {
  const [signals, setSignals] = useState<ExtendedSignal[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortField>('confidence');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const r = await fetch('/api/signals-extended', { cache: 'no-store' });
        if (r.ok) {
          const d: ExtendedSignalsPayload = await r.json();
          setSignals(d.signals);
        }
      } catch (e) {
        console.error('Failed to fetch signals:', e);
      } finally {
        setLoading(false);
      }
    };
    fetch_();
    const iv = setInterval(fetch_, 60000);
    return () => clearInterval(iv);
  }, []);

  const filtered = filter === 'all'
    ? signals
    : signals.filter(s => s.type === filter);

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'confidence') return b.confidence - a.confidence;
    if (sort === 'change') return b.changePercent - a.changePercent;
    return a.symbol.localeCompare(b.symbol);
  });

  const stats = {
    buy: filtered.filter(s => s.action === 'BUY').length,
    sell: filtered.filter(s => s.action === 'SELL').length,
    hold: filtered.filter(s => s.action === 'HOLD').length,
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Filters & Stats */}
      <div className="shrink-0 border-b border-terminal-border bg-terminal-panel p-4 space-y-3">
        {/* Stats */}
        <div className="grid grid-cols-5 gap-2">
          <div className="rounded border border-terminal-border/50 p-2 bg-terminal-surface/40 text-center">
            <div className="text-[9px] text-terminal-dim">TOTAL</div>
            <div className="text-[13px] font-['Orbitron'] font-bold text-terminal-bright">{filtered.length}</div>
          </div>
          <div className="rounded border border-terminal-border/50 p-2 bg-terminal-surface/40 text-center">
            <div className="text-[9px] text-terminal-dim">BUY</div>
            <div className="text-[13px] font-['Orbitron'] font-bold" style={{ color: 'var(--green)' }}>{stats.buy}</div>
          </div>
          <div className="rounded border border-terminal-border/50 p-2 bg-terminal-surface/40 text-center">
            <div className="text-[9px] text-terminal-dim">SELL</div>
            <div className="text-[13px] font-['Orbitron'] font-bold" style={{ color: 'var(--red)' }}>{stats.sell}</div>
          </div>
          <div className="rounded border border-terminal-border/50 p-2 bg-terminal-surface/40 text-center">
            <div className="text-[9px] text-terminal-dim">HOLD</div>
            <div className="text-[13px] font-['Orbitron'] font-bold" style={{ color: 'var(--blue)' }}>{stats.hold}</div>
          </div>
          <div className="rounded border border-terminal-border/50 p-2 bg-terminal-surface/40 text-center">
            <div className="text-[9px] text-terminal-dim">AVG CONF</div>
            <div className="text-[13px] font-['Orbitron'] font-bold text-terminal-bright">
              {filtered.length > 0 ? Math.round(filtered.reduce((sum, s) => sum + s.confidence, 0) / filtered.length) : 0}%
            </div>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2">
          {(['all', 'crypto', 'stock', 'commodity', 'index'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded text-[9px] font-['Orbitron'] font-bold transition-all border"
              style={{
                background: filter === f ? 'rgba(0,200,240,0.2)' : 'transparent',
                borderColor: filter === f ? 'rgba(0,200,240,0.6)' : 'rgba(0,200,240,0.2)',
                color: filter === f ? 'var(--blue)' : 'var(--dim)',
              }}
            >
              {f.toUpperCase()}
            </button>
          ))}
          <div className="flex-1" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortField)}
            className="px-3 py-1 rounded text-[9px] font-['Orbitron'] bg-terminal-surface border border-terminal-border/50 text-terminal-text cursor-pointer"
          >
            <option value="confidence">Sort: Confidence ↓</option>
            <option value="change">Sort: Change ↓</option>
            <option value="symbol">Sort: Symbol A-Z</option>
          </select>
        </div>
      </div>

      {/* Signals Table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-terminal-dim">Loading signals...</div>
        ) : sorted.length === 0 ? (
          <div className="p-8 text-center text-terminal-dim">No signals found</div>
        ) : (
          <table className="w-full text-[10px] border-collapse">
            <thead className="sticky top-0 bg-terminal-panel border-b border-terminal-border">
              <tr>
                <th className="p-2 text-left text-terminal-dim font-['Orbitron'] font-bold tracking-wider">SYMBOL</th>
                <th className="p-2 text-left text-terminal-dim font-['Orbitron'] font-bold tracking-wider">NAME</th>
                <th className="p-2 text-center text-terminal-dim font-['Orbitron'] font-bold tracking-wider">TYPE</th>
                <th className="p-2 text-right text-terminal-dim font-['Orbitron'] font-bold tracking-wider">PRICE</th>
                <th className="p-2 text-right text-terminal-dim font-['Orbitron'] font-bold tracking-wider">CHANGE</th>
                <th className="p-2 text-center text-terminal-dim font-['Orbitron'] font-bold tracking-wider">SIGNAL</th>
                <th className="p-2 text-center text-terminal-dim font-['Orbitron'] font-bold tracking-wider">CONF</th>
                <th className="p-2 text-right text-terminal-dim font-['Orbitron'] font-bold tracking-wider">TARGET</th>
                <th className="p-2 text-right text-terminal-dim font-['Orbitron'] font-bold tracking-wider">STOP</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((signal) => (
                <tr
                  key={signal.symbol}
                  className="border-b border-terminal-border/30 hover:bg-terminal-surface/50 transition-colors"
                  style={{ background: TYPE_COLORS[signal.type] }}
                >
                  <td className="p-2 font-['Orbitron'] font-bold text-terminal-bright">{signal.symbol}</td>
                  <td className="p-2 text-terminal-text">{signal.name}</td>
                  <td className="p-2 text-center">
                    <span
                      className="px-2 py-0.5 rounded text-[8px] font-['Orbitron'] font-bold"
                      style={{ background: TYPE_BADGES[signal.type].bg, color: TYPE_BADGES[signal.type].text }}
                    >
                      {signal.type.slice(0, 3).toUpperCase()}
                    </span>
                  </td>
                  <td className="p-2 text-right font-['Orbitron'] font-bold tabular-nums">
                    ${signal.price.toFixed(2)}
                  </td>
                  <td
                    className="p-2 text-right font-bold tabular-nums"
                    style={{ color: signal.changePercent >= 0 ? 'var(--green)' : 'var(--red)' }}
                  >
                    {signal.changePercent >= 0 ? '+' : ''}{signal.changePercent.toFixed(2)}%
                  </td>
                  <td className="p-2 text-center">
                    <span
                      className="px-2.5 py-0.5 rounded font-['Orbitron'] font-bold text-[9px]"
                      style={{
                        background:
                          signal.action === 'BUY'
                            ? 'rgba(0,232,122,0.2)'
                            : signal.action === 'SELL'
                            ? 'rgba(255,51,85,0.2)'
                            : 'rgba(0,200,240,0.2)',
                        color:
                          signal.action === 'BUY'
                            ? 'var(--green)'
                            : signal.action === 'SELL'
                            ? 'var(--red)'
                            : 'var(--blue)',
                      }}
                    >
                      {signal.action}
                    </span>
                  </td>
                  <td className="p-2 text-center font-['Orbitron'] font-bold text-terminal-bright">
                    {signal.confidence}%
                  </td>
                  <td className="p-2 text-right font-['Orbitron'] font-bold text-terminal-green tabular-nums">
                    ${signal.target}
                  </td>
                  <td className="p-2 text-right font-['Orbitron'] font-bold text-terminal-red tabular-nums">
                    ${signal.stopLoss}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
