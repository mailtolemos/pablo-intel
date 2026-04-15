'use client';
import { useEffect, useState } from 'react';
import type { Chokepoint, ThreatEvent } from '@/lib/types';

const STATUS = {
  open:      { label: 'OPEN',      color: 'var(--green)', bg: 'rgba(0,232,122,0.08)' },
  disrupted: { label: 'DISRUPTED', color: 'var(--amber)', bg: 'rgba(255,179,0,0.08)' },
  critical:  { label: 'CRITICAL',  color: 'var(--red)',   bg: 'rgba(255,51,85,0.10)' },
  closed:    { label: 'CLOSED',    color: 'var(--red)',   bg: 'rgba(255,51,85,0.14)' },
};

const SEV_COLOR: Record<string, string> = {
  low: 'var(--dim)', medium: 'var(--amber)', high: 'var(--red)', critical: 'var(--red)',
};
const SEV_SCORE: Record<string, number> = {
  low: 2, medium: 5, high: 8, critical: 10,
};

interface Data { chokepoints: Chokepoint[]; threats: ThreatEvent[] }

export default function ThreatMatrix() {
  const [data,    setData]    = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const r = await fetch('/api/ships');
        const d = await r.json();
        setData({ chokepoints: d.chokepoints ?? [], threats: d.threats ?? [] });
      } catch { /* stale */ } finally { setLoading(false); }
    };
    fetch_();
    const iv = setInterval(fetch_, 60_000);
    return () => clearInterval(iv);
  }, []);

  const chokepoints = data?.chokepoints ?? [];
  const threats     = (data?.threats ?? []).filter(t => t.active)
    .sort((a, b) => (SEV_SCORE[b.severity] ?? 0) - (SEV_SCORE[a.severity] ?? 0));
  const disrupted   = chokepoints.filter(c => c.status !== 'open').length;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-terminal-panel">

      {/* Header */}
      <div className="section-header shrink-0">
        <div className="dot" />
        <span>GEOPOLITICAL RISK</span>
        {disrupted > 0 && (
          <span className="ml-auto text-terminal-red text-[8px] font-bold font-['Orbitron'] animate-pulse">
            ⚠ {disrupted} DISRUPTED
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">

        {loading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse h-8 bg-terminal-muted rounded" />
            ))}
          </div>
        ) : (
          <>
            {/* ── Chokepoints ──────────────────────────────── */}
            <div className="px-3 pt-3 pb-2">
              <div className="text-[7px] font-['Orbitron'] tracking-widest text-terminal-dim uppercase mb-2">
                Chokepoints
              </div>
              <div className="space-y-1">
                {chokepoints.map(cp => {
                  const s = STATUS[cp.status] ?? STATUS.open;
                  return (
                    <div key={cp.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded border border-terminal-border"
                      style={{ background: s.bg }}>
                      {/* Status dot */}
                      <div className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: s.color, boxShadow: cp.status !== 'open' ? `0 0 6px ${s.color}` : 'none' }} />
                      {/* Name + flow */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] font-semibold text-terminal-bright truncate">{cp.name}</div>
                        <div className="text-[8px] text-terminal-dim">{cp.throughputMbpd} Mb/d</div>
                      </div>
                      {/* Risk bar */}
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span className="text-[8px] font-bold font-['Orbitron']" style={{ color: s.color }}>
                          {s.label}
                        </span>
                        <div className="w-12 h-1 bg-terminal-border rounded overflow-hidden">
                          <div className="h-full rounded"
                            style={{
                              width: `${(cp.riskLevel / 5) * 100}%`,
                              background: s.color,
                            }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="mx-3 border-t border-terminal-border" />

            {/* ── Active Threats ─────────────────────────── */}
            <div className="px-3 pt-2.5 pb-3">
              <div className="text-[7px] font-['Orbitron'] tracking-widest text-terminal-dim uppercase mb-2">
                Active Threats
              </div>
              {threats.length === 0 ? (
                <div className="text-[9px] text-terminal-dim text-center py-3">No active threats</div>
              ) : (
                <div className="space-y-1.5">
                  {threats.map(t => (
                    <div key={t.id} className="border border-terminal-border rounded px-2 py-2 bg-terminal-surface">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                          <div className="text-[9px] font-semibold text-terminal-bright leading-snug">{t.title}</div>
                          <div className="text-[8px] text-terminal-dim mt-0.5">{t.region}</div>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-0.5">
                          <span className="text-[8px] font-bold font-['Orbitron']"
                            style={{ color: SEV_COLOR[t.severity] ?? 'var(--dim)' }}>
                            {t.severity.toUpperCase()}
                          </span>
                          <div className="w-12 h-1 bg-terminal-border rounded overflow-hidden">
                            <div className="h-full rounded"
                              style={{
                                width: `${(SEV_SCORE[t.severity] ?? 0) / 10 * 100}%`,
                                background: SEV_COLOR[t.severity] ?? 'var(--dim)',
                              }} />
                          </div>
                        </div>
                      </div>
                      <div className="text-[8px] text-terminal-dim leading-snug line-clamp-2">{t.impact}</div>
                      {t.priceImpact && (
                        <div className="mt-1 text-[8px] font-semibold" style={{ color: 'var(--amber)' }}>
                          {t.priceImpact}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
