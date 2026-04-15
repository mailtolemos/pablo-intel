'use client';
import { useEffect, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

/* ── Key production locations ─────────────────────────────────────────────── */
interface MineralNode {
  id:        string;
  country:   string;
  coords:    [number, number];
  minerals:  string[];
  pct:       string;  // global share note
  risk:      'low' | 'medium' | 'high' | 'critical';
  detail:    string;
}

const NODES: MineralNode[] = [
  { id: 'cn', country: 'China',        coords: [104, 35],  minerals: ['REE', 'Graphite', 'Gallium', 'Tungsten'], pct: '60% REE mine · 85% REE process', risk: 'high',     detail: 'Dominant in rare earth mining AND processing. Export controls active on gallium, germanium, graphite since 2023.' },
  { id: 'cd', country: 'DRC',          coords: [24, -4],   minerals: ['Cobalt', 'Copper'],                        pct: '70% world cobalt',               risk: 'critical', detail: 'Democratic Republic of Congo produces ~70% of global cobalt. Ongoing political instability and artisanal mining risks.' },
  { id: 'za', country: 'South Africa', coords: [25, -29],  minerals: ['Platinum', 'Palladium', 'Rhodium'],        pct: '85% world platinum',             risk: 'high',     detail: 'South Africa holds the world\'s largest PGM reserves. Eskom power outages (load shedding) regularly curtail mine output.' },
  { id: 'ru', country: 'Russia',       coords: [100, 60],  minerals: ['Palladium', 'Nickel', 'Platinum'],         pct: '40% world palladium',            risk: 'critical', detail: 'Norilsk Nickel supplies ~40% of global palladium and significant nickel. Under G7 sanctions since 2022.' },
  { id: 'cl', country: 'Chile',        coords: [-70, -30], minerals: ['Copper', 'Lithium'],                       pct: '27% world copper · 25% Li',     risk: 'medium',   detail: 'World\'s largest copper producer and second largest lithium producer. Royalty legislation changes and Codelco issues.' },
  { id: 'au', country: 'Australia',    coords: [134, -25], minerals: ['Gold', 'Lithium', 'Nickel', 'Copper'],    pct: '51% world lithium · top Au',     risk: 'low',      detail: 'World\'s largest lithium producer (spodumene). Also top-5 gold, nickel, and copper. Politically stable and ESG-compliant.' },
  { id: 'pe', country: 'Peru',         coords: [-76, -10], minerals: ['Copper', 'Silver', 'Gold'],                pct: '11% world copper',               risk: 'medium',   detail: 'Second largest silver producer. Social protests near key mines (Las Bambas) periodically disrupt output.' },
  { id: 'mx', country: 'Mexico',       coords: [-102, 23], minerals: ['Silver'],                                  pct: '25% world silver',               risk: 'medium',   detail: 'World\'s largest silver producer. Key mines include Peñasquito and Saucito.' },
  { id: 'ca', country: 'Canada',       coords: [-96, 56],  minerals: ['Gold', 'Nickel', 'Uranium', 'Cobalt'],    pct: 'Top-5 gold · uranium',           risk: 'low',      detail: 'Stable, major producer across precious metals, nickel, and uranium (Athabasca Basin). Key Western supply chain partner.' },
  { id: 'id', country: 'Indonesia',    coords: [117, -1],  minerals: ['Nickel'],                                  pct: '37% world nickel',               risk: 'medium',   detail: 'World\'s largest nickel producer. Raw ore export ban (2020) forced downstream processing. Key for EV battery supply chain.' },
  { id: 'us', country: 'United States',coords: [-98, 38],  minerals: ['Gold', 'Copper', 'REE'],                  pct: 'Mountain Pass: only US REE mine', risk: 'low',     detail: 'MP Materials operates Mountain Pass, only significant REE mine outside China. Gold: Nevada. Copper: Arizona.' },
  { id: 'kz', country: 'Kazakhstan',   coords: [67, 48],   minerals: ['Uranium', 'Copper'],                       pct: '45% world uranium',              risk: 'medium',   detail: 'World\'s largest uranium producer via Kazatomprom (~45% of global supply). Politically sensitive given Russia proximity.' },
];

const RISK_COLOR: Record<string, string> = {
  low:      '#00e87a',
  medium:   '#ffb300',
  high:     '#ff8800',
  critical: '#ff3355',
};

const MIN_COLOR: Record<string, string> = {
  Gold:      '#ffb300',
  Silver:    '#c8d8e8',
  Platinum:  '#e0e8ff',
  Palladium: '#a0b8e0',
  Copper:    '#f87060',
  Nickel:    '#80c0e0',
  Cobalt:    '#6080ff',
  Lithium:   '#00e87a',
  Uranium:   '#80ff40',
  REE:       '#ff4080',
  Graphite:  '#808080',
  Gallium:   '#ff80c0',
  Tungsten:  '#c0a080',
};

export default function MineralMap() {
  const [selected, setSelected] = useState<MineralNode | null>(null);
  const [tooltip, setTooltip]   = useState<{ x: number; y: number; node: MineralNode } | null>(null);

  return (
    <div className="relative w-full h-full bg-terminal-bg overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-2 px-3 py-1.5
        bg-terminal-panel/90 backdrop-blur-sm border-b border-terminal-border">
        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--amber)' }} />
        <span className="text-[8px] font-['Orbitron'] text-terminal-dim tracking-widest uppercase">
          Global Mineral Production Map
        </span>
        <div className="ml-auto flex items-center gap-3">
          {['low', 'medium', 'high', 'critical'].map(r => (
            <div key={r} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: RISK_COLOR[r] }} />
              <span className="text-[7px] text-terminal-dim font-['Orbitron'] uppercase">{r}</span>
            </div>
          ))}
          {selected && (
            <button onClick={() => setSelected(null)}
              className="text-[7px] font-['Orbitron'] text-terminal-dim hover:text-terminal-bright ml-2"
            >✕ CLOSE</button>
          )}
        </div>
      </div>

      {/* Map */}
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 130, center: [10, 10] }}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup zoom={1} minZoom={0.8} maxZoom={4}>
          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: { rsmKey: string; [key: string]: unknown }[] }) =>
              geographies.map((geo: { rsmKey: string; [key: string]: unknown }) => (
                <Geography key={geo.rsmKey} geography={geo}
                  style={{
                    default: { fill: '#0a1e30', stroke: '#0f2a42', strokeWidth: 0.5, outline: 'none' },
                    hover:   { fill: '#122840', stroke: '#1a4060', strokeWidth: 0.5, outline: 'none' },
                    pressed: { fill: '#0d2238', outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {NODES.map(node => (
            <Marker key={node.id} coordinates={node.coords}
              onClick={() => setSelected(selected?.id === node.id ? null : node)}
              onMouseEnter={(e: React.MouseEvent) => {
                const rect = (e.currentTarget as SVGElement).closest('svg')?.getBoundingClientRect();
                if (rect) setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, node });
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* Outer pulse ring */}
              <circle r={node.risk === 'critical' ? 10 : 8} fill="transparent"
                stroke={RISK_COLOR[node.risk]} strokeWidth={1} opacity={0.3}
                className="animate-ping-slow" />
              {/* Main dot */}
              <circle r={node.risk === 'critical' ? 5 : 4}
                fill={RISK_COLOR[node.risk]}
                stroke="#030c18" strokeWidth={1.5}
                style={{ cursor: 'pointer', filter: `drop-shadow(0 0 4px ${RISK_COLOR[node.risk]})` }}
              />
              {/* Mini mineral pips */}
              {node.minerals.slice(0, 3).map((min, i) => (
                <circle key={min} r={1.5}
                  cx={(i - 1) * 5} cy={-9}
                  fill={MIN_COLOR[min] ?? 'var(--dim)'}
                  opacity={0.8}
                />
              ))}
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>

      {/* Hover tooltip */}
      {tooltip && !selected && (
        <div className="absolute z-20 pointer-events-none terminal-tooltip p-2 rounded"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}>
          <div className="text-[9px] font-bold text-terminal-bright">{tooltip.node.country}</div>
          <div className="text-[8px] text-terminal-dim">{tooltip.node.minerals.join(' · ')}</div>
          <div className="text-[8px] font-['Orbitron'] mt-0.5" style={{ color: RISK_COLOR[tooltip.node.risk] }}>
            {tooltip.node.pct}
          </div>
        </div>
      )}

      {/* Selected detail panel */}
      {selected && (
        <div className="absolute bottom-0 left-0 right-0 z-10 map-detail-panel p-3"
          style={{ borderTopColor: RISK_COLOR[selected.risk] }}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: RISK_COLOR[selected.risk], boxShadow: `0 0 8px ${RISK_COLOR[selected.risk]}` }} />
                <span className="text-[11px] font-bold text-terminal-bright">{selected.country}</span>
                <span className="text-[8px] font-['Orbitron'] px-1.5 py-0.5 rounded ml-1"
                  style={{
                    color:      RISK_COLOR[selected.risk],
                    background: `${RISK_COLOR[selected.risk]}18`,
                    border:     `1px solid ${RISK_COLOR[selected.risk]}40`,
                  }}>
                  {selected.risk.toUpperCase()} RISK
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {selected.minerals.map(m => (
                  <span key={m} className="text-[7px] font-['Orbitron'] px-2 py-0.5 rounded"
                    style={{
                      background: `${MIN_COLOR[m] ?? '#888'}18`,
                      border: `1px solid ${MIN_COLOR[m] ?? '#888'}40`,
                      color: MIN_COLOR[m] ?? 'var(--dim)',
                    }}>
                    {m}
                  </span>
                ))}
              </div>
              <p className="text-[9px] text-terminal-dim leading-snug">{selected.detail}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[8px] font-['Orbitron'] text-terminal-dim mb-0.5">Global share</div>
              <div className="text-[9px] font-bold" style={{ color: RISK_COLOR[selected.risk] }}>
                {selected.pct}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
