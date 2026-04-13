/**
 * /api/bot/status — returns current bot state and auto-triggers a tick
 * if the last tick was more than 15 minutes ago (self-healing for Hobby cron limits).
 */
import { NextResponse } from 'next/server';
import { serializeState, runTick } from '../tick/route';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const revalidate = 0;

const STALE_MS = 15 * 60 * 1000; // 15 minutes

export async function GET() {
  const state = serializeState();

  // Auto-trigger a tick if state is stale (no tick in last 15 min)
  const lastTick = state.lastTickAt ? new Date(state.lastTickAt).getTime() : 0;
  if (Date.now() - lastTick > STALE_MS) {
    // Fire-and-forget — don't await so status returns immediately
    runTick().catch(() => {});
  }

  return NextResponse.json({ ok: true, ...state });
}
