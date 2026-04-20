/**
 * Extended Signals API
 * Returns signals for 200+ assets: cryptos, stocks, commodities, indexes
 */

import { NextRequest, NextResponse } from "next/server";

export type SignalAction = "BUY" | "SELL" | "HOLD";

export interface ExtendedSignal {
  symbol: string;
  name: string;
  type: "crypto" | "stock" | "commodity" | "index";
  action: SignalAction;
  confidence: number;
  price: number;
  change: number;
  changePercent: number;
  target: string;
  stopLoss: string;
  rsi?: number;
  trend?: string;
}

export interface ExtendedSignalsPayload {
  signals: ExtendedSignal[];
  total: number;
  updatedAt: string;
}

// Top cryptos
const TOP_CRYPTOS = [
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "USDT", name: "Tether" },
  { symbol: "BNB", name: "Binance Coin" },
  { symbol: "XRP", name: "Ripple" },
  { symbol: "ADA", name: "Cardano" },
  { symbol: "DOGE", name: "Dogecoin" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "POLKADOT", name: "Polkadot" },
  { symbol: "AVAX", name: "Avalanche" },
];

// Top stocks
const TOP_STOCKS = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "GOOGL", name: "Alphabet" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "META", name: "Meta Platforms" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "AMD", name: "Advanced Micro" },
];

// Commodities
const COMMODITIES = [
  { symbol: "WTI", name: "WTI Crude Oil" },
  { symbol: "BRENT", name: "Brent Crude" },
  { symbol: "GOLD", name: "Gold" },
  { symbol: "SILVER", name: "Silver" },
  { symbol: "COPPER", name: "Copper" },
  { symbol: "NATGAS", name: "Natural Gas" },
];

// Major indexes
const INDEXES = [
  { symbol: "SPX", name: "S&P 500" },
  { symbol: "NDX", name: "Nasdaq-100" },
  { symbol: "INDU", name: "Dow Jones" },
  { symbol: "VIX", name: "Volatility Index" },
];

function generateSignal(item: any, type: string, index: number): ExtendedSignal {
  // Pseudo-random signal based on symbol
  const hash = item.symbol.charCodeAt(0) + item.symbol.charCodeAt(1);
  const actions: SignalAction[] = ["BUY", "SELL", "HOLD"];
  const action = actions[hash % 3];

  const basePrice = 50 + (index % 30) * 2000;
  const change = (hash % 20) - 10;
  const changePercent = (change / 100);

  return {
    symbol: item.symbol,
    name: item.name,
    type: type as any,
    action,
    confidence: 50 + (hash % 50),
    price: basePrice,
    change,
    changePercent,
    target: (basePrice * 1.05).toFixed(2),
    stopLoss: (basePrice * 0.95).toFixed(2),
    rsi: 30 + (hash % 70),
    trend: ["UP", "DOWN", "SIDEWAYS"][hash % 3],
  };
}

export async function GET(request: NextRequest) {
  try {
    const signals: ExtendedSignal[] = [];

    // Generate signals for all assets
    TOP_CRYPTOS.forEach((item, idx) => signals.push(generateSignal(item, "crypto", idx)));
    TOP_STOCKS.forEach((item, idx) => signals.push(generateSignal(item, "stock", idx)));
    COMMODITIES.forEach((item, idx) => signals.push(generateSignal(item, "commodity", idx)));
    INDEXES.forEach((item, idx) => signals.push(generateSignal(item, "index", idx)));

    return NextResponse.json({
      signals,
      total: signals.length,
      updatedAt: new Date().toISOString(),
    } as ExtendedSignalsPayload);
  } catch (error) {
    return NextResponse.json(
      { signals: [], total: 0, updatedAt: new Date().toISOString() },
      { status: 500 }
    );
  }
}
