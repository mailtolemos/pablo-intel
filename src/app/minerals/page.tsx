import type { MetalPrice } from '@/app/api/metals/route';
import MineralsPriceStrip from '@/components/minerals/MineralsPriceStrip';
import MineralsNewsFeed from '@/components/minerals/MineralsNewsFeed';
import MineralMap from '@/components/minerals/MineralMap';
import MetalsMarket from '@/components/minerals/MetalsMarket';
import SupplyRisk from '@/components/minerals/SupplyRisk';

export const revalidate = 30;

async function getInitialMetals(): Promise<MetalPrice[]> {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';
    const r = await fetch(`${baseUrl}/api/metals`, { cache: 'no-store' });
    const d = await r.json();
    return d.metals ?? [];
  } catch {
    return [];
  }
}

const TICKER_ITEMS = [
  '⬡ MINERALS SENTINEL — Real-time precious & base metals intelligence',
  '🟡 GOLD: Central bank buying >1,000t/year provides structural floor',
  '⚪ SILVER: Gold/silver ratio historically elevated — potential mean reversion',
  '🔴 CHINA: REE export controls on gallium, germanium, graphite active since 2023',
  '🇿🇦 SOUTH AFRICA: PGM output curtailed by Eskom load shedding (Stage 4–6)',
  '🇷🇺 RUSSIA: Palladium supply (40% global) under G7 sanctions pressure',
  '🇨🇩 DRC: Cobalt supply (70% global) exposed to political instability',
  '🔋 EV TRANSITION: Shifting auto catalyst demand — bearish Pd, bullish Li',
  '🇮🇩 INDONESIA: Nickel export ban reshaping LME supply chain',
  '📊 CFTC COT REPORT: Fridays 15:30 UTC — institutional positioning signal',
  '🇨🇱 CHILE: Copper royalty legislation risk — 27% of world supply',
  '⚛️ URANIUM: Kazatomprom controls 45% of global production',
];

const TICKER_STRING = TICKER_ITEMS.join('     ·     ');

export default async function MineralsPage() {
  const initialMetals = await getInitialMetals();

  return (
    <div className="hidden md:flex flex-col h-screen overflow-hidden bg-terminal-bg transition-colors duration-300">

      {/* Price strip */}
      <div className="shrink-0 h-[62px] border-b border-terminal-border">
        <MineralsPriceStrip initialMetals={initialMetals} />
      </div>

      {/* Main 3-column grid */}
      <div className="flex-1 min-h-0 grid grid-cols-[300px_1fr_340px] overflow-hidden">

        {/* Left: Minerals news */}
        <div className="panel border-r border-terminal-border overflow-hidden flex flex-col">
          <MineralsNewsFeed />
        </div>

        {/* Center: Map + Market metrics */}
        <div className="flex flex-col overflow-hidden border-r border-terminal-border">
          <div className="flex-[58] min-h-0 panel border-b border-terminal-border">
            <MineralMap />
          </div>
          <div className="flex-[42] min-h-0 panel overflow-hidden">
            <MetalsMarket />
          </div>
        </div>

        {/* Right: Supply risk + Sector ETFs */}
        <div className="flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 panel overflow-hidden">
            <SupplyRisk />
          </div>
        </div>
      </div>

      {/* Bottom ticker */}
      <div className="shrink-0 h-7 border-t border-terminal-border bg-terminal-surface flex items-center overflow-hidden">
        <div className="shrink-0 px-3 border-r border-terminal-border h-full flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--amber)' }} />
          <span className="text-[9px] font-['Orbitron'] font-bold tracking-wider" style={{ color: 'var(--amber)' }}>LIVE</span>
        </div>
        <div className="flex-1 overflow-hidden relative">
          <div className="ticker-text text-[10px] text-terminal-text font-medium">
            {TICKER_STRING}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{TICKER_STRING}
          </div>
        </div>
        <div className="shrink-0 px-3 border-l border-terminal-border h-full flex items-center gap-3">
          <a href="/" className="text-[8px] font-['Orbitron'] text-terminal-dim hover:text-terminal-amber transition-colors tracking-wider">
            ← HOME
          </a>
          <span className="text-[9px] text-terminal-dim font-['Orbitron'] tracking-wider">MINERALS SENTINEL</span>
        </div>
      </div>
    </div>
  );
}
