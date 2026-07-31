// ---------- 通用 ----------
export type Priority = "low" | "medium" | "high" | "urgent";
export type Status = "todo" | "doing" | "done" | "archived";
export type ItemKind = "note" | "task" | "link" | "idea" | "file";

/** 角色与权限：管理员 / 编辑者 / 查看者 */
export type Role = "admin" | "editor" | "viewer";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "管理员",
  editor: "编辑者",
  viewer: "查看者",
};

// ---------- 工作条目（待办 / 碎片） ----------
export interface WorkItem {
  id: string;
  kind: ItemKind;
  title: string;
  content: string;
  tags: string[];
  priority: Priority;
  status: Status;
  projectId: string | null;
  /** 截止日期（时间戳），用于「今日待办」「逾期」统计 */
  dueDate: number | null;
  createdAt: number;
  updatedAt: number;
  doneAt: number | null;
  // 来源标记：inbox=未归类碎片，project=已归入项目
  source: "inbox" | "project";
  /** 关联订单 id（审核待办用） */
  orderRef?: string;
}

// ---------- 项目 ----------
export interface Project {
  id: string;
  name: string;
  description: string;
  /** 项目阶段 */
  stage: string;
  /** 负责人 */
  owner: string;
  /** 截止日期（时间戳） */
  dueDate: number | null;
  color: string;
  /** 阶段划分（用于详情页时间线） */
  phases: { name: string; start: number; end: number }[];
  createdAt: number;
  updatedAt: number;
}

// ---------- AI 整理 ----------
export interface AISummary {
  id: string;
  title: string;
  summary: string;
  actionItems: string[];
  tags: string[];
  createdAt: number;
  // 关联的源条目 id（整理后可由用户选择归档/创建任务）
  sourceIds: string[];
}

// ---------- 信息收集：历史记录 ----------
export interface Collection {
  id: string;
  text: string;
  projectId: string | null;
  todos: ParsedTodo[];
  createdAt: number;
}

// ---------- 包装物料：市场与订单 ----------
export type MarketKey =
  | "north_america"
  | "latin_america"
  | "europe_oceania"
  | "middle_east_africa"
  | "southeast_asia"
  | "china";

export const MARKET_LABEL: Record<MarketKey, string> = {
  north_america: "北美",
  latin_america: "中南美非",
  europe_oceania: "欧澳",
  middle_east_africa: "中东非",
  southeast_asia: "东南亚",
  china: "中国",
};

/** 订单 12 状态流程 */
export type OrderStatus =
  | "pending_info"
  | "sent_waiting"
  | "received"
  | "ai_review"
  | "manual_review"
  | "feedback"
  | "customer_fixed"
  | "approved"
  | "standard_fig"
  | "sent_supplier"
  | "sample_confirm"
  | "closed";

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "pending_info",
  "sent_waiting",
  "received",
  "ai_review",
  "manual_review",
  "feedback",
  "customer_fixed",
  "approved",
  "standard_fig",
  "sent_supplier",
  "sample_confirm",
  "closed",
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_info: "待收资料",
  sent_waiting: "已发待回传",
  received: "已收到文件",
  ai_review: "AI 审核中",
  manual_review: "人工复核",
  feedback: "反馈客户",
  customer_fixed: "客户已修改",
  approved: "已通过",
  standard_fig: "标准制版",
  sent_supplier: "已发工厂",
  sample_confirm: "样品确认",
  closed: "已结案",
};

export interface Customer {
  id: string;
  name: string;
  contact: string;
  market: MarketKey;
  note: string;
  createdAt: number;
  updatedAt: number;
}

/** 产品品类：本工作台聚焦的家电类型 */
export type ProductCategory = "split_ac" | "portable_ac" | "dehumidifier" | "other";

export const PRODUCT_CATEGORY_LABEL: Record<ProductCategory, string> = {
  split_ac: "分体空调",
  portable_ac: "移动空调",
  dehumidifier: "除湿机",
  other: "其他",
};

/** 订单关联的印刷文件（支持真实上传与内联预览） */
export interface OrderFile {
  id: string;
  name: string;
  size: number;
  /** MIME 类型，如 image/png、application/pdf、application/msword */
  type: string;
  /** 内联预览 / AI 识别用；文件过大或超限制时为空，仅保留记录 */
  dataUrl?: string;
  addedAt: number;
  /** 上传来源：人工上传为空，AI 智能审核批注为 'AI智能审核' */
  uploadedBy?: string;
}

/** 产品基准参数卡：用于 AI 审核第一步「JS 规则快检」的数值/关键词比对基准 */
export interface ProductSpec {
  /** 产品品类 */
  category?: ProductCategory;
  /** 制冷类型：单冷 / 冷暖（除湿机不适用） */
  coolingType?: string;
  /** 频率类型：定频 / 变频 */
  frequency?: string;
  /** 电压，如 220V / 120V */
  voltage?: string;
  /** 冷媒型号，如 R32 / R290 / R134a */
  refrigerant?: string;
}

export interface Order {
  id: string;
  customerId: string;
  productModel: string;
  targetMarket: MarketKey;
  status: OrderStatus;
  /** 印刷文件清单 */
  files: OrderFile[];
  /** 产品基准参数卡 */
  spec?: ProductSpec;
  note: string;
  /** AI 审核结果（含问题及标注附件），持久化以便审阅与补充 */
  aiResult?: AiReviewResult;
  createdAt: number;
  updatedAt: number;
}

// ---------- 包装物料：法规库（轻量，用于自动匹配） ----------
export interface Regulation {
  id: string;
  /** 区域键（内置为 MarketKey，自定义区域为自由字符串） */
  market: MarketKey | string;
  marketName: string;
  /** 必检项 */
  requiredChecks: string[];
  /** 认证标志 */
  certMarks: string[];
  /** 警示语 */
  warnings: string[];
}

// ---------- 包装物料：客户品牌资产库 ----------
/** 一组品牌标准色值（HEX / CMYK / Pantone） */
export interface BrandColor {
  id: string;
  /** 用途名，如「主色」「辅助色」 */
  name: string;
  hex: string;
  cmyk: string;
  pantone: string;
}

/** 单个客户的品牌资产，审核时可由人工手动指定调用 */
export interface BrandAsset {
  id: string;
  customerId: string;
  /** 品牌名称（同一客户可下设多个品牌） */
  brandName?: string;
  /** Logo 图片（内联预览） */
  logoDataUrl?: string;
  /** 标准色值集合 */
  colors: BrandColor[];
  /** 标准字体 */
  fonts: string[];
  /** 品牌使用规范说明 */
  usageSpec: string;
  /** 品牌资料文件（PDF/Word/Excel/图片） */
  files: OrderFile[];
  updatedAt: number;
}

// ---------- 包装物料：市场法规库（按区域，可手动选择） ----------
export interface RegCountry {
  id: string;
  /** 国家/地区名，如「德国」 */
  country: string;
  /** 该国家认证要求，如 CE、UL、TIS */
  certs: string[];
  /** 强制标注项：安全警示语、语言要求、标签规范等 */
  mandatoryLabels: string[];
  /** 备注 */
  note: string;
}

export interface RegulationLibrary {
  id: string;
  /** 区域键（内置为 MarketKey，自定义区域为自由字符串） */
  region: MarketKey | string;
  /** 自定义区域名称（内置区域取 MARKET_LABEL[region]） */
  customName?: string;
  /** 是否内置区域（6 大区域 + 中国），内置区域不可删除 */
  isBuiltin?: boolean;
  /** 该区域下各国家/地区的认证与强制标注 */
  countries: RegCountry[];
  /** 法规参考文件 */
  files: OrderFile[];
  updatedAt: number;
  /** 最后一次联网检查更新的时间 */
  lastCheckedAt?: number;
}

// ---------- 包装物料：AI 审核 ----------
export type AiIssueType = "param" | "content" | "regulation" | "image";
export type AiIssueSeverity = "error" | "warn";

export interface AiIssue {
  type: AiIssueType;
  /** 问题位置（如「主展示面 / 型号与额定参数」） */
  location: string;
  suggestion: string;
  severity: AiIssueSeverity;
  /** 问题来源：规则快检 / 深度检查 / 图像审核 */
  source?: "rule" | "deep" | "image";
  /** 问题标注附件：AI 自动批注 + 人工补充，统一挂在问题卡片下 */
  attachments?: OrderFile[];
}

/** 两张图片的比对结论（多图对比） */
export interface ImageComparison {
  /** 左图标签（文件名/序号） */
  a: string;
  /** 右图标签 */
  b: string;
  /** 是否一致（真实 AI 基于视觉判断；Mock 给出待人工复核结论） */
  consistent: boolean;
  note: string;
}

/** 人工可控的审核输入：审核人员手动指定调用的资料 */
export interface ReviewInput {
  order: Order;
  /** 手动指定的法规资料（来自市场法规库），不指定则按订单目标市场自动取 */
  regulation?: Regulation | null;
  /** 手动指定的品牌资料（来自客户品牌资产库） */
  brandAsset?: BrandAsset | null;
  /** 参与审核 / 对比的多张图片（dataURL） */
  images?: string[];
  /** 是否执行多图对比 */
  compareImages?: boolean;
}

/** AI 审核结果：问题清单 + 多图对比 + 实际调用资料快照（人工可控回显） */
export interface AiReviewResult {
  issues: AiIssue[];
  comparison?: {
    pairs: ImageComparison[];
    summary: string;
  };
  /** 本次审核实际调用的资料，便于审核人员确认 */
  used: {
    regulationName?: string;
    brandAssetName?: string;
    imageCount?: number;
  };
}

/** 深度 AI 检查（调用大模型 API 的语义分析）返回结果 */
export interface AiDeepResult {
  /** 解析出的问题清单 */
  issues: AiIssue[];
  /** 置信度 0~1 */
  confidence: number;
  /** 文字概述 */
  summary: string;
}

/** 深度 AI 检查输入：以人工粘贴的印刷件文字为主，叠加基准参数卡与法规 */
export interface DeepReviewInput {
  order: Order;
  regulation?: Regulation | null;
  /** 用户粘贴的印刷件关键文字 */
  printedText: string;
  spec?: ProductSpec | null;
}

// ---------- 周报中心 ----------
export interface WeeklyReport {
  id: string;
  /** 周一时间戳 */
  weekStart: number;
  /** 形如 2026-W31 */
  weekLabel: string;
  /** 基于本周完成待办自动汇总的只读快照 */
  autoSummary: string;
  /** 用户手动编辑内容 */
  content: string;
  submitted: boolean;
  createdAt: number;
  updatedAt: number;
}

// ---------- 设置 ----------
export interface Settings {
  aiProvider: "mock" | "openai" | "custom" | "deepseek";
  /** AI 模型版本，随 provider 变化；空则使用对应 provider 的默认模型 */
  aiModel: string;
  apiKey: string;
  apiBase: string;
  userName: string;
  /** 当前角色，用于权限门控（已采用单管理员模式，默认 admin） */
  role: Role;
  /** 主题：light / dark（仅侧边栏区域按规范为深色，这里控制内容密度等） */
  density: "comfortable" | "compact";
  /** 最后一次数据备份（导出 JSON）时间 */
  lastBackupAt?: number;
}

// ---------- 顶层数据 ----------
export interface WorkbenchData {
  items: WorkItem[];
  projects: Project[];
  summaries: AISummary[];
  collections: Collection[];
  settings: Settings;
  // 包装物料
  customers: Customer[];
  orders: Order[];
  regulations: Regulation[];
  brandAssets: BrandAsset[];
  regLibs: RegulationLibrary[];
  // 周报
  weeklyReports: WeeklyReport[];
}

// ---------- AI 解析待办（信息收集页用） ----------
export interface ParsedTodo {
  title: string;
  assignee: string;
  dueDate: number | null;
  source: string;
  priority: Priority;
  /** 导入后是否勾选（信息收集页用） */
  checked?: boolean;
}
