"""
ingestion.py — OilSentinel RSS ingestion module.
Fetches and parses 40+ curated oil/energy news feeds.
Returns structured article dicts ready for AnalysisEngine.
"""
import re
import logging
import hashlib
from datetime import datetime, timezone
from typing import Optional
import feedparser
import requests

log = logging.getLogger(__name__)

# ── Feed Registry ─────────────────────────────────────────────────────────────
# tier 1 = primary/authoritative source, tier 2 = aggregated/secondary
# topic = used by AnalysisEngine for bonus scoring

RSS_FEEDS = [
    # ── Dedicated energy publishers ───────────────────────────────────────────
    {"url": "https://oilprice.com/rss/main",
     "source": "OilPrice.com",          "tier": 1, "topic": "energy"},
    {"url": "https://www.eia.gov/rss/todayinenergy.xml",
     "source": "EIA Today in Energy",   "tier": 1, "topic": "inventory"},
    {"url": "https://www.rigzone.com/news/rss/rigzone_latest.aspx",
     "source": "Rigzone",               "tier": 1, "topic": "energy"},
    {"url": "https://www.worldoil.com/rss/news",
     "source": "World Oil",             "tier": 1, "topic": "energy"},
    {"url": "https://www.ogj.com/rss/home.rss",
     "source": "Oil & Gas Journal",     "tier": 1, "topic": "energy"},
    {"url": "https://www.hartenergy.com/rss/news",
     "source": "Hart Energy",           "tier": 1, "topic": "energy"},
    {"url": "https://upstreamonline.com/rss",
     "source": "Upstream Online",       "tier": 1, "topic": "supply"},
    {"url": "https://www.lngworldnews.com/feed/",
     "source": "LNG World News",        "tier": 1, "topic": "gas"},
    {"url": "https://naturalgasintel.com/feed/",
     "source": "Natural Gas Intel",     "tier": 1, "topic": "gas"},

    # ── Wire services ─────────────────────────────────────────────────────────
    {"url": "https://feeds.reuters.com/reuters/businessNews",
     "source": "Reuters Business",      "tier": 1, "topic": "macro"},
    {"url": "https://feeds.reuters.com/reuters/worldNews",
     "source": "Reuters World",         "tier": 1, "topic": "geopolitical"},
    {"url": "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml",
     "source": "BBC Middle East",       "tier": 1, "topic": "iran_conflict"},
    {"url": "https://feeds.bbci.co.uk/news/world/rss.xml",
     "source": "BBC World",             "tier": 1, "topic": "geopolitical"},
    {"url": "https://www.aljazeera.com/xml/rss/all.xml",
     "source": "Al Jazeera",            "tier": 1, "topic": "geopolitical"},
    {"url": "https://www.arabianbusiness.com/rss/latest-news",
     "source": "Arabian Business",      "tier": 1, "topic": "opec"},
    {"url": "https://www.middleeasteye.net/rss",
     "source": "Middle East Eye",       "tier": 2, "topic": "geopolitical"},

    # ── Iran / nuclear / sanctions ────────────────────────────────────────────
    {"url": "https://news.google.com/rss/search?q=Iran+war+conflict+oil+nuclear+military&hl=en-US&gl=US&ceid=US:en",
     "source": "Iran Conflict",         "tier": 1, "topic": "iran_conflict"},
    {"url": "https://news.google.com/rss/search?q=Iran+Israel+strike+attack+airstrike+missile&hl=en-US&gl=US&ceid=US:en",
     "source": "Iran-Israel",           "tier": 1, "topic": "iran_conflict"},
    {"url": "https://news.google.com/rss/search?q=Iran+OFAC+sanctions+oil+nuclear+IAEA&hl=en-US&gl=US&ceid=US:en",
     "source": "Iran Sanctions",        "tier": 1, "topic": "sanctions"},

    # ── Red Sea / chokepoints ─────────────────────────────────────────────────
    {"url": "https://news.google.com/rss/search?q=Houthi+Red+Sea+tanker+attack+shipping+Yemen&hl=en-US&gl=US&ceid=US:en",
     "source": "Red Sea Crisis",        "tier": 1, "topic": "chokepoints"},
    {"url": "https://news.google.com/rss/search?q=Strait+Hormuz+Bab+el-Mandeb+Suez+Canal+oil+tanker&hl=en-US&gl=US&ceid=US:en",
     "source": "Chokepoint News",       "tier": 1, "topic": "chokepoints"},
    {"url": "https://news.google.com/rss/search?q=tanker+seizure+piracy+shipping+lane+oil+vessel&hl=en-US&gl=US&ceid=US:en",
     "source": "Tanker Security",       "tier": 1, "topic": "chokepoints"},

    # ── OPEC+ ─────────────────────────────────────────────────────────────────
    {"url": "https://news.google.com/rss/search?q=OPEC+production+cut+output+quota+Saudi+Arabia+UAE&hl=en-US&gl=US&ceid=US:en",
     "source": "OPEC News",             "tier": 1, "topic": "opec"},
    {"url": "https://news.google.com/rss/search?q=Saudi+Arabia+Aramco+oil+production+output+barrel&hl=en-US&gl=US&ceid=US:en",
     "source": "Saudi Arabia",          "tier": 1, "topic": "opec"},
    {"url": "https://news.google.com/rss/search?q=OPEC+compliance+quota+overproduction+cheat&hl=en-US&gl=US&ceid=US:en",
     "source": "OPEC Compliance",       "tier": 2, "topic": "opec"},

    # ── Russia / Ukraine / price cap ──────────────────────────────────────────
    {"url": "https://news.google.com/rss/search?q=Russia+oil+sanction+price+cap+shadow+fleet+Ukraine&hl=en-US&gl=US&ceid=US:en",
     "source": "Russia Oil",            "tier": 1, "topic": "sanctions"},
    {"url": "https://news.google.com/rss/search?q=Russia+Ukraine+war+pipeline+energy+G7+EU+embargo&hl=en-US&gl=US&ceid=US:en",
     "source": "Russia-Ukraine",        "tier": 1, "topic": "sanctions"},

    # ── Inventory / EIA / API ─────────────────────────────────────────────────
    {"url": "https://news.google.com/rss/search?q=EIA+crude+inventory+weekly+petroleum+stockpile&hl=en-US&gl=US&ceid=US:en",
     "source": "EIA Inventory",         "tier": 1, "topic": "inventory"},
    {"url": "https://news.google.com/rss/search?q=API+inventory+crude+oil+weekly+draw+build&hl=en-US&gl=US&ceid=US:en",
     "source": "API Inventory",         "tier": 1, "topic": "inventory"},
    {"url": "https://news.google.com/rss/search?q=EIA+STEO+short-term+energy+outlook+forecast&hl=en-US&gl=US&ceid=US:en",
     "source": "EIA STEO",              "tier": 1, "topic": "report"},

    # ── Supply chain / disruptions ─────────────────────────────────────────────
    {"url": "https://news.google.com/rss/search?q=Iraq+oil+Basra+production+pipeline+disruption&hl=en-US&gl=US&ceid=US:en",
     "source": "Iraq Oil",              "tier": 2, "topic": "supply"},
    {"url": "https://news.google.com/rss/search?q=Libya+oil+field+Sharara+shutdown+blockade&hl=en-US&gl=US&ceid=US:en",
     "source": "Libya Oil",             "tier": 2, "topic": "supply"},
    {"url": "https://news.google.com/rss/search?q=Nigeria+oil+pipeline+Niger+Delta+NNPC+Bonny&hl=en-US&gl=US&ceid=US:en",
     "source": "Nigeria Oil",           "tier": 2, "topic": "supply"},
    {"url": "https://news.google.com/rss/search?q=Venezuela+PDVSA+oil+production+shortage+sanctions&hl=en-US&gl=US&ceid=US:en",
     "source": "Venezuela Oil",         "tier": 2, "topic": "shortage"},
    {"url": "https://news.google.com/rss/search?q=Kazakhstan+CPC+pipeline+oil+disruption+Caspian&hl=en-US&gl=US&ceid=US:en",
     "source": "CPC Pipeline",          "tier": 2, "topic": "shortage"},

    # ── Asia fuel shortages ───────────────────────────────────────────────────
    {"url": "https://news.google.com/rss/search?q=Pakistan+fuel+diesel+petrol+shortage+crisis+IMF&hl=en-US&gl=US&ceid=US:en",
     "source": "Pakistan Fuel",         "tier": 2, "topic": "shortage"},
    {"url": "https://news.google.com/rss/search?q=Sri+Lanka+Bangladesh+Myanmar+Nepal+fuel+shortage+rationing&hl=en-US&gl=US&ceid=US:en",
     "source": "Asia Fuel Crisis",      "tier": 2, "topic": "shortage"},
    {"url": "https://news.google.com/rss/search?q=India+China+oil+demand+import+consumption+growth&hl=en-US&gl=US&ceid=US:en",
     "source": "Asia Demand",           "tier": 1, "topic": "demand"},

    # ── China demand ──────────────────────────────────────────────────────────
    {"url": "https://news.google.com/rss/search?q=China+oil+import+demand+refinery+teapot+2025&hl=en-US&gl=US&ceid=US:en",
     "source": "China Demand",          "tier": 1, "topic": "demand"},

    # ── US supply + rigs ──────────────────────────────────────────────────────
    {"url": "https://news.google.com/rss/search?q=Permian+shale+rig+count+Baker+Hughes+US+production&hl=en-US&gl=US&ceid=US:en",
     "source": "US Supply",             "tier": 2, "topic": "us_supply"},
    {"url": "https://news.google.com/rss/search?q=US+strategic+petroleum+reserve+SPR+release+refill&hl=en-US&gl=US&ceid=US:en",
     "source": "SPR News",              "tier": 2, "topic": "inventory"},

    # ── Prices / markets ──────────────────────────────────────────────────────
    {"url": "https://news.google.com/rss/search?q=Brent+crude+oil+price+WTI+futures+market+forecast&hl=en-US&gl=US&ceid=US:en",
     "source": "Price Action",          "tier": 1, "topic": "price"},

    # ── LNG / gas ─────────────────────────────────────────────────────────────
    {"url": "https://news.google.com/rss/search?q=LNG+liquefied+natural+gas+export+terminal+price&hl=en-US&gl=US&ceid=US:en",
     "source": "LNG News",              "tier": 2, "topic": "gas"},

    # ── Shipping / tanker rates ───────────────────────────────────────────────
    {"url": "https://news.google.com/rss/search?q=tanker+rates+Baltic+dirty+VLCC+Aframax+Suezmax+freight&hl=en-US&gl=US&ceid=US:en",
     "source": "Tanker Rates",          "tier": 2, "topic": "shipping"},

    # ── CFTC / positioning ────────────────────────────────────────────────────
    {"url": "https://news.google.com/rss/search?q=CFTC+oil+positioning+speculative+net+long+short+COT&hl=en-US&gl=US&ceid=US:en",
     "source": "CFTC Positioning",      "tier": 2, "topic": "positioning"},

    # ── Macro / demand ────────────────────────────────────────────────────────
    {"url": "https://news.google.com/rss/search?q=Federal+Reserve+rate+dollar+inflation+oil+demand+macro&hl=en-US&gl=US&ceid=US:en",
     "source": "Macro Risk",            "tier": 2, "topic": "macro"},
    {"url": "https://news.google.com/rss/search?q=global+conflict+war+oil+supply+disruption+geopolitical&hl=en-US&gl=US&ceid=US:en",
     "source": "Geopolitical Risk",     "tier": 1, "topic": "geopolitical"},

    # ── Official reports ──────────────────────────────────────────────────────
    {"url": "https://news.google.com/rss/search?q=IEA+oil+market+report+demand+forecast+monthly&hl=en-US&gl=US&ceid=US:en",
     "source": "IEA Report",            "tier": 1, "topic": "report"},
    {"url": "https://news.google.com/rss/search?q=OPEC+monthly+oil+market+report+MOMR+forecast&hl=en-US&gl=US&ceid=US:en",
     "source": "OPEC MOMR",             "tier": 1, "topic": "report"},

    # ── Refining / products ───────────────────────────────────────────────────
    {"url": "https://news.google.com/rss/search?q=refinery+crack+spread+diesel+gasoline+margin+outage&hl=en-US&gl=US&ceid=US:en",
     "source": "Refining",              "tier": 2, "topic": "supply"},
]


# ── Helpers ──────────────────────────────────────────────────────────────────

def _strip_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&[a-z]+;", " ", text, flags=re.I)
    return re.sub(r"\s+", " ", text).strip()[:400]


def _make_id(source: str, title: str) -> str:
    raw = f"{source}::{title[:60]}".encode()
    return hashlib.sha1(raw).hexdigest()[:20]


def _parse_date(entry) -> str:
    for attr in ("published", "updated", "created"):
        val = getattr(entry, attr, None)
        if val:
            return val
    return datetime.now(timezone.utc).isoformat()


def fetch_feed(
    feed: dict,
    timeout: int = 8,
) -> list[dict]:
    """
    Fetch and parse a single RSS/Atom feed.
    Returns list of article dicts. Never raises — returns [] on any failure.
    """
    url    = feed["url"]
    source = feed["source"]
    topic  = feed.get("topic", "")

    try:
        # feedparser handles most XML variants including Google News Atom
        headers = {
            "User-Agent": "OilSentinelBot/3.0 (+https://github.com/mailtolemos/oil-sentinel-terminal)",
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        }
        resp = requests.get(url, headers=headers, timeout=timeout)
        resp.raise_for_status()
        parsed = feedparser.parse(resp.text)
    except requests.exceptions.Timeout:
        log.debug("Timeout fetching %s", source)
        return []
    except Exception as e:
        log.debug("Error fetching %s: %s", source, e)
        return []

    articles = []
    for entry in (parsed.entries or [])[:15]:
        title = _strip_html(getattr(entry, "title", "") or "").strip()
        if len(title) < 10:
            continue

        link    = getattr(entry, "link", "") or getattr(entry, "id", "") or ""
        summary = _strip_html(
            getattr(entry, "summary", "")
            or getattr(entry, "description", "")
            or getattr(entry, "content", [{}])[0].get("value", "") if hasattr(entry, "content") else ""
        )
        published = _parse_date(entry)
        article_id = _make_id(source, title)

        articles.append({
            "id":        article_id,
            "title":     title,
            "source":    source,
            "url":       link,
            "published": published,
            "summary":   summary,
            "topic":     topic,
            "tier":      feed.get("tier", 2),
        })

    return articles


def ingest_all(timeout: int = 8) -> list[dict]:
    """
    Fetch all feeds concurrently using threads.
    Returns deduplicated list of articles, newest first.
    """
    import concurrent.futures

    all_articles: list[dict] = []
    seen: set[str] = set()

    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        futures = {
            pool.submit(fetch_feed, feed, timeout): feed
            for feed in RSS_FEEDS
        }
        for fut in concurrent.futures.as_completed(futures):
            try:
                for art in fut.result():
                    key = art["title"][:70].lower()
                    if key not in seen and art["title"]:
                        seen.add(key)
                        all_articles.append(art)
            except Exception as e:
                log.debug("Feed future error: %s", e)

    # Sort newest first (best-effort — date strings vary)
    all_articles.sort(
        key=lambda a: a.get("published", ""),
        reverse=True,
    )
    log.info("Ingested %d unique articles from %d feeds", len(all_articles), len(RSS_FEEDS))
    return all_articles
