'use client';
import { useEffect, useState } from 'react';
import type { Chokepoint, ThreatEvent } from '@/lib/types';
import MetricTooltip from '@/components/MetricTooltip';

const STATUS_CONFIG = {
  open:      { text: 'text-terminal-green', dot: 'bg-terminal-green', label: 'OPEN'      },
  disrupted: { text: 'text-terminal-amber', dot: 'bg-terminal-amber', label: 'DISRUPTED' },
  critical:  { text: 'text-terminal-red',   dot: 'bg-terminal-red',   label: 'CRITICAL'  },
  closed:    { text: 'text-terminal-red',   dot: 'bg-terminal-red',   label: 'CLOSED'    },
};

const SEV_RISK: Record<string, number> = { low: 2, medium: 5, high: 8, critical: 10 };

interface ShipsData {
  chokepoints: Chokepoint[];
  threats: ThreatEvent[];
  stats: { totalShips: number; vlccs: number; suezmax: number; aframax: number; totalDwtMillion: number };
}
interface Metrics {
  brtWtiSpread: number; opecSpareCapacity: number; sentimentIndex: number;
  volatilityIndex: number; inventoryTrend: string; crackSpread: number;
}

export default function ThreatMatrix() {
  const [data,    setData]    = useState<ShipsData | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [sr, pr] = await Promise.all([fetch('/api/ships'), fetch('/api/prices')]);
      const ships: ShipsData = await sr.json();
      const prices           = await pr.json();
      setData(ships);
      const brt = prices.prices?.find((p: any) => p.symbol === 'BRT');
      const wti = prices.prices?.find((p: any) => p.symbol === 'WTI');
      if (brt && wti) {
        setMetrics({
          brtWtiSpread: +(brt.price - wti.price).toFixed(2),
          opecSpareCapacity: 3.2, sentimentIndex: 48,
          volatilityIndex: 24.3, inventoryTrend: 'draw', crackSpread: 18.4,
        });
      }
    } catch { /* stale */ } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 60_000);
    return () => clearInterval(iv);
  }, []);

  const chokepoints    = data?.chokepoints ?? [];
  const threats        = data?.threats.filter(t => t.active) ?? [];
  const disruptedCount = chokepoints.filter(c => c.status !== 'open').length;
  const avgSeverity    = threats.length
    ? threats.reduce((a, t) => a + (SEV_RISK[t.severity] ?? 3), 0) / threats.length : 0;
  const sortedThreats  = [...threats].sort((a, b) => (SEV_RISK[b.severity] ?? 0) - (SEV_RISK[a.severity] ?? 0));

  return (
    <div className="flex flex-col h-full overflow-hidden bg-terminal-panel transition-colors duration-300">

      {/* ── Header ──────────────── */}
      <div className="section-header">
        <div className="dot" />
        <span>THREAT MATRIX</span>
        {disruptedCount > 0 && (
          <span className="ml-auto text-terminal-red text-[9px] font-bold animate-pulse font-['Orbitron']">
            ⚠ {disruptedCount} DISRUPTED
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col gap-2 p-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse space-y-1.5">
              <div className="h-2.5 bg-terminal-muted rounded w-3/4" />
              <div className="h-2 bg-terminal-muted/50 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">

          {/* ── Chokepoints ──────── */}
          <div className="px-2.5 pt-3 pb-2">
            <SectionLabel>Chokepoints</SectionLabel>
            <div className="grid grid-cols-2 gap-1.5">
              {chokepoints.map(cp => {
                const sc = STATUS_CONFIG[cp.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.open;
                return (
                  <div key={cp.id} className="panel px-2.5 py-2 flex items-start gap-2">
                    <div className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${sc.dot}
                      ${cp.status !== 'open' ? 'animate-pulse' : ''}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] text-terminal-bright font-bold leading-tight truncate">
                        {cp.name
                          .replace('Strait of ', '')
                          .replace(' Canal', '')
                          .replace('Turkish Straits (Bosphorus)', 'Bosphorus')
                          .split(',')[0]}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[8px] font-bold ${sc.text}`}>{sc.label}</span>
                        <span className="text-terminal-dim text-[8px]">· {cp.throughputMbpd} Mb/d</span>
                      </div>
                    </div>
                    <div className={`text-[11px] font-bold shrink-0 ${
                      cp.riskLevel >= 4 ? 'text-terminal-red' :
                      cp.riskLevel >= 3 ? 'text-terminal-amber' : 'text-terminal-green'
                    }`}>
                      {cp.riskLevel}/5
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Active Threats ────── */}
          <div className="px-2.5 pb-2">
            <SectionLabel>Active Threats</SectionLabel>
            <div className="flex flex-col gap-1.5">
              {sortedThreats.map(t => {
                const risk = SEV_RISK[t.severity] ?? 3;
                const col  = risk >= 8 ? 'var(--red)' : risk >= 5 ? 'var(--amber)' : 'var(--green)';
                return (
                  <div key={t.id} className="panel px-2.5 py-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      {/* Severity dots */}
                      <div className="flex gap-0.5 shrink-0">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="w-2 h-2 rounded-sm"
                            style={{
                              background: i < Math.ceil(risk / 2) ? col : 'var(--border)',
                            }} />
                        ))}
                      </div>
                      <span className="text-[10px] text-terminal-bright font-bold flex-1 truncate">{t.region}</span>
                      <span className="text-[8px] shrink-0 px-1.5 py-0.5 rounded border font-bold uppercase"
                        style={{ color: col, background: col + '18', borderColor: col + '44' }}>
                        {t.severity}
                      </span>
                    </div>
                    <div className="text-[9px] text-terminal-text leading-snug">{t.impact}</div>
                    {t.priceImpact && (
                      <div className="text-[9px] font-bold mt-1.5" style={{ color: col }}>{t.priceImpact}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Market Metrics ────── */}
          {metrics && (
            <div className="px-2.5 pb-2">
              <SectionLabel>Market Metrics</SectionLabel>
              <div className="grid grid-cols-2 gap-1.5">
                <MetricTile label="BRT-WTI Spread"   value={`$${metrics.brtWtiSpread}`}   sub="$/bbl"
                  tipTitle="Brent–WTI Spread"
                  tipDesc="Price difference between Brent (global benchmark) and WTI (US benchmark). Reflects transport costs, US inventory levels at Cushing, and geopolitical risk premiums."
                  tipContext={metrics.brtWtiSpread > 3 ? 'Wide: elevated Brent risk premium' : metrics.brtWtiSpread > 1 ? 'Normal range' : 'Compressed: US–global price convergence'} />
                <MetricTile label="OPEC Spare Cap"   value={`${metrics.opecSpareCapacity}`} sub="Mb/d"
                  tipTitle="OPEC+ Spare Capacity"
                  tipDesc="Unused production capacity that OPEC+ members can bring online within 30–90 days. Higher spare capacity = stronger price buffer. Saudi Arabia holds ~2 Mb/d of global spare."
                  tipContext="Current ~3.2 Mb/d: moderate price buffer against supply shocks" />
                <MetricTile label="Sentiment Index"  value={`${metrics.sentimentIndex}`}
                  sub={metrics.sentimentIndex > 50 ? '▲ BULLISH' : '▼ BEARISH'}
                  color={metrics.sentimentIndex > 50 ? 'text-terminal-green' : 'text-terminal-red'}
                  tipTitle="Market Sentiment Index"
                  tipDesc="Composite 0–100 index derived from news direction ratio, analyst positioning, and price momentum signals. Above 50 = net bullish; below 50 = net bearish."
                  tipContext={metrics.sentimentIndex > 50 ? 'Above 50: more bullish than bearish signals' : 'Below 50: bearish signals dominate'} />
                <MetricTile label="Inventory Trend"  value={metrics.inventoryTrend.toUpperCase()} sub="EIA weekly"
                  color={metrics.inventoryTrend === 'draw' ? 'text-terminal-green' : 'text-terminal-red'}
                  tipTitle="EIA Inventory Trend"
                  tipDesc="Direction of US crude oil and petroleum inventory changes from the weekly EIA Petroleum Status Report. 'DRAW' = stocks falling (bullish); 'BUILD' = stocks rising (bearish)."
                  tipContext={metrics.inventoryTrend === 'draw' ? 'DRAW: demand exceeding supply — supports prices' : 'BUILD: supply exceeding demand — pressures prices'} />
                <MetricTile label="Volatility (OVX)" value={metrics.volatilityIndex.toFixed(1)} sub="index"
                  tipTitle="OVX — Crude Oil Volatility Index"
                  tipDesc="CBOE Crude Oil Volatility Index (OVX), known as the 'Oil VIX'. Measures expected 30-day volatility implied by Brent options. Above 35 = elevated fear; above 60 = crisis level."
                  tipContext={metrics.volatilityIndex > 35 ? 'Elevated: options market pricing high uncertainty' : 'Normal: below 35, market relatively calm'} />
                <MetricTile label="Crack Spread"     value={`$${metrics.crackSpread.toFixed(1)}`} sub="3-2-1 $/bbl"
                  tipTitle="3-2-1 Crack Spread"
                  tipDesc="Proxy for refinery profit margin: converting 3 barrels of crude into 2 barrels of gasoline and 1 barrel of distillate. Higher = better refining economics; lower = margin squeeze."
                  tipContext={metrics.crackSpread > 20 ? 'Strong: refiners incentivised to maximise runs' : metrics.crackSpread > 12 ? 'Healthy: normal refinery economics' : 'Weak: refinery margins under pressure'} />
              </div>
            </div>
          )}

          {/* ── Fleet Status ────────── */}
          {data && (
            <div className="px-2.5 pb-4">
              <SectionLabel>Fleet Status</SectionLabel>
              <div className="panel px-3 py-3 grid grid-cols-2 gap-3">
                <FleetStat value={data.stats.totalShips} label="TANKERS TRACKED"  color="text-terminal-blue glow-blue"
                  tipTitle="Tankers Tracked"
                  tipDesc="Total number of oil tankers (VLCC, Suezmax, Aframax, LR2) currently being monitored via AIS transponder signals on key shipping lanes."
                  tipContext="Includes vessels on Middle East, West Africa, and Atlantic routes" />
                <FleetStat value={data.stats.vlccs}      label="VLCCs ACTIVE"     color="text-terminal-amber"
                  tipTitle="VLCCs Active"
                  tipDesc="Very Large Crude Carriers — the largest oil tankers, each carrying 2 million barrels (320,000 DWT). Primarily route crude from the Persian Gulf to Asia and Europe."
                  tipContext="Each VLCC = ~2 million barrels of crude capacity" />
                <FleetStat value={disruptedCount}        label="DISRUPTED ROUTES"
                  color={disruptedCount > 0 ? 'text-terminal-red' : 'text-terminal-green'}
                  tipTitle="Disrupted Chokepoints"
                  tipDesc="Number of critical oil shipping chokepoints currently in 'disrupted' or 'critical' status. Disruptions force rerouting, extending voyage times and raising freight rates."
                  tipContext={disruptedCount > 0 ? `${disruptedCount} active disruption(s) — tankers may be rerouting` : 'All monitored routes currently open'} />
                <FleetStat value={avgSeverity.toFixed(1)} label="AVG RISK SCORE"
                  color={avgSeverity >= 7 ? 'text-terminal-red' : avgSeverity >= 4 ? 'text-terminal-amber' : 'text-terminal-green'}
                  tipTitle="Average Threat Severity"
                  tipDesc="Mean severity score of all active geopolitical threat events on a 0–10 scale. Scores: Low=2, Medium=5, High=8, Critical=10. Reflects composite risk to oil supply."
                  tipContext={avgSeverity >= 7 ? 'High risk: multiple severe threats active' : avgSeverity >= 4 ? 'Elevated: moderate threat environment' : 'Low: no major active disruptions'} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-['Orbitron'] text-terminal-dim uppercase tracking-widest mb-2 flex items-center gap-2">
      <div className="h-px flex-1 bg-terminal-border" />
      <span>{children}</span>
      <div className="h-px flex-1 bg-terminal-border" />
    </div>
  );
}

function MetricTile({ label, value, sub, color = 'text-terminal-bright', tipTitle, tipDesc, tipContext }: {
  label: string; value: string; sub?: string; color?: string;
  tipTitle?: string; tipDesc?: string; tipContext?: string;
}) {
  return (
    <div className="panel px-2.5 py-2">
      <div className="text-[8px] text-terminal-dim uppercase tracking-wider mb-1 font-['Orbitron']">{label}</div>
      <div className={`text-[15px] font-bold leading-none tabular-nums ${color}`}>
        {tipTitle && tipDesc ? (
          <MetricTooltip title={tipTitle} description={tipDesc} context={tipContext}>
            {value}
          </MetricTooltip>
        ) : value}
      </div>
      {sub && <div className="text-[8px] text-terminal-dim mt-1">{sub}</div>}
    </div>
  );
}

function FleetStat({ value, label, color, tipTitle, tipDesc, tipContext }: {
  value: number | string; label: string; color: string;
  tipTitle?: string; tipDesc?: string; tipContext?: string;
}) {
  return (
    <div className="text-center">
      <div className={`text-[22px] font-bold leading-none tabular-nums ${color}`}>
        {tipTitle && tipDesc ? (
          <MetricTooltip title={tipTitle} description={tipDesc} context={tipContext}>
            {value}
          </MetricTooltip>
        ) : value}
      </div>
      <div className="text-[8px] text-terminal-dim mt-1.5 tracking-wide font-['Orbitron']">{label}</div>
    </div>
  );
}
