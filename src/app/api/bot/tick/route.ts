/**
 * /api/bot/tick — OilSentinel automated bot tick.
 *
 * Called by Vercel Cron every 15 minutes.
 * Orchestrates: news ingestion → scoring → Telegram alerts → price checks → scheduler.
 *
 * GET  ?cron=true   — cron trigger (sends alerts if warranted)
 * GET  ?force=true  — manual trigger
 * GET               — returns current state only (no side-effects)
 */
import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

export const runtime = 'nodejs';
export const maxDuration = 60;   // seconds — Vercel Pro serverless limit
export const revalidate = 0;

// ── Telegram ──────────────────────────────────────────────────────────────────
const TG_TOKEN = process.env.TELEGRAM_TOKEN ?? '8765231096:AAHpncIbzIu2c9-i7ZQ9l5AwoKvdX1LxfV4';
const TG_BASE  = `https://api.telegram.org/bot${TG_TOKEN}`;

async function tgChatIds(): Promise<string[]> {
  try {
    const r = await fetch(`${TG_BASE}/getUpdates?limit=100&offset=-100`, { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    const ids = new Set<string>();
    for (const u of d.result ?? []) {
      for (const key of ['message', 'channel_post', 'my_chat_member', 'edited_message']) {
        const cid = u[key]?.chat?.id;
        if (cid) ids.add(String(cid));
      }
    }
    return Array.from(ids);
  } catch { return []; }
}

async function tgSend(text: string): Promise<boolean> {
  const ids = await tgChatIds();
  if (!ids.length) return false;
  let ok = false;
  for (const id of ids) {
    try {
      const r = await fetch(`${TG_BASE}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: id, text: text.slice(0, 4096), parse_mode: 'HTML', disable_web_page_preview: true }),
        signal: AbortSignal.timeout(8000),
      });
      if ((await r.json()).ok) ok = true;
    } catch { /* skip */ }
  }
  return ok;
}

// ── Module-level state (persists within same Vercel instance) ─────────────────
interface AlertRecord {
  type:      'flash' | 'analysis' | 'price' | 'event';
  title:     string;
  source:    string;
  score:     number;
  direction: string;
  sentAt:    string;
  url?:      string;
}

interface BotState {
  startedAt:         string;
  lastTickAt:        string | null;
  lastNewsAt:        string | null;
  tickCount:         number;
  articlesScanned:   number;
  flashSent:         number;
  analysisSent:      number;
  priceSent:         number;
  eventSent:         number;
  recentAlerts:      AlertRecord[];
  seenIds:           Set<string>;
  lastPrices:        Record<string, number>;
  errors:            string[];
  telegramConnected: boolean;
  chatCount:         number;
}

const state: BotState = {
  startedAt:         new Date().toISOString(),
  lastTickAt:        null,
  lastNewsAt:        null,
  tickCount:         0,
  articlesScanned:   0,
  flashSent:         0,
  analysisSent:      0,
  priceSent:         0,
  eventSent:         0,
  recentAlerts:      [],
  seenIds:           new Set(),
  lastPrices:        {},
  errors:            [],
  telegramConnected: false,
  chatCount:         0,
};

// How long to remember a seen article (6 hours)
const SEEN_TTL_MS = 6 * 60 * 60 * 1000;
let seenTimestamps: Map<string, number> = new Map();

function addSeen(id: string) {
  state.seenIds.add(id);
  seenTimestamps.set(id, Date.now());
}
function isSeen(id: string): boolean {
  // Expire old entries
  const now = Date.now();
  Array.from(seenTimestamps.entries()).forEach(([k, ts]) => {
    if (now - ts > SEEN_TTL_MS) { state.seenIds.delete(k); seenTimestamps.delete(k); }
  });
  return state.seenIds.has(id);
}
function pushAlert(alert: AlertRecord) {
  state.recentAlerts.unshift(alert);
  if (state.recentAlerts.length > 30) state.recentAlerts = state.recentAlerts.slice(0, 30);
}

// ── Scoring ───────────────────────────────────────────────────────────────────
const BULLISH = ['surge','spike','soar','jump','rally','shortage','disruption','attack','blockade',
  'closure','cut','sanction','embargo','draw','deficit','tight','escalat','airstrike',
  'missile','explosion','seized','naval','conflict','war','offensive','shutdown','outage',
  'sabotage','halt','force majeure','curtail','supply gap'];
const BEARISH = ['crash','plunge','drop','fall','surplus','glut','oversupply','build','increase output',
  'ramp','ease','ceasefire','peace','recession','demand destroy','slump','weak demand',
  'relief','nuclear deal','sanctions lifted','deal reached','record production'];
const URGENCY = ['breaking','urgent','flash','just in','developing','exclusive','alert','war declared',
  'shots fired','attack','explosion','emergency','critical'];
const DRIVERS: [string[], string][] = [
  [['hormuz','persian gulf','iran navy','irgc strait'],          'strait_hormuz'],
  [['opec','production cut','output cut','quota','aramco'],      'opec'],
  [['sanction','embargo','price cap','shadow fleet','ofac'],     'sanctions'],
  [['suez','red sea','houthi','bab el-mandeb','aden','yemen'],   'chokepoints'],
  [['inventory','stockpile','cushing','eia weekly','api report'],'inventory'],
  [['war','military','strike','attack','airstrike','missile','conflict','rocket','drone'], 'war_conflict'],
  [['iran','irgc','khamenei','tehran','nuclear','jcpoa'],        'iran'],
  [['china','chinese','pmi','teapot','beijing','sinopec'],       'china_demand'],
  [['russia','urals','espo','moscow','novatek','lukoil'],        'russia'],
  [['libya','nigeria','iraq','venezuela','angola','kazakh'],     'supply_disruption'],
  [['shortage','deficit','supply gap','outage','force majeure'], 'supply_disruption'],
  [['shale','permian','bakken','rig count','baker hughes'],      'us_supply'],
  [['federal reserve','fed rate','interest rate','fomc','dollar'],'macro'],
  [['tanker','vlcc','suezmax','aframax','freight rate','worldscale'],'shipping'],
  [['crack spread','refinery','refining margin','gasoline','diesel'],'refining'],
  [['spr','strategic petroleum reserve'],                        'spr'],
  [['cftc','commitment of traders','speculative','net long','net short'],'cftc'],
  [['baker hughes','rig count','drilling','active rigs'],        'rig_count'],
  [['iea','opec monthly','opec momr','steo','energy outlook'],   'official_report'],
];
const TOPIC_BONUS: Record<string,number> = {
  iran_conflict:18, chokepoints:16, sanctions:14, opec:12, inventory:10,
  geopolitical:12, shortage:12, report:10, positioning:8, shipping:8, gas:7,
};

function scoreArticle(title: string, summary: string, topic: string) {
  const text = `${title} ${summary}`.toLowerCase();
  let bullish = BULLISH.filter(w => text.includes(w)).length;
  let bearish = BEARISH.filter(w => text.includes(w)).length;
  const urgHit = URGENCY.some(u => text.includes(u));

  const drivers: string[] = [];
  for (const [kws, driver] of DRIVERS) {
    if (kws.some(k => text.includes(k)) && !drivers.includes(driver)) drivers.push(driver);
  }

  const driverWt   = drivers.length;
  const multiBonus = driverWt >= 4 ? 25 : driverWt >= 3 ? 18 : driverWt === 2 ? 10 : 0;
  const geoBonus   = drivers.some(d => ['strait_hormuz','war_conflict','sanctions','chokepoints','iran','russia'].includes(d)) ? 18 : drivers.includes('opec') ? 12 : 0;
  const topicB     = TOPIC_BONUS[topic] ?? 0;
  const urgBonus   = urgHit ? 15 : 0;
  const baseSent   = bullish + bearish > 0 ? Math.abs(bullish - bearish) / (bullish + bearish) * 25 : 5;
  const score      = Math.min(100, Math.round(baseSent + driverWt * 8 + multiBonus + geoBonus + topicB + urgBonus));

  const direction  = bullish > bearish * 1.5 ? 'bullish' : bearish > bullish * 1.5 ? 'bearish' : bullish + bearish > 0 ? 'mixed' : 'neutral';
  const isBreaking = score >= 75 || urgHit || /breaking|urgent|flash/i.test(title);

  return { score, direction, drivers, isBreaking };
}

function formatFlash(title: string, source: string, score: number, direction: string, drivers: string[], summary: string, url: string): string {
  const icon = direction === 'bullish' ? '🟢' : direction === 'bearish' ? '🔴' : '🟡';
  const driverStr = drivers.slice(0, 3).join(', ') || 'general';
  return (
    `⚡ <b>FLASH ALERT — OIL SENTINEL</b>\n` +
    `${'━'.repeat(30)}\n` +
    `<b>${title}</b>\n\n` +
    `📡 Source: ${source}  ·  🎯 Score: ${score}/100\n` +
    `${icon} ${direction.toUpperCase()}  ·  Drivers: ${driverStr}\n\n` +
    `${summary.slice(0, 250)}${summary.length > 250 ? '…' : ''}\n\n` +
    `🔗 <a href="${url}">Read more</a>`
  );
}
function formatAnalysis(title: string, source: string, score: number, direction: string, drivers: string[], url: string): string {
  const icon = direction === 'bullish' ? '📈' : direction === 'bearish' ? '📉' : '↔️';
  return (
    `📊 <b>OIL SENTINEL — Analysis</b>\n` +
    `${'─'.repeat(26)}\n` +
    `<b>${title}</b>\n\n` +
    `📡 ${source}  ·  Score: ${score}  ${icon} ${direction.toUpperCase()}\n` +
    `Drivers: ${drivers.slice(0, 3).join(', ') || 'general'}\n\n` +
    `🔗 <a href="${url}">Source</a>`
  );
}

// ── OIL RELEVANCE FILTER ──────────────────────────────────────────────────────
const OIL_STRONG = ['crude','brent','wti','petroleum','opec','aramco','lng','tanker',
  'refinery','barrel','mb/d','mbpd','pdvsa','pemex','rosneft','novatek','lukoil',
  'gasoline','diesel fuel','fuel oil','heating oil','gasoil','shale','permian',
  'oil field','oil price','oil market','oil production','oil supply','oil demand',
  'oil output','oil export','oil import','oil reserve','oil sector','oil minister',
  'natural gas price','eia weekly','eia inventory','api inventory','baker hughes',
  'hormuz','bab el-mandeb','oil tanker','shadow fleet','price cap oil',
  'exxon','chevron','totalenergies','conocophillips','nnpc','adnoc'];
const OIL_WEAK  = ['oil','fuel','energy crisis','energy security','pipeline','petrol price',
  'sanctions russia','iran nuclear','houthi','red sea attack','saudi arabia','iraq oil',
  'russia oil','nigeria oil'];
const PASS_TOPICS = new Set(['iran_conflict','chokepoints','opec','inventory','shortage',
  'sanctions','us_supply','report','positioning','gas','shipping']);

function isOilRelevant(title: string, summary: string, topic: string): boolean {
  if (PASS_TOPICS.has(topic)) return true;
  const text   = (title + ' ' + summary).toLowerCase();
  const tLower = title.toLowerCase();
  if (OIL_STRONG.some(t => tLower.includes(t))) return true;
  if (OIL_STRONG.some(t => text.includes(t)))   return true;
  const weakHits = OIL_WEAK.filter(t => text.includes(t)).length;
  if (weakHits >= 2) return true;
  if (tLower.includes('oil') && (text.includes('war') || text.includes('sanction') || text.includes('opec') || text.includes('iran') || text.includes('russia') || text.includes('price'))) return true;
  return false;
}

// ── RSS Fetch ─────────────────────────────────────────────────────────────────
const FEEDS = [
  { url: 'https://oilprice.com/rss/main',                   topic: 'energy'    },
  { url: 'https://www.eia.gov/rss/todayinenergy.xml',        topic: 'inventory' },
  { url: 'https://www.rigzone.com/news/rss/rigzone_latest.aspx', topic: 'energy' },
  { url: 'https://feeds.reuters.com/reuters/businessNews',   topic: 'macro'     },
  { url: 'https://feeds.reuters.com/reuters/worldNews',      topic: 'geopolitical' },
  { url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml', topic: 'iran_conflict' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml',     topic: 'geopolitical' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml',        topic: 'geopolitical' },
  { url: 'https://news.google.com/rss/search?q=Iran+war+conflict+oil+nuclear+military&hl=en-US&gl=US&ceid=US:en', topic: 'iran_conflict' },
  { url: 'https://news.google.com/rss/search?q=Houthi+Red+Sea+tanker+attack+shipping+Yemen&hl=en-US&gl=US&ceid=US:en', topic: 'chokepoints' },
  { url: 'https://news.google.com/rss/search?q=Strait+Hormuz+Bab+el-Mandeb+Suez+Canal+oil+tanker&hl=en-US&gl=US&ceid=US:en', topic: 'chokepoints' },
  { url: 'https://news.google.com/rss/search?q=OPEC+production+cut+output+quota+Saudi+Arabia&hl=en-US&gl=US&ceid=US:en', topic: 'opec' },
  { url: 'https://news.google.com/rss/search?q=Russia+oil+sanction+price+cap+shadow+fleet+Ukraine&hl=en-US&gl=US&ceid=US:en', topic: 'sanctions' },
  { url: 'https://news.google.com/rss/search?q=EIA+crude+inventory+weekly+petroleum+stockpile&hl=en-US&gl=US&ceid=US:en', topic: 'inventory' },
  { url: 'https://news.google.com/rss/search?q=Brent+crude+oil+price+WTI+futures+market&hl=en-US&gl=US&ceid=US:en', topic: 'price' },
  { url: 'https://news.google.com/rss/search?q=Iran+IRGC+tanker+seizure+Hormuz+oil+sanctions&hl=en-US&gl=US&ceid=US:en', topic: 'iran_conflict' },
  { url: 'https://news.google.com/rss/search?q=Saudi+Arabia+Aramco+oil+production+output+barrel&hl=en-US&gl=US&ceid=US:en', topic: 'opec' },
  { url: 'https://news.google.com/rss/search?q=IEA+oil+market+report+demand+forecast+monthly&hl=en-US&gl=US&ceid=US:en', topic: 'report' },
  { url: 'https://news.google.com/rss/search?q=OPEC+monthly+oil+market+report+MOMR+forecast&hl=en-US&gl=US&ceid=US:en', topic: 'report' },
  { url: 'https://news.google.com/rss/search?q=Baker+Hughes+rig+count+weekly+US+oil&hl=en-US&gl=US&ceid=US:en', topic: 'us_supply' },
  { url: 'https://news.google.com/rss/search?q=CFTC+oil+positioning+speculative+net+long+short+COT&hl=en-US&gl=US&ceid=US:en', topic: 'positioning' },
  { url: 'https://news.google.com/rss/search?q=LNG+liquefied+natural+gas+export+terminal+price&hl=en-US&gl=US&ceid=US:en', topic: 'gas' },
  { url: 'https://news.google.com/rss/search?q=tanker+freight+rates+Baltic+dirty+VLCC+Aframax&hl=en-US&gl=US&ceid=US:en', topic: 'shipping' },
];

interface RawArticle { id: string; title: string; source: string; url: string; summary: string; topic: string; }

async function fetchFeedItems(url: string, topic: string): Promise<RawArticle[]> {
  const source = new URL(url).hostname.replace('www.','').replace('news.google.com','GNews').replace('feeds.','').split('.')[0];
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'OilSentinelBot/3.0' },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return [];
    const xml    = await r.text();
    const parser = new XMLParser({ ignoreAttributes: false, htmlEntities: true, trimValues: true });
    const parsed = parser.parse(xml);
    const items  = parsed?.rss?.channel?.item ?? parsed?.feed?.entry ?? parsed?.['rdf:RDF']?.item ?? [];
    const arr    = Array.isArray(items) ? items : [items];

    const results: RawArticle[] = [];
    for (const item of arr.slice(0, 10)) {
      const title = String(item.title ?? '').replace(/^<!\[CDATA\[|\]\]>$/g, '').trim();
      if (title.length < 10) continue;
      const rawSum = String(item.description ?? item.summary ?? item['content:encoded'] ?? '');
      const summary = rawSum.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
      const rawLink = item.link ?? item.guid ?? item.id ?? '';
      const link = typeof rawLink === 'string' ? rawLink : (rawLink as Record<string,string>)?.['@_href'] ?? '';
      if (!isOilRelevant(title, summary, topic)) continue;
      const id = `${source}-${Buffer.from(title.slice(0,40)).toString('base64').slice(0,12)}`;
      results.push({ id, title, source, url: link, summary, topic });
    }
    return results;
  } catch { return []; }
}

// ── Scheduler: market events ──────────────────────────────────────────────────
interface MarketEvent { name: string; icon: string; detail: string; dayOfWeek?: number; hour: number; minute: number; monthly?: boolean; dayOfMonth?: number; }
const MARKET_EVENTS: MarketEvent[] = [
  { name: 'API Weekly Crude Inventories', icon: '⛽', detail: 'API crude oil stock changes — published Tuesday ~4:30 PM ET. Early indicator before EIA Wednesday.', dayOfWeek: 2, hour: 20, minute: 30 },
  { name: 'EIA Weekly Petroleum Status', icon: '📊', detail: 'Official EIA weekly crude + product inventories — most-watched weekly release. Wednesday ~10:30 AM ET.', dayOfWeek: 3, hour: 14, minute: 30 },
  { name: 'Baker Hughes Rig Count', icon: '⚙️', detail: 'Weekly count of active US oil + gas rigs. Friday ~1 PM ET. Leading indicator of future US output.', dayOfWeek: 5, hour: 17, minute: 0 },
  { name: 'CFTC Commitments of Traders', icon: '📋', detail: 'Speculative positioning in WTI + Brent. Data as of Tuesday, released Friday 3:30 PM ET.', dayOfWeek: 5, hour: 19, minute: 30 },
  { name: 'EIA STEO (Monthly)', icon: '🔮', detail: 'EIA Short-Term Energy Outlook — monthly price/supply/demand forecast. First Tuesday after the 6th.', monthly: true, dayOfMonth: 10, hour: 16, minute: 0 },
  { name: 'OPEC Monthly Report', icon: '🛢', detail: 'OPEC MOMR — official member production and compliance data. Mid-month, ~13th.', monthly: true, dayOfMonth: 13, hour: 10, minute: 0 },
  { name: 'IEA Oil Market Report', icon: '🌍', detail: 'IEA monthly demand/supply assessment. Mid-month, ~14th. Compare with OPEC MOMR for full picture.', monthly: true, dayOfMonth: 14, hour: 9, minute: 0 },
];

function getUpcomingEvents(withinHours = 168): Array<MarketEvent & { fireTime: string; minutesUntil: number }> {
  const now = new Date();
  const results = [];
  for (const evt of MARKET_EVENTS) {
    let fire = new Date(now);
    if (!evt.monthly && evt.dayOfWeek !== undefined) {
      const daysUntil = ((evt.dayOfWeek - now.getUTCDay() + 7) % 7) || 7;
      fire.setUTCDate(now.getUTCDate() + daysUntil);
      fire.setUTCHours(evt.hour, evt.minute, 0, 0);
      // If same day but already passed, add 7 days
      if (fire <= now) { fire.setUTCDate(fire.getUTCDate() + 7); }
    } else if (evt.monthly && evt.dayOfMonth) {
      fire.setUTCDate(evt.dayOfMonth);
      fire.setUTCHours(evt.hour, evt.minute, 0, 0);
      if (fire <= now) { fire.setUTCMonth(fire.getUTCMonth() + 1); }
    }
    const diffMs = fire.getTime() - now.getTime();
    const diffH  = diffMs / 3600000;
    if (diffH <= withinHours) {
      results.push({ ...evt, fireTime: fire.toISOString(), minutesUntil: Math.round(diffMs / 60000) });
    }
  }
  return results.sort((a, b) => a.minutesUntil - b.minutesUntil);
}

// ── Main tick logic ────────────────────────────────────────────────────────────
async function runTick(sendAlerts: boolean): Promise<{ newFlash: number; newAnalysis: number; scanned: number; errors: string[] }> {
  let newFlash = 0, newAnalysis = 0, scanned = 0;
  const errors: string[] = [];

  // Fetch all feeds concurrently
  const fetches = await Promise.allSettled(FEEDS.map(f => fetchFeedItems(f.url, f.topic)));
  const seen = new Set<string>();
  const articles: RawArticle[] = [];
  for (const result of fetches) {
    if (result.status === 'fulfilled') {
      for (const art of result.value) {
        if (!seen.has(art.title.slice(0, 60).toLowerCase())) {
          seen.add(art.title.slice(0, 60).toLowerCase());
          articles.push(art);
        }
      }
    }
  }
  scanned = articles.length;

  if (sendAlerts) {
    // Check Telegram connectivity
    const chatIds = await tgChatIds();
    state.telegramConnected = chatIds.length > 0;
    state.chatCount = chatIds.length;

    for (const art of articles) {
      if (isSeen(art.id)) continue;
      addSeen(art.id);

      const { score, direction, drivers, isBreaking } = scoreArticle(art.title, art.summary, art.topic);

      if (score >= 75) {  // Flash
        const msg = formatFlash(art.title, art.source, score, direction, drivers, art.summary, art.url);
        const ok = await tgSend(msg);
        if (ok) {
          newFlash++;
          state.flashSent++;
          pushAlert({ type: 'flash', title: art.title, source: art.source, score, direction, sentAt: new Date().toISOString(), url: art.url });
        }
      } else if (score >= 52) {  // Analysis
        const msg = formatAnalysis(art.title, art.source, score, direction, drivers, art.url);
        const ok = await tgSend(msg);
        if (ok) {
          newAnalysis++;
          state.analysisSent++;
          pushAlert({ type: 'analysis', title: art.title, source: art.source, score, direction, sentAt: new Date().toISOString(), url: art.url });
        }
      }
      // Avoid flooding: cap per tick
      if (newFlash >= 2 && newAnalysis >= 3) break;
    }

    // Check for event reminders (30 min window)
    const upcoming = getUpcomingEvents(1);  // within next hour
    for (const evt of upcoming) {
      if (evt.minutesUntil <= 30 && evt.minutesUntil >= 27) {
        const msg = `⏰ <b>REMINDER — ${evt.icon} ${evt.name}</b>\n${'─'.repeat(28)}\nReleases in <b>~30 minutes</b> at ${new Date(evt.fireTime).toUTCString().slice(17, 22)} UTC\n\nℹ️ ${evt.detail}\n\n💡 <i>Prepare your analysis. Price moves often occur within minutes of the print.</i>`;
        await tgSend(msg);
        state.eventSent++;
        pushAlert({ type: 'event', title: evt.name, source: 'Scheduler', score: 0, direction: 'neutral', sentAt: new Date().toISOString() });
      }
    }
  }

  state.articlesScanned += scanned;
  return { newFlash, newAnalysis, scanned, errors };
}

// ── GET handler ───────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const isCron  = searchParams.get('cron')  === 'true';
  const isForce = searchParams.get('force') === 'true';
  const sendAlerts = isCron || isForce;

  if (sendAlerts) {
    state.lastTickAt = new Date().toISOString();
    state.tickCount++;
    state.lastNewsAt = new Date().toISOString();

    try {
      const result = await runTick(sendAlerts);
      return NextResponse.json({
        ok: true,
        tickAt: state.lastTickAt,
        ...result,
        totalFlash: state.flashSent,
        totalAnalysis: state.analysisSent,
        telegramConnected: state.telegramConnected,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      state.errors.push(msg);
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
  }

  // Status-only request
  return NextResponse.json({ ok: true, state: serializeState() });
}

export function serializeState() {
  return {
    startedAt:         state.startedAt,
    lastTickAt:        state.lastTickAt,
    lastNewsAt:        state.lastNewsAt,
    tickCount:         state.tickCount,
    articlesScanned:   state.articlesScanned,
    flashSent:         state.flashSent,
    analysisSent:      state.analysisSent,
    priceSent:         state.priceSent,
    eventSent:         state.eventSent,
    recentAlerts:      state.recentAlerts,
    telegramConnected: state.telegramConnected,
    chatCount:         state.chatCount,
    feedCount:         FEEDS.length,
    upcomingEvents:    getUpcomingEvents(168),
    errors:            state.errors.slice(-5),
  };
}
