import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { HistoryRecord } from "@/types";

type StoredRecord = HistoryRecord & { scopeKey: string };

const dataDirectory = path.join(process.cwd(), "data");
const historyFile = path.join(dataDirectory, "showcase-history.json");
const maxHistoryRecords = 80;

function getScopeKey(request?: Request) {
  if (!request) return "local";
  const raw =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "local";
  return createHash("sha256").update(raw).digest("hex").slice(0, 20);
}

async function readStoredRecords(): Promise<StoredRecord[]> {
  try {
    const parsed = JSON.parse(await readFile(historyFile, "utf8")) as StoredRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeStoredRecords(records: StoredRecord[]) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(historyFile, `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

function toPublicRecord(storedRecord: StoredRecord): HistoryRecord {
  const record = { ...storedRecord };
  delete (record as Partial<StoredRecord>).scopeKey;
  return record;
}

export async function readHistoryRecords(request?: Request) {
  const scopeKey = getScopeKey(request);
  return (await readStoredRecords())
    .filter((record) => record.scopeKey === scopeKey)
    .slice(0, maxHistoryRecords)
    .map(toPublicRecord);
}

export async function appendHistoryRecord(
  record: Omit<HistoryRecord, "id" | "createdAt">,
  request?: Request,
) {
  const scopeKey = getScopeKey(request);
  const displayRecord: HistoryRecord = {
    ...record,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const storedRecord: StoredRecord = { ...displayRecord, scopeKey };
  const current = await readStoredRecords();
  const next: StoredRecord[] = [storedRecord];
  let visibleCount = 1;

  for (const item of current) {
    if (item.scopeKey === scopeKey) {
      if (visibleCount >= maxHistoryRecords) continue;
      visibleCount += 1;
    }
    next.push(item);
  }

  await writeStoredRecords(next);
  return displayRecord;
}

export async function deleteHistoryRecord(id: string, request?: Request) {
  const scopeKey = getScopeKey(request);
  const current = await readStoredRecords();
  const next = current.filter((record) => !(record.scopeKey === scopeKey && record.id === id));
  await writeStoredRecords(next);
  return {
    deleted: next.length !== current.length,
    records: next
      .filter((record) => record.scopeKey === scopeKey)
      .slice(0, maxHistoryRecords)
      .map(toPublicRecord),
  };
}

export async function clearHistoryRecords(request?: Request) {
  const scopeKey = getScopeKey(request);
  const next = (await readStoredRecords()).filter((record) => record.scopeKey !== scopeKey);
  await writeStoredRecords(next);
  return [];
}
