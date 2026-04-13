"""
verify.py — OilSentinel verification script.
Tests the AnalysisEngine on canonical oil market headlines.
"""
from analysis import AnalysisEngine

engine = AnalysisEngine(flash_threshold=75, analysis_threshold=50)

TEST_CASES = [
    {
        "label":        "Hormuz closure after military strike",
        "title":        "Breaking: Iran IRGC closes Strait of Hormuz after US military airstrike on nuclear sites",
        "summary":      "Iranian naval forces have announced an immediate closure of the Strait of Hormuz "
                        "following a US military strike. Tanker traffic halted. Brent spiking.",
        "topic":        "iran_conflict",
        "expect_tier":  "flash",
        "expect_dir":   "bullish",
        "min_score":    75,
    },
    {
        "label":        "OPEC+ production cut",
        "title":        "OPEC+ agrees surprise 1 Mb/d production cut effective next quarter",
        "summary":      "Saudi Arabia and Russia led an emergency OPEC+ decision to cut output by 1 million "
                        "barrels per day. The quota reduction will be enforced from January. Brent jumped 4%.",
        "topic":        "opec",
        "expect_tier":  "flash",
        "expect_dir":   "bullish",
        "min_score":    60,
    },
    {
        "label":        "EIA inventory draw",
        "title":        "EIA reports surprise 5.2 Mb crude draw — largest in three months",
        "summary":      "The US Energy Information Administration weekly petroleum status report showed a "
                        "5.2 million barrel crude oil stockpile draw, well above the 1.1 Mb consensus estimate.",
        "topic":        "inventory",
        "expect_tier":  "analysis",
        "expect_dir":   "bullish",
        "min_score":    50,
    },
    {
        "label":        "Irrelevant — solar farm approval",
        "title":        "California approves new 200 MW solar farm in Mojave Desert",
        "summary":      "State regulators have approved construction of a 200 megawatt solar photovoltaic "
                        "installation in the Mojave Desert. The project will power 60,000 homes.",
        "topic":        "",
        "expect_tier":  "ignore",
        "expect_dir":   "neutral",
        "min_score":    0,
        "max_score":    35,
    },
    {
        "label":        "Red Sea tanker attack",
        "title":        "Houthi missile strikes VLCC tanker in Red Sea — crew evacuated",
        "summary":      "A Very Large Crude Carrier was struck by a ballistic missile fired from Yemen. "
                        "The vessel is afire. Multiple shipping companies suspending Suez Canal transits.",
        "topic":        "chokepoints",
        "expect_tier":  "flash",
        "expect_dir":   "bullish",
        "min_score":    70,
    },
    {
        "label":        "Russia sanctions tightening",
        "title":        "US Treasury imposes secondary sanctions on Russian oil shadow fleet — 30 vessels designated",
        "summary":      "OFAC designated 30 tankers in Russia's shadow fleet, restricting their access to "
                        "port services globally. Russian Urals exports to India and China could be disrupted.",
        "topic":        "sanctions",
        "expect_tier":  "flash",
        "expect_dir":   "bullish",
        "min_score":    65,
    },
    {
        "label":        "Inventory build / bearish",
        "title":        "EIA reports surprise 8 Mb crude build — largest since COVID era",
        "summary":      "US crude inventories built by 8 million barrels last week, far above the 1 Mb "
                        "consensus. Cushing storage rising. Demand signals weak ahead of winter.",
        "topic":        "inventory",
        "expect_tier":  "analysis",
        "expect_dir":   "bearish",
        "min_score":    50,
    },
]

PASS = "✅"
FAIL = "❌"
WARN = "⚠️"


def run_verification() -> bool:
    print("\n" + "=" * 60)
    print("  OilSentinel v3.0 — Analysis Engine Verification")
    print("=" * 60)

    all_passed = True

    for tc in TEST_CASES:
        scored = engine.process(
            id=tc["label"].replace(" ", "_"),
            title=tc["title"],
            source="TEST",
            url="",
            published="",
            summary=tc["summary"],
            topic=tc["topic"],
        )

        checks = []

        # Tier check
        if scored.tier == tc["expect_tier"]:
            checks.append(f"{PASS} Tier: {scored.tier}")
        else:
            checks.append(f"{FAIL} Tier: got {scored.tier}, expected {tc['expect_tier']}")
            all_passed = False

        # Direction check
        if scored.direction == tc["expect_dir"] or tc["expect_dir"] == "any":
            checks.append(f"{PASS} Direction: {scored.direction}")
        else:
            checks.append(f"{WARN} Direction: got {scored.direction}, expected {tc['expect_dir']}")

        # Score bounds
        min_s = tc.get("min_score", 0)
        max_s = tc.get("max_score", 100)
        if min_s <= scored.score <= max_s:
            checks.append(f"{PASS} Score: {scored.score} (in [{min_s},{max_s}])")
        else:
            checks.append(f"{FAIL} Score: {scored.score} (expected [{min_s},{max_s}])")
            all_passed = False

        # Print result
        print(f"\n─ {tc['label']}")
        for c in checks:
            print(f"  {c}")
        print(f"  Drivers: {scored.drivers[:4]}")
        print(f"  Bias:    {scored.bias_label}")
        print(f"  Action:  {scored.action_text[:80]}…")

    print("\n" + "=" * 60)
    if all_passed:
        print(f"{PASS} All verification checks passed.")
    else:
        print(f"{FAIL} Some checks failed — review above.")
    print("=" * 60 + "\n")

    return all_passed


if __name__ == "__main__":
    import sys
    ok = run_verification()
    sys.exit(0 if ok else 1)
