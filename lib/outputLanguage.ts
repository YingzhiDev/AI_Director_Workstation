import type { OutputLanguage } from "@/types";

export function normalizeOutputLanguage(value: unknown): OutputLanguage {
  return value === "zh" ? "zh" : "en";
}

export function buildDirectorOutputLanguageInstruction(
  outputLanguage: OutputLanguage,
) {
  if (outputLanguage === "en") {
    return `
Output language: English.
Write the final prompt as polished, native, professional English for English-speaking filmmakers and AI-video users.
Use these four section headings exactly and in this order: 【Global Style / STYLE LOCK】, 【Asset Lock / ASSET LOCK】, 【Shot Content / SHOT CONTENT】, 【Risk Control / RISK CONTROL】.
The first field under 【Global Style / STYLE LOCK】 must be exactly "Style Core:".
Use natural English field labels and field values, including Style Core, Physical Realism, Visual Direction, Color and Tone, Emotional Register, Hero Asset, Camera Movement, Action Chain, Unified Prohibitions.
Do not leave Chinese prose in the final output unless the user explicitly asks for Chinese text or provides a proper noun that should remain Chinese.
Avoid translationese. Prefer concise industry terms such as anamorphic frame, focal length, depth of field, motivated light, blocking, handheld drift, parallax, continuity risk, and negative constraints when appropriate.`.trim();
  }

  return `
输出语言：中文。
最终成品请使用自然、专业、面向中文创作者的影视工业表达。
保留四个固定双语章节标题： 【全局风格 / STYLE LOCK】、【资产设定 / ASSET LOCK】、【画面内容 / SHOT CONTENT】、【负面锁定 / RISK CONTROL】。
字段名和字段内容使用中文，允许保留必要的英文摄影术语或模型通用术语。`.trim();
}

export function buildImageOutputLanguageInstruction(
  outputLanguage: OutputLanguage,
) {
  if (outputLanguage === "en") {
    return `
Output language: English.
Write the final image prompt as polished, native, professional English for English-speaking image-generation users.
Keep the two section headings exactly in this machine-readable form: 【Positive Prompt / POSITIVE PROMPT】 and 【Negative Prompt / NEGATIVE PROMPT】.
Use natural English field labels under the positive prompt: Subject and Setting, Camera and Composition, Lighting and Color, Materials and Detail, Style Constraints.
Do not leave Chinese prose in the final prompt unless the user explicitly asks for Chinese text or provides a proper noun that should remain Chinese.
Avoid translationese; write like a senior art director and cinematographer preparing a clean production prompt.`.trim();
  }

  return `
输出语言：中文。
最终成品请使用自然、专业、面向中文创作者的图片生成表达。
保留两个固定双语章节标题：【正向提示词 / POSITIVE PROMPT】与【负面提示词 / NEGATIVE PROMPT】。
字段名和字段内容使用中文，允许保留必要的英文摄影术语或模型通用术语。`.trim();
}

export function buildScreenwritingOutputLanguageInstruction(
  outputLanguage: OutputLanguage,
) {
  if (outputLanguage === "en") {
    return `
Output language: English.
Write the final result as polished, native, professional English for English-speaking screenwriters, creative directors, and script readers.
Keep the fixed bilingual section headings exactly as specified by the task.
Use English field labels, English screenplay terminology, and natural English dialogue or action description.
Do not leave Chinese prose in the final output unless the user explicitly asks for Chinese text or provides a proper noun that should remain Chinese.
Avoid translationese. The result should read like an English-first script consultant wrote it, not like a literal translation.`.trim();
  }

  return `
输出语言：中文。
最终成品请使用自然、专业、面向中文创作者和编剧的表达。
保留任务要求的固定双语章节标题，字段名和正文默认使用中文。`.trim();
}
