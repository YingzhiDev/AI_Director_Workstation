import {
  buildReferenceAttachmentContext,
  sanitizeReferenceAttachments,
} from "@/lib/referenceAttachments";
import { requestChatCompletion, resolveApiConfig } from "@/lib/llmClient";
import { readReferenceAttachmentAsDataUrl } from "@/lib/referenceFileStore";
import type { OutputLanguage, ReferenceAttachment } from "@/types";

const maxAnalyzedImages = 6;
const IMAGE_ANALYSIS_TIMEOUT_MS = 90_000;

type ResolvedConfig = ReturnType<typeof resolveApiConfig>;

type ReferenceAnalysisOptions = {
  attachments: ReferenceAttachment[];
  config: ResolvedConfig;
  userInstruction: string;
  workflow: "director" | "image" | "screenwriting";
  outputLanguage: OutputLanguage;
};

function getWorkflowLabel(
  workflow: ReferenceAnalysisOptions["workflow"],
  outputLanguage: OutputLanguage,
) {
  if (outputLanguage === "en") {
    if (workflow === "image") return "image-prompt";
    if (workflow === "screenwriting") return "screenwriting";
    return "video-prompt";
  }

  if (workflow === "image") return "图片提示词";
  if (workflow === "screenwriting") return "剧本";
  return "视频提示词";
}

async function buildImageContentParts(
  attachments: ReferenceAttachment[],
  userInstruction: string,
  workflow: ReferenceAnalysisOptions["workflow"],
  outputLanguage: OutputLanguage,
) {
  const imageAttachments = attachments
    .filter((attachment) => attachment.kind === "image")
    .slice(0, maxAnalyzedImages);

  if (!imageAttachments.length) return null;

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text:
        outputLanguage === "en"
          ? [
              `Analyze the uploaded reference images for a ${getWorkflowLabel(workflow, outputLanguage)} generation workflow.`,
              "The user's text may be a prompt, a rough idea, or an instruction. Infer what visual information is useful for the requested output, but do not invent details that are not visible.",
              "Return a concise structured visual analysis in English. Cover visible subject, setting, composition, camera/lens clues, lighting, color palette, texture/material cues, mood, continuity anchors, and negative/risk constraints.",
              "Do not identify copyrighted source titles or actors. Do not write the final prompt. Only provide reference analysis that can be fed into a prompt pipeline.",
              `User instruction: ${userInstruction || "(empty)"}`,
            ].join("\n")
          : [
              `请分析用户上传的参考图片，用于后续生成${getWorkflowLabel(workflow, outputLanguage)}。`,
              "用户输入可能是提示词本身，也可能是粗略想法或指令。请判断哪些可见视觉信息对本次输出有用，但不要编造图片里没有的细节。",
              "请用精炼结构化中文输出视觉识别摘要，覆盖：可见主体、场景环境、构图、镜头/焦段线索、光影、色彩、材质纹理、情绪气质、连续性锚点、负面/风险约束。",
              "不要识别受版权保护的片名、演员姓名或来源；不要直接写最终提示词，只输出可送入提示词 pipeline 的参考分析。",
              `用户输入：${userInstruction || "（空）"}`,
            ].join("\n"),
    },
  ];

  for (const [index, attachment] of imageAttachments.entries()) {
    const dataUrl = await readReferenceAttachmentAsDataUrl(attachment);
    if (!dataUrl) continue;

    content.push({
      type: "text",
      text: `Reference image ${index + 1}: ${attachment.name}`,
    });
    content.push({ type: "image_url", image_url: { url: dataUrl } });
  }

  return content.length > 1 ? content : null;
}

async function analyzeReferenceImages({
  attachments,
  config,
  userInstruction,
  workflow,
  outputLanguage,
}: ReferenceAnalysisOptions) {
  const content = await buildImageContentParts(
    attachments,
    userInstruction,
    workflow,
    outputLanguage,
  );

  if (!content) return "";

  try {
    return await requestChatCompletion({
      config,
      messages: [
        {
          role: "system",
          content:
            outputLanguage === "en"
              ? "You are a precise visual reference analyst for professional AI prompt pipelines."
              : "你是专业 AI 提示词 pipeline 的视觉参考分析师，负责把图片内容转成可靠的文字参考。",
        },
        { role: "user", content },
      ],
      maxTokens: outputLanguage === "en" ? 1_600 : 1_400,
      timeoutMs: IMAGE_ANALYSIS_TIMEOUT_MS,
      temperature: 0.2,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown model error";
    throw new Error(`Reference image analysis failed: ${message}`);
  }
}

export async function buildResolvedReferenceAttachmentContext(
  options: ReferenceAnalysisOptions,
) {
  const attachments = sanitizeReferenceAttachments(options.attachments);
  const visualAnalysis = await analyzeReferenceImages({
    ...options,
    attachments,
  });

  return buildReferenceAttachmentContext(attachments, {
    visualAnalysis,
    outputLanguage: options.outputLanguage,
  });
}
