import type { ReferenceAttachment } from "@/types";

const maxAttachments = 8;
const maxPreviewChars = 12_000;

function normalizeAttachmentKind(value: unknown): ReferenceAttachment["kind"] {
  if (
    value === "text" ||
    value === "code" ||
    value === "image" ||
    value === "video" ||
    value === "document" ||
    value === "other"
  ) {
    return value;
  }

  return "other";
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";

  return value
    .replace(/\u0000/gu, "")
    .replace(/\r\n/gu, "\n")
    .trim()
    .slice(0, maxPreviewChars);
}

export function sanitizeReferenceAttachments(
  attachments: unknown,
): ReferenceAttachment[] {
  if (!Array.isArray(attachments)) return [];

  return attachments
    .reduce<ReferenceAttachment[]>((result, attachment) => {
      const value = attachment as Partial<ReferenceAttachment>;
      const name = typeof value.name === "string" ? value.name.trim() : "";
      if (!name) return result;

      result.push({
        id:
          typeof value.id === "string" && value.id.trim()
            ? value.id.trim().slice(0, 80)
            : crypto.randomUUID(),
        name: name.slice(0, 180),
        kind: normalizeAttachmentKind(value.kind),
        mimeType:
          typeof value.mimeType === "string"
            ? value.mimeType.trim().slice(0, 120)
            : "",
        size:
          typeof value.size === "number" && Number.isFinite(value.size)
            ? Math.max(0, Math.round(value.size))
            : 0,
        textPreview: cleanText(value.textPreview),
        storageProvider:
          value.storageProvider === "local" || value.storageProvider === "supabase"
            ? value.storageProvider
            : undefined,
        storageBucket:
          typeof value.storageBucket === "string"
            ? value.storageBucket.trim().slice(0, 160)
            : undefined,
        storagePath:
          typeof value.storagePath === "string"
            ? value.storagePath.trim().slice(0, 500)
            : undefined,
      });
      return result;
    }, [])
    .slice(0, maxAttachments);
}

export function buildReferenceAttachmentContext(
  attachments: ReferenceAttachment[],
  options: {
    visualAnalysis?: string;
    outputLanguage?: "zh" | "en";
  } = {},
) {
  const sanitized = sanitizeReferenceAttachments(attachments);
  if (!sanitized.length) return "";

  const visualAnalysis = cleanText(options.visualAnalysis);
  const isEnglish = options.outputLanguage === "en";

  return [
    isEnglish
      ? "【Reference Attachments / REFERENCE ATTACHMENTS】"
      : "【上传参考材料 / REFERENCE ATTACHMENTS】",
    isEnglish
      ? "The user uploaded reference materials. Use extracted document text and visual analysis as reference context. Do not invent details that are not present in the provided material."
      : "用户上传了以下参考材料。生成时默认参考这些材料：文本文档按摘录内容吸收；图片按视觉识别摘要吸收。不得捏造未提供的画面细节。",
    visualAnalysis
      ? [
          isEnglish
            ? "【Reference Image Visual Analysis】"
            : "【参考图片视觉识别摘要】",
          visualAnalysis,
        ].join("\n")
      : "",
    sanitized
      .map((attachment, index) => {
        const sizeKb = Math.round(attachment.size / 1024);
        if (isEnglish) {
          return [
            `${index + 1}. ${attachment.name}`,
            `Type: ${attachment.kind} / ${attachment.mimeType || "unknown"} / ${sizeKb} KB`,
            "Storage: used only for this showcase workflow; the server path is never sent to the model.",
            attachment.textPreview
              ? `Extracted content:\n${attachment.textPreview}`
              : attachment.kind === "image"
                ? "Extracted content: image reference; use the visual analysis above."
                : "Extracted content: no text could be read from this format; use metadata only.",
          ].join("\n");
        }

        return [
          `${index + 1}. ${attachment.name}`,
          `类型：${attachment.kind} / ${attachment.mimeType || "unknown"} / ${sizeKb} KB`,
          "存储：仅用于本次展示工作流，不向模型提供服务器路径。",
          attachment.textPreview
            ? `内容摘录：\n${attachment.textPreview}`
            : attachment.kind === "image"
              ? "内容摘录：图片材料，以上方视觉识别摘要为准。"
              : "内容摘录：该格式未能读取文本，只按参考素材元信息处理。",
        ].join("\n");
      })
      .join("\n\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
}
