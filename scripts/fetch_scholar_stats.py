"""Fetch citation totals from Google Scholar and write them as JSON for the site.

The site reads the generated gs_data.json from the google-scholar-stats branch,
so the profile is crawled on a schedule instead of from the visitor's browser.
"""

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from scholarly import scholarly

CONFIG_PATH = Path(__file__).resolve().parent.parent / "_config.yml"


def read_scholar_id() -> str:
    config = CONFIG_PATH.read_text(encoding="utf-8")
    match = re.search(r"^google_scholar_id\s*:\s*\"?([\w-]+)\"?", config, re.MULTILINE)

    if not match:
        raise SystemExit("google_scholar_id is not set in _config.yml")

    return match.group(1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("results"))
    args = parser.parse_args()

    author = scholarly.search_author_id(read_scholar_id())
    scholarly.fill(author, sections=["basics", "indices", "counts"])

    # Section names have drifted between scholarly releases, so fall back to a
    # full profile fetch if the sectioned request came back without totals.
    if not author.get("citedby"):
        scholarly.fill(author)

    citations = int(author.get("citedby") or 0)

    # A zero total almost always means Scholar served a blocked or empty page.
    # Failing here keeps the last good numbers on the stats branch.
    if citations <= 0:
        raise SystemExit("Google Scholar returned no citation count")

    stats = {
        "name": author.get("name", ""),
        "citedby": citations,
        "citedby5y": int(author.get("citedby5y") or 0),
        "hindex": int(author.get("hindex") or 0),
        "i10index": int(author.get("i10index") or 0),
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    }

    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "gs_data.json").write_text(json.dumps(stats, indent=2) + "\n", encoding="utf-8")

    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
