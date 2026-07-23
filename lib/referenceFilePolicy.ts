export const allowedImageExtensions = ["jpg", "jpeg", "png", "webp"] as const;
export const allowedDocumentExtensions = [
  "txt",
  "md",
  "markdown",
  "pdf",
  "doc",
  "docx",
  "csv",
  "tsv",
  "json",
  "xml",
  "srt",
  "vtt",
  "log",
  "fountain",
] as const;

export const allowedImageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const allowedDocumentMimeTypes = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/tab-separated-values",
  "text/xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/json",
  "application/xml",
] as const;

export const maxReferenceFiles = 8;
export const maxReferenceImageSizeBytes = 8 * 1024 * 1024;
export const maxReferenceDocumentSizeBytes = 4 * 1024 * 1024;
export const maxReferenceTextPreviewChars = 12_000;

type ReferenceWorkspaceMode = "director" | "screenwriting";

type FileLike = {
  name: string;
  type?: string;
  size?: number;
};

export function getReferenceFileExtension(name: string) {
  const match = /\.([a-z0-9]+)$/iu.exec(name);
  return match?.[1]?.toLowerCase() ?? "";
}

export function isAllowedReferenceImage(file: FileLike) {
  const extension = getReferenceFileExtension(file.name);
  const mimeType = file.type?.toLowerCase() ?? "";

  return (
    allowedImageExtensions.includes(
      extension as (typeof allowedImageExtensions)[number],
    ) ||
    allowedImageMimeTypes.includes(
      mimeType as (typeof allowedImageMimeTypes)[number],
    )
  );
}

export function isAllowedReferenceDocument(file: FileLike) {
  const extension = getReferenceFileExtension(file.name);
  const mimeType = file.type?.toLowerCase() ?? "";

  return (
    allowedDocumentExtensions.includes(
      extension as (typeof allowedDocumentExtensions)[number],
    ) ||
    allowedDocumentMimeTypes.includes(
      mimeType as (typeof allowedDocumentMimeTypes)[number],
    )
  );
}

export function getReferenceFileKind(file: FileLike) {
  if (isAllowedReferenceImage(file)) return "image";
  if (isAllowedReferenceDocument(file)) return "document";
  return "unsupported";
}

export function isReferenceFileAllowedForWorkspace(
  file: FileLike,
  workspaceMode: ReferenceWorkspaceMode,
) {
  if (workspaceMode === "screenwriting") {
    return isAllowedReferenceDocument(file);
  }

  return isAllowedReferenceImage(file) || isAllowedReferenceDocument(file);
}

export function getReferenceAcceptForWorkspace(
  workspaceMode: ReferenceWorkspaceMode,
) {
  const documentAccept = allowedDocumentExtensions.map((ext) => `.${ext}`);

  if (workspaceMode === "screenwriting") {
    return documentAccept.join(",");
  }

  return [
    ...allowedImageExtensions.map((ext) => `.${ext}`),
    ...documentAccept,
  ].join(",");
}

export function getReferenceFormatLabel(
  workspaceMode: ReferenceWorkspaceMode,
  language: "zh" | "en" = "en",
) {
  const images = "JPG/JPEG, PNG, WebP";
  const documents =
    "TXT, MD, PDF, DOC/DOCX, CSV, TSV, JSON, XML, SRT, VTT, LOG, Fountain";

  if (language === "en") {
    return workspaceMode === "screenwriting"
      ? `Supported documents: ${documents}. Video, image, and other unsupported file types are blocked.`
      : `Supported images: ${images}. Supported documents: ${documents}. Video and other unsupported file types are blocked.`;
  }

  return workspaceMode === "screenwriting"
    ? `支持文本文档：${documents}。禁止上传视频、图片和其他不支持的格式。`
    : `支持图片：${images}；支持文本文档：${documents}。禁止上传视频和其他不支持的格式。`;
}
