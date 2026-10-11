import fs from "node:fs";
import { Scraper, SearchMode } from "xactions/client";

const config = JSON.parse(
  fs.readFileSync("config.json", "utf8")
);

const CSV_FILE = "urls.csv";
const MAX_RESULTS = Number(config.max_results || 100);

function loadCSV() {
  const map = new Map();

  if (!fs.existsSync(CSV_FILE)) return map;

  const lines = fs.readFileSync(CSV_FILE, "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(Boolean);

  for (const line of lines.slice(1)) {
    const fields = line.split(",");
    if (fields[2]) map.set(fields[2], line);
  }

  return map;
}

function escapeCSV(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function extractURLs(text, domains) {
  const matches = text.match(/https?:\/\/[^\s<>"']+/g) || [];

  return matches
    .map(url => url.replace(/[.,!?;:、。）)】]+$/g, ""))
    .filter(url => {
      try {
        const host = new URL(url).hostname.toLowerCase();

        return domains.some(domain => {
          const d = domain.toLowerCase();
          return host === d || host.endsWith("." + d);
        });
      } catch {
        return false;
      }
    });
}

async function main() {
  const scraper = new Scraper();

  const authToken = process.env.X_AUTH_TOKEN;
  const csrfToken = process.env.X_CSRF_TOKEN;

  if (!authToken || !csrfToken) {
    throw new Error(
      "X_AUTH_TOKEN と X_CSRF_TOKEN を設定してください"
    );
  }

  await scraper.setCookies(
    `auth_token=${authToken}; ct0=${csrfToken}`
  );

  const existing = loadCSV();
  const now = new Date().toISOString();

  const query = config.domains
    .map(domain => `url:${domain}`)
    .join(" OR ");

  let count = 0;

  for await (
    const post of scraper.searchTweets(
      query,
      MAX_RESULTS,
      SearchMode.Latest
    )
  ) {
    count++;

    const text = post.text || "";
    const postedAt = post.createdAt || "";

    for (const url of extractURLs(text, config.domains)) {
      if (!existing.has(url)) {
        existing.set(
          url,
          [
            now,
            postedAt,
            url,
            text
          ].map(escapeCSV).join(",")
        );
      }
    }

    if (count >= MAX_RESULTS) break;
  }

  const rows = [
    ["collected_at", "posted_at", "url", "post_text"]
      .map(escapeCSV).join(","),
    ...[...existing.values()]
  ];

  fs.writeFileSync(
    CSV_FILE,
    "\uFEFF" + rows.join("\n") + "\n",
    "utf8"
  );

  console.log(`検索投稿数: ${count}`);
  console.log(`保存URL数: ${existing.size}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
