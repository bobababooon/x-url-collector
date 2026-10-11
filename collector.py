import csv
import json
import re
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlparse

CONFIG_FILE = Path("config.json")
CSV_FILE = Path("urls.csv")


def load_config():
    with CONFIG_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_existing():
    existing = {}

    if not CSV_FILE.exists():
        return existing

    with CSV_FILE.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)

        for row in reader:
            url = row.get("url", "")
            if url:
                existing[url] = row

    return existing


def extract_urls(text, domains):
    pattern = r'https?://[^\s<>"\'）)】]+'
    candidates = re.findall(pattern, text)

    results = []

    for url in candidates:
        url = url.rstrip(".,!?;:、。")

        try:
            parsed = urlparse(url)
            host = (parsed.hostname or "").lower()

            if any(
                host == domain.lower()
                or host.endswith("." + domain.lower())
                for domain in domains
            ):
                results.append(url)

        except ValueError:
            continue

    return results


def main():
    config = load_config()
    domains = config["domains"]
    existing = load_existing()

    # 現段階では、Xからの投稿取得機能は未実装。
    # まずURLの抽出・保存機能を用意する。
    posts = []

    for post in posts:
        urls = extract_urls(post["text"], domains)

        for url in urls:
            if url not in existing:
                existing[url] = {
                    "collected_at": datetime.now(timezone.utc).isoformat(),
                    "posted_at": post.get("posted_at", ""),
                    "url": url,
                    "post_text": post["text"],
                }

    rows = list(existing.values())
    rows.sort(
        key=lambda row: row.get("posted_at", ""),
        reverse=True,
    )

    with CSV_FILE.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "collected_at",
                "posted_at",
                "url",
                "post_text",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"保存済みURL数: {len(rows)}")


if __name__ == "__main__":
    main()