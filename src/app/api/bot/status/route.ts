/**
 * /api/bot/status — lightweight status endpoint for the BotPanel UI.
 * Re-exports state from the tick route without triggering a new tick.
 */
import { NextResponse } from 'next/server';
import { serializeState } from '../tick/route';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({ ok: true, ...serializeState() });
}
