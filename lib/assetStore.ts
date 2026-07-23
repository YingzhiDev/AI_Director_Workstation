import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AssetKind, AssetRecord, PromptKind } from "@/types";

const dataDirectory = path.join(process.cwd(), "data");
const assetFile = path.join(dataDirectory, "showcase-assets.json");
const maxAssetRecords = 120;

function normalizeAssetName(name: string) {
  return name.trim().replace(/^@+/u, "").replace(/\s+/gu, "");
}

function normalizeAssetKind(value: unknown): AssetKind | undefined {
  if (value === "character" || value === "prop" || value === "scene") {
    return value;
  }
  return undefined;
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function textReferencesAsset(text: string, assetName: string) {
  return new RegExp(
    `@${escapeRegExp(assetName)}(?![\\p{L}\\p{N}_-])`,
    "u",
  ).test(text);
}

async function ensureDataDirectory() {
  await mkdir(dataDirectory, { recursive: true });
}

export async function readAssetRecords(): Promise<AssetRecord[]> {
  try {
    const parsed = JSON.parse(await readFile(assetFile, "utf8")) as AssetRecord[];
    return Array.isArray(parsed) ? parsed.slice(0, maxAssetRecords) : [];
  } catch {
    return [];
  }
}

export async function upsertAssetRecord(input: {
  name: string;
  promptText: string;
  sourcePromptKind?: PromptKind;
  assetKind?: AssetKind;
}) {
  const name = normalizeAssetName(input.name);
  const promptText = input.promptText.trim();
  const assetKind = normalizeAssetKind(input.assetKind);

  if (!name) throw new Error("Asset name is required.");
  if (!promptText) throw new Error("Asset lock text is required.");

  await ensureDataDirectory();
  const current = await readAssetRecords();
  const index = current.findIndex((asset) => asset.name === name);
  const now = new Date().toISOString();
  const asset: AssetRecord =
    index >= 0
      ? {
          ...current[index],
          promptText,
          updatedAt: now,
          sourcePromptKind: input.sourcePromptKind ?? current[index].sourcePromptKind,
          assetKind: assetKind ?? current[index].assetKind,
        }
      : {
          id: crypto.randomUUID(),
          name,
          promptText,
          createdAt: now,
          updatedAt: now,
          sourcePromptKind: input.sourcePromptKind,
          assetKind,
        };
  const next =
    index >= 0
      ? current.map((item, itemIndex) => (itemIndex === index ? asset : item))
      : [asset, ...current].slice(0, maxAssetRecords);

  await writeFile(assetFile, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return asset;
}

export async function deleteAssetRecord(id: string) {
  await ensureDataDirectory();
  const current = await readAssetRecords();
  const assets = current.filter((asset) => asset.id !== id);
  await writeFile(assetFile, `${JSON.stringify(assets, null, 2)}\n`, "utf8");
  return { deleted: assets.length !== current.length, assets };
}

export async function clearAssetRecords() {
  await ensureDataDirectory();
  await writeFile(assetFile, "[]\n", "utf8");
  return [];
}

function normalizeInlineAssetRecords(value: unknown): AssetRecord[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): AssetRecord | null => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Partial<AssetRecord>;
      const name = typeof raw.name === "string" ? normalizeAssetName(raw.name) : "";
      const promptText = typeof raw.promptText === "string" ? raw.promptText.trim() : "";
      if (!name || !promptText) return null;
      const now = new Date().toISOString();
      return {
        id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `inline-${name}`,
        name,
        promptText,
        createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
        updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now,
        sourcePromptKind: raw.sourcePromptKind,
        assetKind: normalizeAssetKind(raw.assetKind),
      };
    })
    .filter((asset): asset is AssetRecord => Boolean(asset));
}

function mergeAssetRecords(primary: AssetRecord[], secondary: AssetRecord[]) {
  const seen = new Set<string>();
  return [...primary, ...secondary].filter((asset) => {
    const key = `${asset.id}:${asset.name}`;
    if (seen.has(key) || seen.has(asset.name)) return false;
    seen.add(key);
    seen.add(asset.name);
    return true;
  });
}

export async function findReferencedAssets(input: {
  text?: string;
  assetIds?: unknown;
  assetNames?: unknown;
  referencedAssets?: unknown;
}) {
  const assets = mergeAssetRecords(
    normalizeInlineAssetRecords(input.referencedAssets),
    await readAssetRecords(),
  );
  const ids = new Set(normalizeStringList(input.assetIds));
  const names = new Set(normalizeStringList(input.assetNames).map(normalizeAssetName));
  const text = input.text ?? "";

  return assets.filter(
    (asset) => ids.has(asset.id) || names.has(asset.name) || textReferencesAsset(text, asset.name),
  );
}

export function buildReferencedAssetContext(
  assets: AssetRecord[],
  outputLanguage: "zh" | "en" = "en",
) {
  if (!assets.length) return "";

  return [
    outputLanguage === "en"
      ? "【Referenced Assets / REFERENCED ASSETS】"
      : "【已引用资产 / REFERENCED ASSETS】",
    outputLanguage === "en"
      ? "The user explicitly referenced the following assets. Preserve their names, appearance, materials, and spatial relationships; do not redesign them."
      : "下列资产由用户明确引用。请保持名称、外观、材质和空间关系连续，不要重新设计。",
    assets.map((asset) => `@${asset.name}\n${asset.promptText}`).join("\n\n"),
  ].join("\n\n");
}

function normalized(text: string) {
  return text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function expandReferencedAssetText(
  promptText: string,
  assets: AssetRecord[],
  outputLanguage: "zh" | "en" = "en",
) {
  return assets.reduce((result, asset) => {
    const assetText = asset.promptText.trim();
    if (!assetText || normalized(result).includes(normalized(assetText).slice(0, 60))) {
      return result;
    }

    const expansion =
      outputLanguage === "en"
        ? `@${asset.name}: ${assetText}`
        : `@${asset.name}：${assetText}`;
    const pattern = new RegExp(`@${escapeRegExp(asset.name)}(?![\\p{L}\\p{N}_-])`, "u");
    if (pattern.test(result)) return result.replace(pattern, expansion);

    const heading =
      /【\s*(?:资产设定|Asset Lock)\s*\/\s*ASSET LOCK\s*】/u;
    if (heading.test(result)) {
      return result.replace(heading, (value) => `${value}\n${expansion}`);
    }
    const referencedAssetsHeading =
      outputLanguage === "en"
        ? "【Referenced Assets / REFERENCED ASSETS】"
        : "【已引用资产 / REFERENCED ASSETS】";
    return `${referencedAssetsHeading}\n${expansion}\n\n${result}`;
  }, promptText);
}
