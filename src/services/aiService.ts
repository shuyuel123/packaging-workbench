import type {
  WorkItem,
  AISummary,
  ParsedTodo,
  Regulation,
  AiIssue,
  AiReviewResult,
  AiDeepResult,
  DeepReviewInput,
  ImageComparison,
  ReviewInput,
  Priority,
  RegulationLibrary,
  MarketKey,
  OrderFile,
} from "../types";
import { MARKET_LABEL } from "../types";
import { uid, now } from "../lib/storage";
import { saveBlobToDB } from "../utils/storageService";

function escapeXml(s: string): string {
  return (s ?? "").replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string)
  );
}

/** 生成一张「AI 智能审核批注」SVG（作为可预览/下载的批注附件内容） */
function buildAnnotationSvg(location: string, suggestion: string, sourceName: string): string {
  const loc = escapeXml((location || "问题位置").slice(0, 40));
  const note = escapeXml((suggestion || "").slice(0, 120));
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='820' height='520'>` +
    `<rect width='820' height='520' fill='#ffffff'/>` +
    `<rect x='60' y='90' width='700' height='340' fill='#fff7e6' stroke='#fa8c16' stroke-width='2'/>` +
    `<rect x='60' y='90' width='700' height='46' fill='#fa8c16'/>` +
    `<text x='78' y='120' fill='#ffffff' font-family='Microsoft YaHei,Arial' font-size='22' font-weight='bold'>AI 智能审核批注 · ${loc}</text>` +
    `<text x='78' y='180' fill='#333333' font-family='Microsoft YaHei,Arial' font-size='18'>来源印刷件：${escapeXml(sourceName)}</text>` +
    `<text x='78' y='230' fill='#cf1322' font-family='Microsoft YaHei,Arial' font-size='18' font-weight='bold'>问题点</text>` +
    `<text x='78' y='268' fill='#333333' font-family='Microsoft YaHei,Arial' font-size='16'>${note}</text>` +
    `<text x='78' y='450' fill='#999999' font-family='Microsoft YaHei,Arial' font-size='14'>本批注由「AI智能审核」自动生成，供人工复核参考</text>` +
    `</svg>`;
  return svg;
}

/** 为每个审核问题自动生成 AI 批注附件：引用订单印刷件，保留原文件扩展名 */
export async function generateAnnotations(sourceFiles: OrderFile[], issues: AiIssue[]): Promise<AiIssue[]> {
  if (!issues.length) return issues;
  const sources = sourceFiles && sourceFiles.length ? sourceFiles : ([{ name: "原印刷件" }] as OrderFile[]);
  return Promise.all(
    issues.map(async (it, i) => {
      const src = sources[i % sources.length];
      const ext = src.name.includes(".") ? src.name.split(".").pop()!.toLowerCase() : "pdf";
      const base = src.name.replace(/\.[^.]+$/, "");
      const safeLoc = (it.location || "问题").replace(/[^\u4e00-\u9fa5A-Za-z0-9_]/g, "_").slice(0, 30);
      const name = `【AI批注·${safeLoc}】${base}.${ext}`;
      const svg = buildAnnotationSvg(it.location, it.suggestion, src.name);
      const stored = await saveBlobToDB(
        name,
        "image/svg+xml",
        new Blob([svg], { type: "image/svg+xml" }),
        "AI智能审核"
      );
      const ann: OrderFile = {
        id: stored.id,
        name,
        size: stored.size,
        type: "image/svg+xml",
        addedAt: Date.now(),
        uploadedBy: "AI智能审核",
      };
      // 去掉旧的 AI 批注，避免重复叠加，再追加新生成的批注
      const prev = (it.attachments ?? []).filter((a) => a.uploadedBy !== "AI智能审核");
      return { ...it, attachments: [...prev, ann] };
    })
  );
}

/** 若尚未生成 AI 批注则生成，避免 Remote 降级到 Mock 时重复 */
async function ensureAnnotations(sourceFiles: OrderFile[], issues: AiIssue[]): Promise<AiIssue[]> {
  if (issues.some((i) => i.attachments?.some((a) => a.uploadedBy === "AI智能审核"))) return issues;
  return generateAnnotations(sourceFiles, issues);
}

/** 把市场法规库合并为 Review 用的 Regulation（聚合该区域所有国家的认证与强制标注） */
export function regLibToRegulation(regLib: RegulationLibrary): Regulation {
  const certs = new Set<string>();
  const labels = new Set<string>();
  regLib.countries.forEach((c) => {
    c.certs.forEach((x) => certs.add(x));
    c.mandatoryLabels.forEach((x) => labels.add(x));
  });
  const region = regLib.region as MarketKey;
  return {
    id: regLib.id,
    market: region,
    marketName: MARKET_LABEL[region],
    requiredChecks: Array.from(new Set(labels)),
    certMarks: Array.from(new Set(certs)),
    warnings: [],
  };
}

/**
 * AI 服务抽象接口。
 * 后续接入真实模型（OpenAI / 自建 API）时，只需实现该接口并在
 * `getAIService` 中返回对应实例即可，上层页面无需改动。
 */
export interface AIService {
  /** 对一批碎片化条目做智能整理：生成摘要、待办、标签 */
  organize(items: WorkItem[]): Promise<AISummary>;
  /** 根据标题/内容生成建议标签 */
  suggestTags(text: string): Promise<string[]>;
  /** 把一段自由文本拆成结构化条目 */
  parseClipboard(text: string): Promise<
    Array<Pick<WorkItem, "kind" | "title" | "content" | "priority" | "tags">>
  >;
  /** 把一段自由文本解析为结构化待办（信息收集页） */
  parseTextToTodos(text: string, projectId?: string | null): Promise<ParsedTodo[]>;
  /** 对订单印刷文件做合规审核（支持多图对比 + 手动指定品牌/法规资料），返回问题清单与调用快照 */
  reviewPrintFile(input: ReviewInput): Promise<AiReviewResult>;
  /** AI 审核第二步：深度语义分析（调用大模型 API，仅用户主动点击时执行），返回问题清单 + 置信度 */
  deepReviewPrint(input: DeepReviewInput): Promise<AiDeepResult>;
}

const KEYWORDS: Record<string, string[]> = {
  urgent: ["紧急", "马上", "立刻", "尽快", "截止", "今天"],
  high: ["重要", "优先", "必须", "尽快"],
  task: ["任务", "todo", "做", "完成", "交付"],
  idea: ["想法", "灵感", "点子", "设想"],
  link: ["http", "https", ".com", ".cn", "网址", "链接"],
  note: ["笔记", "记录", "备忘"],
};

function detectPriority(text: string): Priority {
  if (KEYWORDS.urgent.some((k) => text.includes(k))) return "urgent";
  if (KEYWORDS.high.some((k) => text.includes(k))) return "high";
  return "medium";
}

function detectKind(text: string): WorkItem["kind"] {
  if (KEYWORDS.link.some((k) => text.includes(k))) return "link";
  if (KEYWORDS.idea.some((k) => text.includes(k))) return "idea";
  if (KEYWORDS.task.some((k) => text.includes(k))) return "task";
  if (KEYWORDS.note.some((k) => text.includes(k))) return "note";
  return "note";
}

/** 解析「截止：2026-08-01 / 8月1日 / 周五 / 明天」为时间戳 */
function parseDueDate(text: string, base = Date.now()): number | null {
  const dateMatch = text.match(/截止[:：]\s*(\d{4}-\d{1,2}-\d{1,2})/);
  if (dateMatch) {
    const ts = new Date(dateMatch[1]).getTime();
    return Number.isNaN(ts) ? null : ts;
  }
  const cnMatch = text.match(/截止[:：]\s*(\d{1,2})月(\d{1,2})[日号]?/);
  if (cnMatch) {
    const d = new Date();
    d.setMonth(Number(cnMatch[1]) - 1, Number(cnMatch[2]));
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (/截止[:：]?\s*明天/.test(text)) {
    const d = new Date(base);
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (/截止[:：]?\s*今天/.test(text)) {
    const d = new Date(base);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  return null;
}

function parseAssignee(text: string): string {
  const m = text.match(/(?:负责人|指派|@)\s*[:：]?\s*([^\s,，。；;]+)/);
  return m ? m[1].replace(/[@：:]/g, "") : "";
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 基于关键词的 Mock AI 实现。可离线运行，用于跑通整体交互流程。
 */
export class MockAIService implements AIService {
  async organize(items: WorkItem[]): Promise<AISummary> {
    await delay(900);
    const titles = items.map((i) => `· ${i.title}`).join("\n");
    const actionItems = items
      .filter((i) => i.status !== "done")
      .slice(0, 5)
      .map((i) => `跟进：${i.title}`);
    const tagSet = new Set<string>();
    items.forEach((i) => i.tags.forEach((t) => tagSet.add(t)));
    return {
      id: uid("ai"),
      title: `碎片整理（${items.length} 条）`,
      summary: `共整理 ${items.length} 条碎片化信息，主要主题涵盖：${
        Array.from(tagSet).slice(0, 6).join("、") || "未分类"
      }。\n\n明细：\n${titles}`,
      actionItems: actionItems.length ? actionItems : ["暂无待跟进事项"],
      tags: Array.from(tagSet).slice(0, 8),
      createdAt: now(),
      sourceIds: items.map((i) => i.id),
    };
  }

  async suggestTags(text: string): Promise<string[]> {
    await delay(300);
    const found = new Set<string>();
    if (/scf|serverless|云函数|部署/.test(text)) found.add("部署");
    if (/会议|周会|评审/.test(text)) found.add("会议");
    if (/设计|ui|界面/.test(text)) found.add("设计");
    if (/bug|异常|报错/.test(text)) found.add("问题");
    return Array.from(found).slice(0, 5);
  }

  async parseClipboard(text: string): Promise<
    Array<Pick<WorkItem, "kind" | "title" | "content" | "priority" | "tags">>
  > {
    await delay(600);
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.map((line) => ({
      kind: detectKind(line),
      title: line.length > 40 ? line.slice(0, 40) + "…" : line,
      content: line,
      priority: detectPriority(line),
      tags: [],
    }));
  }

  async parseTextToTodos(
    text: string,
    _projectId?: string | null
  ): Promise<ParsedTodo[]> {
    await delay(700);
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.map((line) => ({
      title: line.replace(/^[-*•]\s*/, "").slice(0, 60),
      assignee: parseAssignee(line),
      dueDate: parseDueDate(line),
      source: line,
      priority: detectPriority(line),
    }));
  }

  async reviewPrintFile(input: ReviewInput): Promise<AiReviewResult> {
    await delay(1100);
    const { order, regulation, brandAsset, images = [], compareImages } = input;
    const reg: Regulation =
      regulation ??
      ({
        id: "regulation_fallback",
        market: order.targetMarket,
        marketName: "未指定法规",
        requiredChecks: [],
        certMarks: [],
        warnings: [],
      } as Regulation);

    const issues: AiIssue[] = [];

    // 参数一致性
    issues.push({
      type: "param",
      location: "主展示面 / 型号与额定参数",
      suggestion: `请核对「${order.productModel}」型号、额定功率与参数卡一致，避免单位（W / BTU）混用。`,
      severity: "warn",
    });

    // 内容匹配
    issues.push({
      type: "content",
      location: "背面 / 安全与冷媒标识",
      suggestion: "安全警示（触电/冷媒可燃）与冷媒型号建议与备案参数逐条比对，缺失项需补全。",
      severity: "error",
    });

    // 法规合规
    if (reg.certMarks.length) {
      issues.push({
        type: "regulation",
        location: "认证标志区",
        suggestion: `目标市场「${reg.marketName}」建议包含认证标志：${reg.certMarks.join(
          "、"
        )}。请确认印刷稿已正确放置。`,
        severity: "error",
      });
    }
    if (reg.requiredChecks.length) {
      issues.push({
        type: "regulation",
        location: "强制标注区",
        suggestion: `必检项：${reg.requiredChecks.join("、")}。`,
        severity: "warn",
      });
    }

    // 品牌资料一致性（人工指定的品牌资产）
    if (brandAsset) {
      const colors = brandAsset.colors.map((c) => c.hex).filter(Boolean).join("、");
      issues.push({
        type: "image",
        location: "主展示面 / 品牌色",
        suggestion: brandAsset.colors.length
          ? `已引用品牌「${brandAsset.id}」标准色：${colors}。请核对印刷稿主色与品牌标准色值一致（注意屏幕 RGB 与印刷 CMYK 差异）。`
          : "已指定品牌资料，但未配置标准色值，建议补全后再核对。",
        severity: "warn",
      });
      if (brandAsset.fonts.length) {
        issues.push({
          type: "content",
          location: "品牌字体",
          suggestion: `品牌标准字体：${brandAsset.fonts.join(
            "、"
          )}。请核对印刷稿字体未 substituted。`,
          severity: "warn",
        });
      }
    }

    // 图片比对（基础）
    issues.push({
      type: "image",
      location: "主图 / 条码",
      suggestion:
        images.length > 0
          ? `已加载 ${images.length} 张图片参与审核，主展示面分辨率建议 ≥ 300dpi，条码对比度需满足扫描要求。`
          : "未上传图片，无法做图像层核对，建议上传主展示面/条码图。",
      severity: "warn",
    });

    // 多图对比
    let comparison: AiReviewResult["comparison"] | undefined;
    if (compareImages && images.length >= 2) {
      const pairs: ImageComparison[] = [];
      for (let i = 0; i < images.length - 1; i++) {
        pairs.push({
          a: `图${i + 1}`,
          b: `图${i + 2}`,
          consistent: false,
          note: "Mock 无法识别图像内容，请人工复核两张图的主展示面、品牌元素与关键色值是否一致。",
        });
      }
      comparison = {
        pairs,
        summary: `本次对比 ${images.length} 张图（共 ${pairs.length} 组），建议人工复核 ${pairs.length} 处差异点。`,
      };
    }

    const annotatedIssues = await generateAnnotations(
      order.files,
      issues.map((it) => ({
        ...it,
        source: (it.type === "image" ? "image" : "rule") as AiIssue["source"],
      }))
    );
    return {
      issues: annotatedIssues,
      comparison,
      used: {
        regulationName: reg.marketName,
        brandAssetName: brandAsset ? `品牌资产#${brandAsset.id.slice(-4)}` : undefined,
        imageCount: images.length,
      },
    };
  }

  async deepReviewPrint(input: DeepReviewInput): Promise<AiDeepResult> {
    await delay(900);
    const { order, regulation, printedText, spec } = input;
    const text = printedText.trim();
    const issues: AiIssue[] = [];
    if (!text) {
      issues.push({
        type: "content",
        location: "印刷件文字",
        suggestion: "未粘贴任何印刷件文字，深度 AI 检查无内容可分析。请先在文本框粘贴印刷稿关键文字。",
        severity: "error",
      });
    } else {
      if (spec?.coolingType && !text.toUpperCase().includes(spec.coolingType.toUpperCase().slice(0, 2))) {
        issues.push({
          type: "param",
          location: "制冷类型",
          suggestion: `参数卡标注「${spec.coolingType}」，但深度分析未在文字中确认，请人工核对。`,
          severity: "warn",
        });
      }
      if (regulation?.certMarks?.length) {
        const missing = regulation.certMarks.filter(
          (m) => !text.toUpperCase().includes(m.toUpperCase())
        );
        if (missing.length) {
          issues.push({
            type: "regulation",
            location: "认证标志",
            suggestion: `深度分析提示认证标志 ${missing.join("、")} 可能未印刷，请重点核查。`,
            severity: "error",
          });
        }
      }
    }
    return {
      issues: await generateAnnotations(
        order.files,
        issues.map((it) => ({ ...it, source: "deep" as AiIssue["source"] }))
      ),
      confidence: text ? 0.75 : 0,
      summary: text
        ? `已基于粘贴文字对订单「${order.productModel}」做语义级合规筛查，发现 ${issues.length} 项需关注点，建议结合人工判断。`
        : "无可用文字内容。",
    };
  }
}

/**
 * 真实 AI 服务：调用 OpenAI 兼容的 /chat/completions 接口。
 *
 * 安全说明：前端直连会把 API Key 暴露在浏览器中，仅适合本地/内网演示。
 * 生产环境应改为调用「后端代理」——由后端持有密钥并转发请求，前端只访问
 * 自己的域名。代理示例见仓库 scripts/ai-proxy-example.mjs。
 *
 * 任意请求失败（网络/鉴权/非 JSON 返回）都会自动降级到 MockAIService，
 * 保证上层交互永不中断。
 */
const DEFAULT_MODEL = "gpt-4o-mini";

/** 各 provider 支持的模型版本（label 展示，value 为实际接口模型名） */
export const MODEL_OPTIONS: Record<
  string,
  { value: string; label: string }[]
> = {
  deepseek: [
    { value: "deepseek-v4-flash", label: "DeepSeek-V4 Flash" },
    { value: "deepseek-v4", label: "DeepSeek-V4" },
    { value: "deepseek-chat", label: "DeepSeek-V3（deepseek-chat）" },
    { value: "deepseek-reasoner", label: "DeepSeek-R1（reasoner）" },
  ],
  openai: [
    { value: "gpt-4o-mini", label: "GPT-4o mini" },
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-5", label: "GPT-5" },
  ],
  custom: [{ value: "custom-model", label: "自定义模型（在后端指定）" }],
  mock: [{ value: "", label: "无需模型（Mock 模式）" }],
};

/** 解析某 provider 的默认模型（未手动选择时使用列表首项） */
export function getDefaultModel(provider: string): string {
  const list = MODEL_OPTIONS[provider];
  return list && list.length ? list[0].value : DEFAULT_MODEL;
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

function extractJson<T>(text: string): T {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // 容错：截取首个 { 或 [ 到末个 } 或 ]
    const start = Math.min(
      ...["{", "["].map((c) => (trimmed.includes(c) ? trimmed.indexOf(c) : Infinity))
    );
    const end = Math.max(
      ...["}", "]"].map((c) => (trimmed.includes(c) ? trimmed.lastIndexOf(c) : -Infinity))
    );
    if (start === Infinity || end === -Infinity || end <= start)
      throw new Error("无法解析 JSON 响应");
    return JSON.parse(trimmed.slice(start, end + 1)) as T;
  }
}

async function chatCompletion(
  base: string,
  apiKey: string,
  model: string,
  messages: ChatMsg[],
  jsonMode: boolean
): Promise<any> {
  const endpoint = base.replace(/\/$/, "") + "/chat/completions";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  return extractJson(content);
}

export class RemoteAIService implements AIService {
  private mock = new MockAIService();
  constructor(
    private base: string,
    private apiKey: string,
    private model: string = DEFAULT_MODEL
  ) {}

  private async safe<T>(
    label: string,
    fn: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      console.warn(`[RemoteAIService] ${label} 失败，降级 Mock：`, e);
      return fallback();
    }
  }

  async organize(items: WorkItem[]): Promise<AISummary> {
    return this.safe(
      "organize",
      async () => {
        const listing = items.map((i) => `· [${i.kind}] ${i.title}`).join("\n");
        const data = await chatCompletion(
          this.base,
          this.apiKey,
          this.model,
          [
            {
              role: "system",
              content:
                "你是工作助理。对用户给出的碎片化信息做整理，返回 JSON：{summary:string, actionItems:string[], tags:string[]}。",
            },
            { role: "user", content: `待整理信息：\n${listing}` },
          ],
          true
        );
        return {
          id: uid("ai"),
          title: `碎片整理（${items.length} 条）`,
          summary: String(data.summary ?? ""),
          actionItems: Array.isArray(data.actionItems)
            ? data.actionItems.map(String)
            : [],
          tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
          createdAt: now(),
          sourceIds: items.map((i) => i.id),
        };
      },
      () => this.mock.organize(items)
    );
  }

  async suggestTags(text: string): Promise<string[]> {
    return this.safe(
      "suggestTags",
      async () => {
        const data = await chatCompletion(
          this.base,
          this.apiKey,
          this.model,
          [
            {
              role: "system",
              content:
                "根据文本建议 1-5 个中文标签，返回 JSON：{tags:string[]}。",
            },
            { role: "user", content: text },
          ],
          true
        );
        const tags = Array.isArray(data) ? data : data.tags;
        return Array.isArray(tags) ? tags.map(String).slice(0, 5) : [];
      },
      () => this.mock.suggestTags(text)
    );
  }

  async parseClipboard(
    text: string
  ): Promise<Array<Pick<WorkItem, "kind" | "title" | "content" | "priority" | "tags">>> {
    return this.safe(
      "parseClipboard",
      async () => {
        const data = await chatCompletion(
          this.base,
          this.apiKey,
          this.model,
          [
            {
              role: "system",
              content:
                '把文本按行拆成结构化条目，返回 JSON 数组：[{kind:"note"|"task"|"link"|"idea",title,content,priority:"low"|"medium"|"high"|"urgent",tags:string[]}]。',
            },
            { role: "user", content: text },
          ],
          true
        );
        return Array.isArray(data) ? data : [];
      },
      () => this.mock.parseClipboard(text)
    );
  }

  async parseTextToTodos(_text: string, _projectId?: string | null): Promise<ParsedTodo[]> {
    return this.safe(
      "parseTextToTodos",
      async () => {
        const data = await chatCompletion(
          this.base,
          this.apiKey,
          this.model,
          [
            {
              role: "system",
              content:
                '把文本解析为待办数组，返回 JSON 数组：[{title:string, assignee:string, dueDate:string|null(ISO日期，如 2026-08-01), priority:"low"|"medium"|"high"|"urgent", source:string}]。',
            },
            { role: "user", content: _text },
          ],
          true
        );
        const arr: any[] = Array.isArray(data) ? data : [];
        return arr.map((r) => ({
          title: String(r.title ?? "").slice(0, 60),
          assignee: String(r.assignee ?? ""),
          dueDate: r.dueDate ? new Date(String(r.dueDate)).getTime() || null : null,
          source: String(r.source ?? _text),
          priority: (["low", "medium", "high", "urgent"].includes(r.priority)
            ? r.priority
            : "medium") as Priority,
        }));
      },
      () => this.mock.parseTextToTodos(_text, _projectId)
    );
  }

  async reviewPrintFile(input: ReviewInput): Promise<AiReviewResult> {
    const { order, regulation, brandAsset, images = [], compareImages } = input;
    const reg: Regulation =
      regulation ??
      ({
        id: "regulation_fallback",
        market: order.targetMarket,
        marketName: "未指定法规",
        requiredChecks: [],
        certMarks: [],
        warnings: [],
      } as Regulation);

    const result = await this.safe(
      "reviewPrintFile",
      async (): Promise<AiReviewResult> => {
        const imageParts: ContentPart[] = images
          .filter((u) => u?.startsWith("data:image"))
          .map((u) => ({ type: "image_url" as const, image_url: { url: u } }));
        const brandCtx = brandAsset
          ? `已指定品牌资料：标准色值 ${brandAsset.colors
              .map((c) => `${c.name} ${c.hex}`)
              .join("、")}；标准字体 ${brandAsset.fonts.join("、")}。请核对印刷稿与品牌标准一致。`
          : "未指定品牌资料。";
        const cmpCtx = compareImages
          ? `已上传 ${images.length} 张图片，请执行多图对比：逐组比对主展示面、品牌元素、关键色值与条码是否一致，指出差异点。`
          : "";
        const textPart: ContentPart = {
          type: "text",
          text: [
            `对包装印刷文件做合规审核。订单型号：${order.productModel}，目标市场：${reg.marketName}。`,
            `该市场必检项：${reg.requiredChecks.join("、") || "无"}`,
            `认证标志要求：${reg.certMarks.join("、") || "无"}`,
            `品牌资料：${brandCtx}`,
            cmpCtx,
            `返回 JSON 对象：{issues:[{type:"param"|"content"|"regulation"|"image", location:string, suggestion:string, severity:"error"|"warn"}], comparison?:{pairs:[{a:string,b:string,consistent:boolean,note:string}], summary:string}}。`,
          ].join("\n"),
        };
        const content: ContentPart[] = imageParts.length
          ? [textPart, ...imageParts]
          : [textPart];
        const data = await chatCompletion(
          this.base,
          this.apiKey,
          this.model,
          [
            {
              role: "system",
              content:
                "你是包装合规审核专家，依据法规库与品牌资料逐条检查并给出问题清单；如提供多图则执行对比。",
            },
            { role: "user", content },
          ],
          true
        );
        const arr: any[] = Array.isArray(data?.issues) ? data.issues : [];
        const comparison = data?.comparison
          ? {
              pairs: (Array.isArray(data.comparison.pairs)
                ? data.comparison.pairs
                : []
              ).map((p: any) => ({
                a: String(p.a ?? ""),
                b: String(p.b ?? ""),
                consistent: Boolean(p.consistent),
                note: String(p.note ?? ""),
              })),
              summary: String(data.comparison.summary ?? ""),
            }
          : undefined;
        return {
          issues: arr.map((r) => ({
            type: (["param", "content", "regulation", "image"].includes(r.type)
              ? r.type
              : "content") as AiIssue["type"],
            location: String(r.location ?? ""),
            suggestion: String(r.suggestion ?? ""),
            severity: (r.severity === "error" ? "error" : "warn") as AiIssue["severity"],
          })),
          comparison,
          used: {
            regulationName: reg.marketName,
            brandAssetName: brandAsset
              ? `品牌资产#${brandAsset.id.slice(-4)}`
              : undefined,
            imageCount: images.length,
          },
        };
      },
      () => this.mock.reviewPrintFile(input)
    );
    return { ...result, issues: await ensureAnnotations(order.files, result.issues) };
  }

  async deepReviewPrint(input: DeepReviewInput): Promise<AiDeepResult> {
    const { order, regulation, printedText, spec } = input;
    const result = await this.safe(
      "deepReviewPrint",
      async (): Promise<AiDeepResult> => {
        const regCtx = regulation
          ? `目标市场：${regulation.marketName}；必检项：${regulation.requiredChecks.join(
              "、"
            ) || "无"}；认证标志：${regulation.certMarks.join("、") || "无"}。`
          : "未关联法规库。";
        const specCtx = spec
          ? `基准参数卡：制冷类型 ${spec.coolingType || "未填"}；频率 ${
              spec.frequency || "未填"
            }；电压 ${spec.voltage || "未填"}；冷媒 ${spec.refrigerant || "未填"}。`
          : "未填写基准参数卡。";
        const data = await chatCompletion(
          this.base,
          this.apiKey,
          this.model,
          [
            {
              role: "system",
              content:
                "你是包装合规审核专家，对用户粘贴的印刷件文字做语义级合规分析，结合市场法规与基准参数卡指出风险，返回 JSON：{issues:[{type,location,suggestion,severity}], confidence:number(0~1), summary:string}。",
            },
            {
              role: "user",
              content: [
                `订单型号：${order.productModel}。`,
                regCtx,
                specCtx,
                `请分析以下印刷件文字：\n"""\n${printedText}\n"""`,
              ].join("\n"),
            },
          ],
          true
        );
        const arr: any[] = Array.isArray(data?.issues) ? data.issues : [];
        return {
          issues: arr.map((r) => ({
            type: (["param", "content", "regulation", "image"].includes(r.type)
              ? r.type
              : "content") as AiIssue["type"],
            location: String(r.location ?? ""),
            suggestion: String(r.suggestion ?? ""),
            severity: (r.severity === "error" ? "error" : "warn") as AiIssue["severity"],
          })),
          confidence:
            typeof data?.confidence === "number"
              ? Math.min(1, Math.max(0, data.confidence))
              : 0.7,
          summary: String(data?.summary ?? "深度分析完成。"),
        };
      },
      () => this.mock.deepReviewPrint(input)
    );
    return { ...result, issues: await ensureAnnotations(order.files, result.issues) };
  }
}

export function getAIService(
  provider: string,
  apiKey: string,
  apiBase: string,
  model?: string
): AIService {
  if (provider === "mock" || !apiKey) return new MockAIService();
  // openai 走官方域名；deepseek 走官方 API；custom 默认指向本地 AI 代理（scripts/ai-proxy.mjs）
  let base: string;
  let resolvedModel = model || getDefaultModel(provider);
  if (provider === "openai") {
    base = apiBase || "https://api.openai.com/v1";
  } else if (provider === "deepseek") {
    base = apiBase || "https://api.deepseek.com/v1";
  } else {
    base = apiBase || "http://localhost:8787/v1";
  }
  return new RemoteAIService(base, apiKey, resolvedModel);
}
