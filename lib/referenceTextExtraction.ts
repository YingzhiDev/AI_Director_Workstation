import { createRequire } from "node:module";
import { getReferenceFileExtension } from "@/lib/referenceFilePolicy";

const require = createRequire(import.meta.url);

type PdfParseResult = {
  text?: string;
};

type PdfParse = (input: Buffer) => Promise<PdfParseResult>;

type ExtractedWordDocument = {
  getBody: () => string;
  getFootnotes?: () => string;
  getEndnotes?: () => string;
  getHeaders?: () => string;
  getFooters?: () => string;
  getAnnotations?: () => string;
  getTextboxes?: () => string;
};

type WordExtractorInstance = {
  extract: (input: Buffer) => Promise<ExtractedWordDocument>;
};

type WordExtractorConstructor = new () => WordExtractorInstance;

function cleanExtractedText(text: string) {
  return text
    .replace(/\u0000/gu, "")
    .replace(/\r\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

async function extractPdfText(buffer: Buffer) {
  const parsePdf = require("pdf-parse/lib/pdf-parse.js") as PdfParse;
  const result = await parsePdf(buffer);
  return cleanExtractedText(result.text ?? "");
}

async function extractLegacyWordText(buffer: Buffer) {
  const WordExtractor = require("word-extractor") as WordExtractorConstructor;
  const document = await new WordExtractor().extract(buffer);

  return cleanExtractedText(
    [
      document.getBody(),
      document.getFootnotes?.(),
      document.getEndnotes?.(),
      document.getHeaders?.(),
      document.getFooters?.(),
      document.getAnnotations?.(),
      document.getTextboxes?.(),
    ]
      .filter(Boolean)
      .join("\n\n"),
  );
}

export async function extractReferenceDocumentText(file: File, buffer: Buffer) {
  const extension = getReferenceFileExtension(file.name);
  const mimeType = file.type.toLowerCase();

  if (extension === "pdf" || mimeType === "application/pdf") {
    return extractPdfText(buffer);
  }

  if (
    extension === "docx" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractLegacyWordText(buffer);
  }

  if (extension === "doc" || mimeType === "application/msword") {
    return extractLegacyWordText(buffer);
  }

  return cleanExtractedText(buffer.toString("utf8"));
}
