"""
analysis.py — OilSentinel Analysis Engine.
Scores news articles for oil-market relevance, determines directional bias,
and classifies alert tier. Every alert ends with actionable intelligence.
"""
import re
import logging
import hashlib
from dataclasses import dataclass, field
from typing import Optional

log = logging.getLogger(__name__)

# ── Scoring dictionaries ──────────────────────────────────────────────────────

BULLISH_WORDS = [
    "surge", "spike", "soar", "jump", "rally", "shortage", "disruption",
    "attack", "blockade", "closure", "cut", "sanction", "embargo", "draw",
    "deficit", "tight", "escalat", "airstrike", "missile", "explosion",
    "seized", "naval", "conflict", "war", "offensive", "shutdown", "outage",
    "sabotage", "halt", "force majeure", "freeze", "hurricane", "curtail",
    "output reduction", "production cut", "supply gap", "stockpile draw",
]

BEARISH_WORDS = [
    "crash", "plunge", "drop", "fall", "surplus", "glut", "oversupply",
    "build", "increase output", "ramp", "ease", "ceasefire", "peace",
    "recession", "demand destroy", "slump", "weak demand", "slowdown",
    "relief", "nuclear deal", "jcpoa", "sanctions lifted", "deal reached",
    "record production", "output increase", "supply surplus", "inventory build",
    "stockpile build", "demand fall", "economic contraction",
]

HIGH_URGENCY = [
    "breaking", "urgent", "flash", "just in", "developing", "exclusive",
    "alert", "war declared", "shots fired", "attack", "explosion", "strike",
    "emergency", "crisis", "immediate", "critical",
]

# Driver patterns → driver key
DRIVER_MAP: dict[str, str] = {
    "hormuz|persian gulf|iran navy|irgc|iran strait":       "strait_hormuz",
    "opec|production cut|output cut|quota|barrel|aramco":   "opec",
    "sanction|embargo|price cap|shadow fleet|ofac|treasury":"sanctions",
    "suez|red sea|houthi|bab el-mandeb|aden|yemen":         "chokepoints",
    "inventory|stockpile|cushing|eia weekly|api report|"
    "crude draw|crude build":                                "inventory",
    "war|military|strike|attack|airstrike|missile|"
    "conflict|rocket|drone|explosion":                       "war_conflict",
    "iran|irgc|khamenei|tehran|nuclear|jcpoa|enrichment":   "iran",
    "china|chinese|pmi|teapot|beijing|sinopec|cnooc":       "china_demand",
    "hurricane|tropical|gulf of mexico|freeze|polar|"
    "pipeline freeze":                                       "weather",
    "shale|permian|bakken|rig count|baker hughes|fracking":  "us_supply",
    "federal reserve|fed rate|interest rate|fomc|"
    "dollar|dxy":                                            "macro",
    "russia|urals|espo|moscow|novatek|lukoil|rosneft":      "russia",
    "libya|nigeria|iraq|venezuela|angola|"
    "kazakh|azerbaij":                                       "supply_disruption",
    "pdvsa|maracaibo|orinoco|chevron venezuela":            "supply_disruption",
    "cpc pipeline|tengiz|kashagan|aktau|caspian":           "supply_disruption",
    "pemex|cantarell|chicontepec|campeche":                 "supply_disruption",
    "sudan|south sudan|nile|khartoum|rsf|saf conflict":     "supply_disruption",
    "shortage|deficit|supply gap|outage|force majeure":     "supply_disruption",
    "pakistan|sri lanka|bangladesh|myanmar|nepal|"
    "philippines|diesel ration|petrol ration|fuel queue":   "asia_shortage",
    "lng|liquefied natural gas|henry hub|ttf|"
    "natural gas|regasif":                                   "gas",
    "crack spread|refinery|refining margin|"
    "gasoline|diesel|jet fuel":                              "refining",
    "spr|strategic petroleum reserve|release|"
    "emergency reserve":                                     "spr",
    "tanker|vlcc|suezmax|aframax|freight rate|"
    "baltic dirty|worldscale":                              "shipping",
    "eia steo|short-term energy outlook|monthly report|"
    "iea oil|opec momr":                                    "official_report",
    "cftc|commitment of traders|speculative|net long|"
    "net short|positioning":                                 "cftc",
    "baker hughes|rig count|drilling|active rigs":          "rig_count",
}

# Category buckets
DRIVER_CATEGORY: dict[str, str] = {
    "strait_hormuz":    "geopolitical",
    "war_conflict":     "geopolitical",
    "sanctions":        "geopolitical",
    "chokepoints":      "geopolitical",
    "iran":             "geopolitical",
    "russia":           "geopolitical",
    "supply_disruption":"geopolitical",
    "asia_shortage":    "geopolitical",
    "opec":             "opec",
    "inventory":        "inventory",
    "china_demand":     "demand",
    "weather":          "weather",
    "us_supply":        "supply",
    "macro":            "macro",
    "gas":              "gas",
    "refining":         "supply",
    "spr":              "inventory",
    "shipping":         "geopolitical",
    "official_report":  "report",
    "cftc":             "positioning",
    "rig_count":        "supply",
}

# Topic bonus per feed topic
TOPIC_BONUS: dict[str, int] = {
    "iran_conflict":  20,
    "chokepoints":    18,
    "sanctions":      15,
    "opec":           12,
    "inventory":      10,
    "geopolitical":   12,
    "shortage":       14,
    "report":         10,
    "positioning":     8,
}


@dataclass
class ScoredArticle:
    id:          str
    title:       str
    source:      str
    url:         str
    published:   str
    summary:     str
    score:       int
    tier:        str          # "flash" | "analysis" | "standard" | "ignore"
    direction:   str          # "bullish" | "bearish" | "mixed" | "neutral"
    drivers:     list[str]
    category:    str
    is_breaking: bool
    bias_label:  str          # human-readable directional call
    action_text: str          # actionable next step
    hash:        str = field(default="")

    def __post_init__(self):
        if not self.hash:
            self.hash = hashlib.sha1(
                f"{self.title}{self.source}".encode()
            ).hexdigest()[:16]


class AnalysisEngine:
    """
    Scores articles for oil-market relevance and assigns actionable tiers.
    """

    def __init__(self, flash_threshold: int = 75, analysis_threshold: int = 50):
        self.flash_threshold    = flash_threshold
        self.analysis_threshold = analysis_threshold

    def score(self, title: str, summary: str, topic: str = "") -> dict:
        text = f"{title} {summary}".lower()
        bullish = sum(1 for w in BULLISH_WORDS if w in text)
        bearish = sum(1 for w in BEARISH_WORDS if w in text)

        urgency_hit   = any(u in text for u in HIGH_URGENCY)
        urgency_bonus = 15 if urgency_hit else 0

        # Driver matching
        drivers:    list[str] = []
        categories: list[str] = []
        for pattern, driver in DRIVER_MAP.items():
            keywords = pattern.split("|")
            if any(k in text for k in keywords):
                if driver not in drivers:
                    drivers.append(driver)
                cat = DRIVER_CATEGORY.get(driver, "general")
                if cat not in categories:
                    categories.append(cat)

        topic_bonus  = TOPIC_BONUS.get(topic, 0)
        driver_wt    = len(drivers)
        multi_bonus  = 25 if driver_wt >= 4 else 18 if driver_wt >= 3 else 10 if driver_wt == 2 else 0
        geo_bonus    = 18 if "geopolitical" in categories else 12 if "opec" in categories else 0
        base_sent    = (
            abs(bullish - bearish) / (bullish + bearish) * 25
            if bullish + bearish > 0 else 5
        )

        score = min(100, int(
            base_sent + driver_wt * 8 + multi_bonus
            + urgency_bonus + geo_bonus + topic_bonus
        ))

        direction: str
        if   bullish > bearish * 1.5:  direction = "bullish"
        elif bearish > bullish * 1.5:  direction = "bearish"
        elif bullish + bearish > 0:    direction = "mixed"
        else:                          direction = "neutral"

        is_breaking = score >= self.flash_threshold or urgency_hit or bool(
            re.search(r"breaking|urgent|flash", title, re.I)
        )

        return {
            "score": score,
            "direction": direction,
            "drivers": drivers,
            "category": categories[0] if categories else "general",
            "is_breaking": is_breaking,
            "urgency_hit": urgency_hit,
        }

    def _bias_label(self, direction: str, score: int) -> str:
        if direction == "bullish":
            return "▲ BULLISH — upward price pressure" if score >= 70 else "▲ Mildly bullish"
        if direction == "bearish":
            return "▼ BEARISH — downward price pressure" if score >= 70 else "▼ Mildly bearish"
        if direction == "mixed":
            return "◆ MIXED — conflicting signals"
        return "◆ NEUTRAL — no clear directional bias"

    def _action_text(self, drivers: list[str], direction: str, category: str) -> str:
        """Generate a concise, actionable next-step sentence."""
        if "strait_hormuz" in drivers or "war_conflict" in drivers:
            return (
                "Watch Brent front-month for gap-up at open. "
                "Confirm via tanker AIS — if Hormuz throughput drops, expect +$5–12/bbl."
            )
        if "iran" in drivers and direction == "bullish":
            return (
                "Monitor OFAC statements and IAEA reports. "
                "Renewed sanctions or military escalation could remove 1.8 Mb/d. "
                "Scale into energy positions on confirmation."
            )
        if "opec" in drivers and direction == "bullish":
            return (
                "Wait for official OPEC communiqué before acting. "
                "Cuts of >500 kb/d historically push Brent +$3–8/bbl within 48h."
            )
        if "inventory" in drivers:
            if direction == "bullish":
                return (
                    "Inventory draws tighten the supply side. "
                    "EIA Wednesday release will confirm or contradict — hold until print."
                )
            return (
                "Inventory builds signal demand softness. "
                "Watch crack spreads for refinery run-cut signal."
            )
        if "russia" in drivers:
            return (
                "Track Baltic Urals discount to Brent. "
                "Shadow fleet disruption or secondary sanctions would redirect supply flows."
            )
        if "chokepoints" in drivers:
            return (
                "Check vessel AIS around Bab el-Mandeb / Suez. "
                "Rerouting via Cape of Good Hope adds ~10 days voyage time, lifting rates."
            )
        if "supply_disruption" in drivers or "asia_shortage" in drivers:
            return (
                "Regional shortages rarely move global price but can spike product spreads. "
                "Watch diesel crack and gasoil futures for confirmation."
            )
        if "macro" in drivers:
            return (
                "Dollar strength inversely correlates with oil. "
                "Monitor DXY and Fed guidance for demand outlook impact."
            )
        if direction == "bullish":
            return "Monitor for confirmation. Set price alert on Brent above next resistance."
        if direction == "bearish":
            return "Watch for demand data corroboration. Inventory prints key."
        return "No immediate action required. Track for pattern development."

    def process(
        self,
        id: str,
        title: str,
        source: str,
        url: str,
        published: str,
        summary: str,
        topic: str = "",
    ) -> ScoredArticle:
        """Full pipeline: score → tier → bias → action."""
        result = self.score(title, summary, topic)
        score  = result["score"]

        if score >= self.flash_threshold:
            tier = "flash"
        elif score >= self.analysis_threshold:
            tier = "analysis"
        elif score >= 25:
            tier = "standard"
        else:
            tier = "ignore"

        bias_label  = self._bias_label(result["direction"], score)
        action_text = self._action_text(
            result["drivers"], result["direction"], result["category"]
        )

        return ScoredArticle(
            id=id,
            title=title,
            source=source,
            url=url,
            published=published,
            summary=summary,
            score=score,
            tier=tier,
            direction=result["direction"],
            drivers=result["drivers"],
            category=result["category"],
            is_breaking=result["is_breaking"],
            bias_label=bias_label,
            action_text=action_text,
        )
