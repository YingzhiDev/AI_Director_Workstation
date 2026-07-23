import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const selfPath = path.join("scripts", "security-check.mjs");
const ignoredDirectories = new Set([".git", ".next", "node_modules", "data"]);
const forbiddenDirectoryNames = new Set(["knowledge", "research", ".vercel"]);
const forbiddenExtensions = new Set([".sqlite", ".sqlite3", ".jsonl", ".pem", ".key"]);
const forbiddenFileNames = new Set([".env", ".env.local", ".env.production"]);
const contentRules = [
  { label: "absolute macOS user path", pattern: /\/Users\/[A-Za-z0-9._-]+\//u },
  { label: "private source-style identifier", pattern: /SRC-[A-F0-9]{8}\b/u },
  { label: "private dataset path", pattern: /knowledge\/(?:datasets|research|overlays)\//u },
  { label: "private repository name", pattern: /GENIUS_HUANG/u },
  { label: "private product brief", pattern: /PRODUCT_BRIEF_FOR_GPT/u },
  { label: "private key block", pattern: /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/u },
  { label: "probable API key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/u },
  { label: "probable bearer token", pattern: /Bearer\s+[A-Za-z0-9._-]{30,}/u },
];

const failures = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(root, absolutePath);

    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) continue;
      if (forbiddenDirectoryNames.has(entry.name)) {
        failures.push(`${relativePath}: forbidden directory`);
        continue;
      }
      await walk(absolutePath);
      continue;
    }

    if (!entry.isFile()) continue;
    if (forbiddenFileNames.has(entry.name)) {
      failures.push(`${relativePath}: forbidden environment file`);
    }
    if (forbiddenExtensions.has(path.extname(entry.name).toLowerCase())) {
      failures.push(`${relativePath}: forbidden file type`);
    }
    if (relativePath === selfPath || entry.name === "package-lock.json") continue;

    let content;
    try {
      content = await readFile(absolutePath, "utf8");
    } catch {
      continue;
    }

    for (const rule of contentRules) {
      if (rule.pattern.test(content)) {
        failures.push(`${relativePath}: ${rule.label}`);
      }
    }
  }
}

await walk(root);

if (failures.length) {
  console.error("Security check failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Security check passed: no blocked private assets or credential patterns found.");
