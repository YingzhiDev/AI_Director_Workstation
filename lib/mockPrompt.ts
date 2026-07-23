import type { OutputLanguage, PromptSection } from "@/types";

export const initialIdea =
  "清晨的旧书店即将关门，年轻店员在最后一位顾客留下的书中发现一封没有寄出的信。";

export const initialIdeaEn =
  "At dawn, an old bookstore is about to close when a young clerk finds an unsent letter inside the final customer's book.";

export function getInitialIdea(outputLanguage: OutputLanguage = "en") {
  return outputLanguage === "en" ? initialIdeaEn : initialIdea;
}

const sectionsZh: PromptSection[] = [
  {
    id: "style",
    index: "01",
    title: "全局风格",
    englishTitle: "STYLE LOCK",
    description: "建立可执行的摄影和情绪方向。",
    fields: [
      { label: "风格核心", value: "写实都市短片，安静、克制，保留清晨自然光与旧木材的真实质感。" },
      { label: "色彩与影调", value: "低饱和暖灰为主，窗外冷蓝晨光与室内钨丝灯形成轻微冷暖对比。" },
    ],
  },
  {
    id: "asset",
    index: "02",
    title: "资产设定",
    englishTitle: "ASSET LOCK",
    description: "锁定角色、道具和空间连续性。",
    fields: [
      { label: "主角资产", value: "二十多岁的书店店员，深色针织衫，动作谨慎，始终保持同一外观。" },
      { label: "关键道具", value: "一本磨损的精装书和一封折叠两次、未署名的旧信。" },
      { label: "场景资产", value: "狭长旧书店、半落卷帘门、木质书架、柜台和积尘的玻璃窗。" },
    ],
  },
  {
    id: "shot",
    index: "03",
    title: "画面内容",
    englishTitle: "SHOT CONTENT",
    description: "把故事转换成镜头和动作因果。",
    fields: [
      { label: "镜头计划", value: "中远景建立关店状态，跟随店员整理柜台，再推近到书页和信件的手部特写。" },
      { label: "动作链条", value: "顾客离开 → 店员合上卷帘门 → 书从柜台滑落 → 信件露出 → 店员停下阅读。" },
      { label: "收尾设计", value: "晨光落在信纸空白的署名处，店员抬头看向已经空无一人的街道。" },
    ],
  },
  {
    id: "risk",
    index: "04",
    title: "风险控制",
    englishTitle: "RISK CONTROL",
    description: "减少连续性和生成瑕疵。",
    fields: [
      { label: "统一禁止", value: "避免人物外观漂移、手指异常、信件文字乱码、过度磨皮、无意义镜头跳切。" },
    ],
  },
];

const sectionsEn: PromptSection[] = [
  {
    id: "style",
    index: "01",
    title: "Global Style",
    englishTitle: "STYLE LOCK",
    description: "Set an executable camera and emotional direction.",
    fields: [
      { label: "Style Core", value: "A restrained live-action urban short with natural dawn light and tactile aged wood." },
      { label: "Color and Tone", value: "Muted warm gray, balanced by cool blue daylight and a faint tungsten interior glow." },
    ],
  },
  {
    id: "asset",
    index: "02",
    title: "Asset Lock",
    englishTitle: "ASSET LOCK",
    description: "Keep character, prop, and location continuity stable.",
    fields: [
      { label: "Hero Asset", value: "A young bookstore clerk in a dark knit sweater, cautious in movement and consistent in appearance." },
      { label: "Key Prop", value: "A worn hardcover book and an unsigned old letter folded twice." },
      { label: "Location Asset", value: "A narrow old bookstore with wooden shelves, a counter, dusty windows, and a half-lowered shutter." },
    ],
  },
  {
    id: "shot",
    index: "03",
    title: "Shot Content",
    englishTitle: "SHOT CONTENT",
    description: "Translate story intent into camera and cause-effect action.",
    fields: [
      { label: "Shot Plan", value: "Establish the closing shop, follow the clerk tidying the counter, then move into a hand close-up as the letter appears." },
      { label: "Action Chain", value: "Customer exits → shutter lowers → book slips → letter appears → clerk stops to read." },
      { label: "Ending Beat", value: "Dawn light lands on the blank signature line as the clerk looks toward the now-empty street." },
    ],
  },
  {
    id: "risk",
    index: "04",
    title: "Risk Control",
    englishTitle: "RISK CONTROL",
    description: "Reduce continuity and generation defects.",
    fields: [
      { label: "Unified Prohibitions", value: "Avoid appearance drift, malformed hands, garbled letter text, plastic skin, and unmotivated jump cuts." },
    ],
  },
];

export function getFullPromptText(outputLanguage: OutputLanguage = "en") {
  const sections = outputLanguage === "en" ? sectionsEn : sectionsZh;
  const separator = outputLanguage === "en" ? ": " : "：";

  return sections
    .map((section) => {
      const fields = section.fields
        .map((field) => `${field.label}${separator}${field.value}`)
        .join("\n");

      return `【${section.title} / ${section.englishTitle}】\n${fields}`;
    })
    .join("\n\n");
}
