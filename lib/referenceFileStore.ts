import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getReferenceFileExtension,
  getReferenceFileKind,
  isAllowedReferenceDocument,
  isAllowedReferenceImage,
  maxReferenceDocumentSizeBytes,
  maxReferenceFiles,
  maxReferenceImageSizeBytes,
  maxReferenceTextPreviewChars,
} from "@/lib/referenceFilePolicy";
import { extractReferenceDocumentText } from "@/lib/referenceTextExtraction";
import type { ReferenceAttachment, ReferenceAttachmentKind } from "@/types";

type StoredReference = {
  id: string;
  name: string;
  kind: ReferenceAttachmentKind;
  mimeType: string;
  size: number;
  storagePath: string;
  textPreview: string;
};

const dataDirectory = path.join(process.cwd(), "data");
const referenceDirectory = path.join(dataDirectory, "reference-files");
const metadataFile = path.join(dataDirectory, "showcase-reference-files.json");

function sanitizeFileName(name: string) {
  return (
    name
      .trim()
      .replace(/[\\/:*?"<>|\u0000-\u001f]/gu, "-")
      .replace(/\s+/gu, "-")
      .slice(0, 120) || "reference-file"
  );
}

function inferKind(file: File): ReferenceAttachmentKind {
  return getReferenceFileKind(file) === "image" ? "image" : "document";
}

function assertAllowed(file: File) {
  if (!isAllowedReferenceImage(file) && !isAllowedReferenceDocument(file)) {
    throw new Error(`${file.name} has an unsupported file type.`);
  }
  if (isAllowedReferenceImage(file) && file.size > maxReferenceImageSizeBytes) {
    throw new Error(`${file.name} exceeds 8 MB.`);
  }
  if (isAllowedReferenceDocument(file) && file.size > maxReferenceDocumentSizeBytes) {
    throw new Error(`${file.name} exceeds 4 MB.`);
  }
}

async function readMetadata(): Promise<StoredReference[]> {
  try {
    const parsed = JSON.parse(await readFile(metadataFile, "utf8")) as StoredReference[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeMetadata(records: StoredReference[]) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(metadataFile, `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

function toAttachment(record: StoredReference): ReferenceAttachment {
  return {
    id: record.id,
    name: record.name,
    kind: record.kind,
    mimeType: record.mimeType,
    size: record.size,
    textPreview: record.textPreview,
    storageProvider: "local",
    storagePath: record.storagePath,
  };
}

export async function saveReferenceFiles(files: File[]) {
  await mkdir(referenceDirectory, { recursive: true });
  const current = await readMetadata();
  const created: StoredReference[] = [];

  for (const file of files.slice(0, maxReferenceFiles)) {
    assertAllowed(file);
    const id = crypto.randomUUID();
    const buffer = Buffer.from(await file.arrayBuffer());
    const kind = inferKind(file);
    const textPreview =
      kind === "document"
        ? (await extractReferenceDocumentText(file, buffer))
            .trim()
            .slice(0, maxReferenceTextPreviewChars)
        : "";
    const storagePath = `${id}-${sanitizeFileName(file.name)}`;

    await writeFile(path.join(referenceDirectory, storagePath), buffer);
    created.push({
      id,
      name: file.name,
      kind,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      storagePath,
      textPreview,
    });
  }

  await writeMetadata([...created, ...current].slice(0, 240));
  return created.map(toAttachment);
}

function resolveStoredPath(storagePath: string) {
  const root = path.resolve(referenceDirectory);
  const resolved = path.resolve(referenceDirectory, storagePath);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid reference file path.");
  }
  return resolved;
}

export async function deleteReferenceFile(id: string) {
  const current = await readMetadata();
  const target = current.find((record) => record.id === id.trim());
  if (!target) return false;
  await rm(resolveStoredPath(target.storagePath), { force: true });
  await writeMetadata(current.filter((record) => record.id !== target.id));
  return true;
}

function getImageMimeType(attachment: ReferenceAttachment) {
  const mimeType = attachment.mimeType.toLowerCase();
  if (["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    return mimeType;
  }
  const extension = getReferenceFileExtension(attachment.name);
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

export async function readReferenceAttachmentAsDataUrl(
  attachment: ReferenceAttachment,
) {
  if (attachment.kind !== "image" || !attachment.storagePath) return null;
  const buffer = await readFile(resolveStoredPath(attachment.storagePath));
  return `data:${getImageMimeType(attachment)};base64,${buffer.toString("base64")}`;
}
