import type {
  WorkbenchData,
  Settings,
  WorkItem,
  Project,
  Customer,
  Order,
  OrderFile,
  Regulation,
  BrandAsset,
  RegulationLibrary,
  WeeklyReport,
  Collection,
  MarketKey,
} from "../types";
import { uid, now } from "./storage";
import { startOfWeek } from "./date";

/** 把文件名快速构造为一条 OrderFile 记录（无内联内容） */
export function mkFile(name: string): OrderFile {
  return {
    id: uid("file"),
    name,
    size: 0,
    type: "",
    addedAt: now(),
  };
}

/** 兼容旧版：把 string[] 文件清单迁移为 OrderFile[] */
export function migrateFiles(raw: unknown): OrderFile[] {
  if (Array.isArray(raw)) {
    if (raw.length && typeof raw[0] === "string") {
      return (raw as string[]).map(mkFile);
    }
    return raw as OrderFile[];
  }
  return [];
}

// ---------- 按实体分 key 存储 ----------
const NS = "wb";
export const KEYS = {
  items: `${NS}:items`,
  projects: `${NS}:projects`,
  summaries: `${NS}:summaries`,
  collections: `${NS}:collections`,
  settings: `${NS}:settings`,
  customers: `${NS}:customers`,
  orders: `${NS}:orders`,
  regulations: `${NS}:regulations`,
  brandAssets: `${NS}:brandAssets`,
  regLibs: `${NS}:regLibs`,
  weekly: `${NS}:weekly`,
} as const;

function read<T>(key: string): T[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T[];
  } catch {
    return null;
  }
}

function write<T>(key: string, val: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error("保存失败", key, e);
  }
}

function readOne<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeOne<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error("保存失败", key, e);
  }
}

export const defaultSettings: Settings = {
  aiProvider: "mock",
  aiModel: "",
  apiKey: "",
  apiBase: "",
  userName: "我",
  role: "admin",
  density: "comfortable",
};

// 种子：今日 / 逾期 / 近期截止，用于仪表盘统计演示
function seedDueDates(t: number) {
  const day = 86_400_000;
  const today0 = new Date(t);
  today0.setHours(0, 0, 0, 0);
  const base = today0.getTime();
  return {
    dueToday: base,
    dueOverdue: base - 3 * day,
    dueSoon: base + 2 * day,
  };
}

function seedItems(t: number, d: ReturnType<typeof seedDueDates>): WorkItem[] {
  return [
    {
      id: uid("item"),
      kind: "task",
      title: "整理本周会议纪要",
      content: "周会提到要推进工作台 SPA 与包装物料出海项目，需拆成可执行任务。",
      tags: ["会议", "本周"],
      priority: "high",
      status: "doing",
      projectId: null,
      dueDate: d.dueToday,
      createdAt: t - 3600_000 * 26,
      updatedAt: t - 3600_000 * 3,
      doneAt: null,
      source: "inbox",
    },
    {
      id: uid("item"),
      kind: "link",
      title: "Ant Design v5 组件文档",
      content: "https://ant.design/components/overview",
      tags: ["前端", "antd"],
      priority: "low",
      status: "todo",
      projectId: null,
      dueDate: d.dueSoon,
      createdAt: t - 3600_000 * 50,
      updatedAt: t - 3600_000 * 50,
      doneAt: null,
      source: "inbox",
    },
    {
      id: uid("item"),
      kind: "task",
      title: "跟进包装物料法规库录入",
      content: "北美/欧洲市场认证标志较多，需逐条核对必检项。",
      tags: ["包装", "合规"],
      priority: "urgent",
      status: "todo",
      projectId: null,
      dueDate: d.dueOverdue,
      createdAt: t - 3600_000 * 80,
      updatedAt: t - 3600_000 * 9,
      doneAt: null,
      source: "inbox",
    },
    {
      id: uid("item"),
      kind: "idea",
      title: "工作台支持按项目聚合待办时间线",
      content: "在项目详情页用甘特图展示阶段与关联待办。",
      tags: ["设计", "体验"],
      priority: "medium",
      status: "todo",
      projectId: null,
      dueDate: null,
      createdAt: t - 3600_000 * 5,
      updatedAt: t - 3600_000 * 5,
      doneAt: null,
      source: "inbox",
    },
  ];
}

function seedProjects(t: number): Project[] {
  const day = 86_400_000;
  const base = startOfWeek(Date.now());
  return [
    {
      id: uid("proj"),
      name: "工作台 SPA",
      description: "个人项目工作台，管理碎片化工作信息的单页应用（Ant Design v5）。",
      stage: "开发中",
      owner: "我",
      dueDate: base + 14 * day,
      color: "#10b981",
      phases: [
        { name: "需求与规划", start: base, end: base + 3 * day },
        { name: "UI 与组件", start: base + 3 * day, end: base + 8 * day },
        { name: "联调与上线", start: base + 8 * day, end: base + 14 * day },
      ],
      createdAt: t - 3600_000 * 10,
      updatedAt: t - 3600_000 * 10,
    },
    {
      id: uid("proj"),
      name: "包装物料出海",
      description: "东南亚/北美/欧洲市场的包装设计与合规审核流程。",
      stage: "进行中",
      owner: "我",
      dueDate: base + 30 * day,
      color: "#f59e0b",
      phases: [
        { name: "客户对接", start: base, end: base + 10 * day },
        { name: "设计与审核", start: base + 10 * day, end: base + 22 * day },
        { name: "打样交付", start: base + 22 * day, end: base + 30 * day },
      ],
      createdAt: t - 3600_000 * 40,
      updatedAt: t - 3600_000 * 4,
    },
    {
      id: uid("proj"),
      name: "出海合规知识库",
      description: "沉淀各目标市场的法规、认证与警示语，供 AI 审核引用。",
      stage: "规划中",
      owner: "我",
      dueDate: base + 21 * day,
      color: "#6366f1",
      phases: [
        { name: "资料收集", start: base, end: base + 7 * day },
        { name: "结构化录入", start: base + 7 * day, end: base + 14 * day },
        { name: "审核校验", start: base + 14 * day, end: base + 21 * day },
      ],
      createdAt: t - 3600_000 * 12,
      updatedAt: t - 3600_000 * 6,
    },
  ];
}

function seedCustomers(t: number): Customer[] {
  const day = 86_400_000;
  return [
    {
      id: uid("cust"),
      name: "星海贸易",
      contact: "王经理 / +86 138xxxx",
      market: "southeast_asia",
      note: "东南亚家电经销商，主推分体空调与除湿机，订单量大、交付紧。",
      createdAt: t - day * 30,
      updatedAt: t - day * 5,
    },
    {
      id: uid("cust"),
      name: "NovaGoods Inc.",
      contact: "Lucy / lucy@novagoods.com",
      market: "north_america",
      note: "北美商超/电商，移动空调与除湿机为主，认证要求严格（UL/ETL/Energy Star/DOE）。",
      createdAt: t - day * 25,
      updatedAt: t - day * 3,
    },
    {
      id: uid("cust"),
      name: "EuroPack GmbH",
      contact: "Hans / hans@europack.de",
      market: "europe_oceania",
      note: "欧澳客户，分体空调与移动空调为主，注重 ErP 能效与 CE 合规。",
      createdAt: t - day * 20,
      updatedAt: t - day * 2,
    },
    {
      id: uid("cust"),
      name: "海湾优选",
      contact: "阿里 / +971 5x xxxx",
      market: "middle_east_africa",
      note: "中东非分销商，分体空调与除湿机，需 SASO/GSO 与阿拉伯文标签。",
      createdAt: t - day * 12,
      updatedAt: t - day,
    },
  ];
}

function seedOrders(t: number, c: Customer[]): Order[] {
  const day = 86_400_000;
  return [
    {
      id: uid("ord"),
      customerId: c[0].id,
      productModel: "KFR-35GW/Bp 分体空调 1.5匹",
      targetMarket: "southeast_asia",
      status: "sent_waiting",
      files: ["KFR35GW_铭牌.ai", "KFR35GW_外箱.pdf"].map(mkFile),
      spec: { category: "split_ac", coolingType: "冷暖", frequency: "变频", voltage: "220V", refrigerant: "R32" },
      note: "客户尚未回传确认稿",
      createdAt: t - day * 12,
      updatedAt: t - day * 10, // 回传已 10 天 > 7 → 标红
    },
    {
      id: uid("ord"),
      customerId: c[1].id,
      productModel: "KY-35/NA 移动空调 1.0匹",
      targetMarket: "north_america",
      status: "ai_review",
      files: ["KY35_master.pdf"].map(mkFile),
      spec: { category: "portable_ac", coolingType: "单冷", frequency: "定频", voltage: "115V", refrigerant: "R290" },
      note: "等待 AI 深度审核结果",
      createdAt: t - day * 6,
      updatedAt: t - day * 4, // 审核 4 天 > 3 → 提醒
    },
    {
      id: uid("ord"),
      customerId: c[2].id,
      productModel: "DH-20L 除湿机 20L/天",
      targetMarket: "europe_oceania",
      status: "approved",
      files: ["DH20L_final.pdf"].map(mkFile),
      spec: { category: "dehumidifier", frequency: "变频", voltage: "230V", refrigerant: "R290" },
      note: "已通过，待制版",
      createdAt: t - day * 8,
      updatedAt: t - day,
    },
    {
      id: uid("ord"),
      customerId: c[0].id,
      productModel: "DH-12L 除湿机 12L/天",
      targetMarket: "southeast_asia",
      status: "received",
      files: ["DH12L_标签.pdf"].map(mkFile),
      spec: { category: "dehumidifier", frequency: "定频", voltage: "220V", refrigerant: "R290" },
      note: "已收到，待进入审核",
      createdAt: t - day * 3,
      updatedAt: t - day * 2,
    },
    {
      id: uid("ord"),
      customerId: c[3].id,
      productModel: "KFR-50GW 分体空调 2匹",
      targetMarket: "middle_east_africa",
      status: "closed",
      files: ["KFR50GW_done.pdf"].map(mkFile),
      spec: { category: "split_ac", coolingType: "冷暖", frequency: "变频", voltage: "230V", refrigerant: "R32" },
      note: "已结案",
      createdAt: t - day * 15,
      updatedAt: t - day * 6,
    },
  ];
}

function seedRegulations(): Regulation[] {
  return [
    {
      id: "REG-001",
      market: "southeast_asia",
      marketName: "东南亚",
      requiredChecks: [
        "型号与额定制冷量(BTU/h·kW)标注",
        "SEER/EER 能效等级",
        "安规 IEC 60335-2-40",
        "噪音 dB(A) 标注",
        "冷媒类型与充注量",
        "原产国与进口商",
      ],
      certMarks: ["TISI", "SNI", "SIRIM", "MEPS"],
      warnings: ["安装须由专业人员", "冷媒可燃警示(R290/R32)", "移动空调排风管不得堵塞", "除湿机满水/溢水警示"],
    },
    {
      id: "REG-002",
      market: "latin_america",
      marketName: "中南美非",
      requiredChecks: [
        "西/葡双语标签",
        "额定制冷量(BTU/h)标注",
        "SEER/EER 能效(各该国)",
        "安规 IEC 60335-2-40",
        "噪音 dB(A) 标注",
        "进口商与批次号",
        "目的港准入证书(SONCAP/PVOC/COC)",
      ],
      certMarks: ["INMETRO", "NOM", "PROCEL", "ENERGY STAR"],
      warnings: ["能效标识依品类而定", "禁止误导性节能宣称", "移动空调禁止密闭空间使用", "各国准入要求差异大", "需提前确认目的港标准", "南非须 NRCS VC9004 安规"],
    },
    {
      id: "REG-003",
      market: "north_america",
      marketName: "北美",
      requiredChecks: [
        "英文标签",
        "UL/ETL 安全认证(UL 484)",
        "额定制冷量(BTU/h)",
        "SEER/EER(DOE 10 CFR 430)",
        "Energy Guide 标签",
        "噪音 dB(A) 标注",
        "冷媒类型与充注量",
      ],
      certMarks: ["UL", "ETL", "FCC", "DOE", "Energy Star", "NRCan"],
      warnings: ["触电危险警示", "冷媒可燃性警示(R32/R290)", "加州 65 提案如适用", "移动空调禁止密闭空间使用"],
    },
    {
      id: "REG-004",
      market: "europe_oceania",
      marketName: "欧澳",
      requiredChecks: [
        "CE 标志(强制)",
        "ErP EU 206/2012 生态设计",
        "EU 能效标签 626/2011",
        "安规 EN 60335-2-40",
        "F-gas 517/2014",
        "噪音 dB(A) 标注",
        "WEEE 回收标识",
      ],
      certMarks: ["CE", "GS", "TÜV", "ErP"],
      warnings: ["禁止虚假能效宣称", "含氟气体(F-gas)标识要求", "冷媒可燃警示(R32/R290)"],
    },
    {
      id: "REG-005",
      market: "middle_east_africa",
      marketName: "中东非",
      requiredChecks: [
        "阿拉伯文标签(本地语言)",
        "SASO/ESMA 认证",
        "额定制冷量(kW)标注",
        "SEER/EER 能效(各国)",
        "安规 IEC 60335-2-40",
        "冷媒类型与充注量",
        "原产国与进口商",
      ],
      certMarks: ["SASO", "GSO", "ESMA", "ECAS"],
      warnings: ["安装安全警示", "冷媒可燃警示(R32/R290)", "安规与能效证书须随附"],
    },
    {
      id: "REG-006",
      market: "china",
      marketName: "中国",
      requiredChecks: [
        "CCC 强制认证(GB 4706.32 安规)",
        "中国能效标识(CEL)",
        "额定电流/电压(220V~/50Hz)",
        "冷媒类型与充注量",
        "防触电警示(GB 5296.2)",
        "产品型号与制造商/厂址",
      ],
      certMarks: ["CCC", "CEL", "CQC"],
      warnings: ["防触电危险警示", "冷媒可燃性警示(R32/R290)", "安装须由专业人员", "除湿机满水/溢水警示"],
    },
  ];
}

function seedWeekly(): WeeklyReport[] {
  return [];
}

function seedCollections(): Collection[] {
  return [];
}

/** 品牌资产：为每个种子客户准备一套标准色值/字体/规范 */
function seedBrandAssets(t: number, c: Customer[]): BrandAsset[] {
  const mk = (name: string, hex: string, cmyk: string, pantone: string) => ({
    id: uid("color"),
    name,
    hex,
    cmyk,
    pantone,
  });
  const find = (name: string) => c.find((x) => x.name === name)!;
  return [
    {
      id: uid("brand"),
      customerId: find("星海贸易").id,
      logoDataUrl: undefined,
      colors: [
        mk("主色", "#0EA5A4", "80,49,47,18", "PANTONE 17-5113"),
        mk("辅助色", "#F4A300", "0,40,90,0", "PANTONE 14-1064"),
      ],
      fonts: ["思源黑体", "Source Han Sans CN"],
      usageSpec:
        "Logo 最小留白 ≥ 1/4 字高；主色仅用于主展示面与铭牌；禁止在冷媒可燃警示区使用主色。",
      files: [],
      updatedAt: t - 3600_000 * 5,
    },
    {
      id: uid("brand"),
      customerId: find("NovaGoods Inc.").id,
      logoDataUrl: undefined,
      colors: [
        mk("Brand", "#1B3B8B", "90,70,0,45", "PANTONE 19-3938"),
        mk("Accent", "#E63946", "0,80,75,10", "PANTONE 18-1664"),
      ],
      fonts: ["Helvetica Neue", "Arial"],
      usageSpec:
        "英文品牌名与 Logo 同高对齐；UL/ETL 认证标志区不得被主色覆盖；能效标识使用标准色。",
      files: [],
      updatedAt: t - 3600_000 * 3,
    },
    {
      id: uid("brand"),
      customerId: find("EuroPack GmbH").id,
      logoDataUrl: undefined,
      colors: [
        mk("Hauptfarbe", "#2E7D32", "75,0,75,40", "PANTONE 17-0230"),
        mk("Sekundär", "#1565C0", "85,45,0,25", "PANTONE 19-4053"),
      ],
      fonts: ["Futura", "Roboto"],
      usageSpec:
        "EU 能效标签使用专色；多语言标签中德语为首；Logo 与 CE 标志间距 ≥ 5mm。",
      files: [],
      updatedAt: t - 3600_000 * 2,
    },
  ];
}

/** 市场法规库：6 大区域，每个区域含若干国家认证/强制标注 */
function seedRegLibs(t: number): RegulationLibrary[] {
  const day = 86_400_000;
  const reg = (
    region: RegulationLibrary["region"],
    countries: { country: string; certs: string[]; mandatoryLabels: string[]; note: string }[]
  ): RegulationLibrary => ({
    id: uid("reglib"),
    region,
    countries: countries.map((c) => ({ id: uid("rc"), ...c })),
    files: [],
    updatedAt: t - day * 2,
  });
  return [
    reg("southeast_asia", [
      {
        country: "泰国",
        certs: ["TISI", "TIS 2134-2565(空调能效 MEPS)", "IEC 60335-2-40(安规)"],
        mandatoryLabels: ["泰文品名/型号", "额定制冷量/制热量(kW)", "SEER/EER 能效", "噪音 dB(A)", "冷媒类型与充注量", "原产国与进口商", "安全警示符号"],
        note: "空调/移动空调/除湿机须 TISI + TIS 2134-2565 能效(MEPS)、IEC 60335-2-40 安规；进口商本地注册号必填。",
      },
      {
        country: "印尼",
        certs: ["SNI", "SNI IEC 60335-2-40(安规)", "POSTEL(无线)"],
        mandatoryLabels: ["印尼文型号", "额定制冷量(kW)", "SEER/EER", "冷媒类型与充注量", "序列号"],
        note: "空调/除湿机须 SNI IEC 60335-2-40 安规；能效 SNI 待全面实施；标签需印尼文。",
      },
      {
        country: "马来西亚",
        certs: ["SIRIM", "ST(能效 MEPS)", "IEC 60335-2-40(安规)"],
        mandatoryLabels: ["马来文/英文型号", "电压/频率(230V/50Hz)", "冷媒类型", "能效等级(MEPS)", "噪音 dB(A)"],
        note: "SIRIM 安全认证 + ST 能效标签(MEPS)；安规采纳 IEC 60335-2-40。",
      },
      {
        country: "越南",
        certs: ["CR Mark(QUACERT)", "TCVN 5699-2-40/IEC 60335-2-40", "VR(能效)"],
        mandatoryLabels: ["越南文型号", "电压/频率(220V/50Hz)", "冷媒类型", "能效标签(VR)", "进口商与产地"],
        note: "空调须 CR 认证(TCVN 5699 等同 IEC 60335-2-40) + 能效 VR 标签；越南文标签。",
      },
      {
        country: "菲律宾",
        certs: ["PS/ICC(PS Mark)", "PNS IEC 60335-2-40(安规)", "EEEI(能效)"],
        mandatoryLabels: ["英文/菲律宾语型号", "电压/频率(230V/60Hz)", "冷媒类型", "PS 标志", "能效标签"],
        note: "空调须 BPS 的 PS/ICC 认证(PNS IEC 60335-2-40) + 能效标签。",
      },
    ]),
    reg("latin_america", [
      {
        country: "巴西",
        certs: ["INMETRO", "Ordinance 371(空调)", "PROCEL(能效)", "IEC 60335-2-40(安规)"],
        mandatoryLabels: ["葡文型号", "额定制冷量(BTU/h)", "SEER/EER", "能效标签(PROCEL)", "安全警示"],
        note: "空调须 INMETRO Ordinance 371 + PROCEL 能效；葡文标签；安规 IEC 60335-2-40。",
      },
      {
        country: "墨西哥",
        certs: ["NOM", "NOM-003-SCFI(安规)", "NOM-016-ENER(能效)"],
        mandatoryLabels: ["西班牙文型号", "电压/频率(127V/60Hz)", "额定制冷量(BTU/h)", "能效标签(NOM)", "原产国"],
        note: "空调须 NOM-003-SCFI 安规 + NOM-016-ENER 能效；西班牙文标签。",
      },
      {
        country: "智利",
        certs: ["SEC", "PE(能效)", "IEC 60335-2-40(安规)"],
        mandatoryLabels: ["西班牙文型号", "电压/频率(220V/50Hz)", "冷媒类型", "能效标签(PE)", "进口商"],
        note: "空调须 SEC 认证 + 能效 PE；西班牙文标签。",
      },
      {
        country: "阿根廷",
        certs: ["IRAM", "S-Mark(安规)", "IEC 60335-2-40"],
        mandatoryLabels: ["西班牙文型号", "电压/频率(220V/50Hz)", "冷媒类型", "能效标签", "进口商"],
        note: "空调须 IRAM-S 标记(安规) + 能效标签；西班牙文标签。",
      },
      {
        country: "尼日利亚",
        certs: ["SONCAP", "IES(安规)", "IEC 60335-2-40(安规)"],
        mandatoryLabels: ["英文型号", "电压/频率(230V/50Hz)", "冷媒类型", "原产国", "序列号"],
        note: "清关须 SONCAP 证书(基于 IEC 60335-2-40 安规)；目的港查验。",
      },
      {
        country: "肯尼亚",
        certs: ["PVOC", "KEBS", "IEC 60335-2-40(安规)"],
        mandatoryLabels: ["英文型号", "电压/频率(240V/50Hz)", "冷媒类型", "原产国", "序列号"],
        note: "目的港 PVOC 认证(KEBS)；安规 IEC 60335-2-40。",
      },
      {
        country: "南非",
        certs: ["NRCS VC9004(空调)", "SABS/SANS", "IEC 60335-2-40(安规)", "NRCS VC8035(EMC)"],
        mandatoryLabels: ["英文型号", "电压/频率(230V/50Hz)", "冷媒类型", "SANS 安全标识", "能效标签", "噪音 dB(A)"],
        note: "空调须 NRCS VC9004 安规 + SANS/IEC 60335-2-40；SABS 能效标签；英文标签。",
      },
      {
        country: "摩洛哥",
        certs: ["CMim", "IEC 60335-2-40(安规)"],
        mandatoryLabels: ["阿拉伯文/法文型号", "电压/频率(220V/50Hz)", "冷媒类型", "CMim 标志", "进口商"],
        note: "空调须 CMim 认证(安)规 IEC 60335-2-40；阿/法双语标签。",
      },
    ]),
    reg("north_america", [
      {
        country: "美国",
        certs: ["UL 484(房间空调器安规)", "ETL/cETLus", "DOE 10 CFR 430(能效)", "ENERGY STAR", "AHAM", "FCC"],
        mandatoryLabels: ["英文型号", "额定制冷量(BTU/h)", "SEER/EER", "Energy Guide 标签", "噪音 dB(A)", "冷媒与安全警示"],
        note: "安全认证(UL 484 / ETL)强制；DOE 10 CFR 430 能效与 Energy Guide 标签；移动空调/除湿机同覆盖。",
      },
      {
        country: "加拿大",
        certs: ["CSA C22.2 No.117(安规)", "cUL", "NRCan", "ICES(EMC)"],
        mandatoryLabels: ["英/法双语型号", "电压/频率(120/240V 60Hz)", "额定制冷量(BTU/h)", "能效(双语)", "安全警示"],
        note: "标签须英/法双语；CSA/cUL 安全 + NRCan 能效；安规采纳 IEC 60335-2-40 等效。",
      },
    ]),
    reg("europe_oceania", [
      {
        country: "德国",
        certs: ["CE", "GS", "TÜV", "ErP EU 206/2012", "EN 60335-2-40(安规)"],
        mandatoryLabels: ["德文型号", "CE 标志", "EU 能效标签(626/2011)", "额定/制热量(kW)", "噪音 dB(A)", "冷媒类型与 GWP", "WEEE 标识"],
        note: "含氟气体 F-gas 517/2014 标识；禁止虚假能效宣称；安规 EN 60335-2-40。",
      },
      {
        country: "法国",
        certs: ["CE", "NF", "ErP", "EN 60335-2-40(安规)"],
        mandatoryLabels: ["法文型号", "Triman 回收标识", "EU 能效标签", "冷媒类型", "噪音 dB(A)"],
        note: "Triman 为强制回收标识；能效标签法文；安规 EN 60335-2-40。",
      },
      {
        country: "英国",
        certs: ["UKCA", "CE(过渡)", "ErP", "BS EN 60335-2-40(安规)"],
        mandatoryLabels: ["英文型号", "UKCA 标志", "UK 能效标签(EPREL)", "冷媒类型(GWP)", "WEEE"],
        note: "脱欧后 UKCA 为英国本土标志(CE 过渡期)；安规 BS EN 60335-2-40；F-gas UK 法规。",
      },
      {
        country: "意大利",
        certs: ["CE", "ErP", "EN 60335-2-40(安规)"],
        mandatoryLabels: ["意大利文型号", "EU 能效标签", "冷媒类型", "回收标识", "噪音 dB(A)"],
        note: "意文标签；能效与安规同 EU 框架。",
      },
    ]),
    reg("middle_east_africa", [
      {
        country: "沙特阿拉伯",
        certs: ["SASO", "SASO 2663:2025(空调能效)", "SASO 2874:2025(除湿机)", "SASO IEC 60335-2-40(安规)", "SQM", "IECEE"],
        mandatoryLabels: ["阿拉伯文型号", "SASO 标志/SQM", "额定制冷量(kW)", "SEER/EER", "冷媒类型与充注量", "原产国与进口商"],
        note: "2025 新版 SASO 2663/2874 空调与除湿机能效标准；IECEE/SASO 认证；阿拉伯文标签必填。",
      },
      {
        country: "阿联酋",
        certs: ["ESMA", "ECAS", "IEC 60335-2-40(安规)", "TDRA(无线)"],
        mandatoryLabels: ["阿拉伯文/英文型号", "ECAS 注册号", "额定制冷量(kW)", "能效标签", "冷媒类型", "进口商"],
        note: "ECAS 注册(ESMA)；安规 IEC 60335-2-40；阿文/英文标签。",
      },
      {
        country: "科威特",
        certs: ["KUCAS/TER", "KOWEISS", "IEC 60335-2-40(安规)"],
        mandatoryLabels: ["阿拉伯文/英文型号", "电压/频率(240V/50Hz)", "冷媒类型", "TIR 证书号", "进口商"],
        note: "空调须 KUCAS(TER) 认证；安规 IEC 60335-2-40；阿文标签。",
      },
      {
        country: "埃及",
        certs: ["GOEIC", "EOS(ES)", "IEC 60335-2-40(安规)"],
        mandatoryLabels: ["阿拉伯文/英文型号", "电压/频率(220V/50Hz)", "冷媒类型", "能效标签", "进口商"],
        note: "空调进口须 GOEIC 查验 + EOS 标准(IEC 60335-2-40 安规)；阿文标签。",
      },
    ]),
    reg("china", [
      {
        country: "中国大陆",
        certs: ["CCC(GB 4706.32 安规)", "中国能效标识(CEL)", "CQC", "GB 21455(变频空调能效)", "GB 12021.3(定速空调能效)", "GB 37480(除湿机能效)"],
        mandatoryLabels: ["中文型号", "CCC 标志", "中国能效标识(等级)", "额定/制冷量(W)", "电压/频率(220V~/50Hz)", "冷媒类型与充注量", "防触电警示(GB 5296.2)", "制造商与厂址"],
        note: "分体/移动空调须 CCC(GB 4706.32 安规) + 中国能效标识(CEL，GB 21455/GB 12021.3)；除湿机 CCC + GB 37480 能效；中文标签。",
      },
      {
        country: "中国香港",
        certs: ["CCC(自愿)", "EMSD 能效标签(自愿)", "BS MI 安规", "IEC 60335-2-40(安规)"],
        mandatoryLabels: ["中/英文型号", "电压/频率(220V/50Hz)", "冷媒类型", "安全警示", "能效标签(自愿)"],
        note: "香港无强制 CCC；建议 IEC 60335-2-40 安规 + EMSD 能效标签(自愿)；中英文标签。",
      },
      {
        country: "中国台湾",
        certs: ["BSMI", "CNS 60335-2-40(安规)", "节能标章(自愿)"],
        mandatoryLabels: ["中/英文型号", "电压/频率(110/220V)", "冷媒类型", "BSMI 标志", "能效标签"],
        note: "空调/除湿机须 BSMI 认证(CNS 60335-2-40 安规) + 能效；中文标签。",
      },
    ]),
  ];
}

export function defaultData(): WorkbenchData {
  const t = now();
  const d = seedDueDates(t);
  const customers = seedCustomers(t);
  return {
    items: seedItems(t, d),
    projects: seedProjects(t),
    summaries: [],
    collections: seedCollections(),
    settings: { ...defaultSettings },
    customers,
    orders: seedOrders(t, customers),
    regulations: seedRegulations(),
    brandAssets: seedBrandAssets(t, customers),
    regLibs: seedRegLibs(t),
    weeklyReports: seedWeekly(),
  };
}

/**
 * 读取全部实体。仅在「无 items key」时（首次运行）写入完整种子；
 * 之后若新增实体（如 collections）缺失，仅补该实体种子，保留用户已有数据。
 */
/** 旧区域代码 → 新 6 区域代码的映射（一键检查/迁移用） */
const MARKET_KEY_MAP: Record<string, MarketKey> = {
  central_south_america: "latin_america",
  africa: "latin_america",
  europe: "europe_oceania",
};

/** 旧法规种子 id → 新 REG-00x 命名（向后迁移用） */
const REG_ID_MAP: Record<string, string> = {
  regulation_southeast_asia: "REG-001",
  regulation_latin_america: "REG-002",
  regulation_north_america: "REG-003",
  regulation_europe_oceania: "REG-004",
  regulation_middle_east_africa: "REG-005",
  regulation_china: "REG-006",
};

export function loadData(): WorkbenchData {
  const items = read<WorkItem>(KEYS.items);
  if (items == null) {
    const data = defaultData();
    saveData(data);
    return data;
  }
  const base = defaultData();
  let changed = false;
  const remap = (m: string): MarketKey => {
    const n = MARKET_KEY_MAP[m];
    if (n) {
      changed = true;
      return n;
    }
    return m as MarketKey;
  };
  const orders = (read<Order>(KEYS.orders) ?? base.orders).map((o) => ({
    ...o,
    files: migrateFiles(o.files),
    targetMarket: remap(o.targetMarket),
  }));
  const customers = (read<Customer>(KEYS.customers) ?? base.customers).map((c) => ({
    ...c,
    market: remap(c.market),
  }));
  const regulations = (read<Regulation>(KEYS.regulations) ?? base.regulations).map((r) => ({
    ...r,
    id: REG_ID_MAP[r.id] ?? r.id,
    market: remap(r.market),
  }));
  const regLibs = (read<RegulationLibrary>(KEYS.regLibs) ?? base.regLibs).map((lib) => ({
    ...lib,
    region: remap(lib.region),
  }));
  const result: WorkbenchData = {
    items,
    projects: read<Project>(KEYS.projects) ?? base.projects,
    summaries: read(KEYS.summaries) ?? base.summaries,
    collections: read<Collection>(KEYS.collections) ?? base.collections,
    settings: { ...base.settings, ...(readOne<Settings>(KEYS.settings) ?? {}) },
    customers,
    orders,
    regulations,
    brandAssets: read<BrandAsset>(KEYS.brandAssets) ?? base.brandAssets,
    regLibs,
    weeklyReports: read<WeeklyReport>(KEYS.weekly) ?? base.weeklyReports,
  };
  if (changed) saveData(result);
  return result;
}

/** 把整个数据对象按实体分 key 写入 localStorage */
export function saveData(data: WorkbenchData): void {
  write(KEYS.items, data.items);
  write(KEYS.projects, data.projects);
  write(KEYS.summaries, data.summaries);
  write(KEYS.collections, data.collections);
  writeOne(KEYS.settings, data.settings);
  write(KEYS.customers, data.customers);
  write(KEYS.orders, data.orders);
  write(KEYS.regulations, data.regulations);
  write(KEYS.brandAssets, data.brandAssets);
  write(KEYS.regLibs, data.regLibs);
  write(KEYS.weekly, data.weeklyReports);
}

/** 清空全部 key 并写入全新种子数据 */
export function resetData(): WorkbenchData {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  const data = defaultData();
  saveData(data);
  return data;
}

/** 实体级写入（供 Context 精确持久化） */
export function persistEntity<K extends keyof typeof KEYS>(
  key: (typeof KEYS)[K],
  value: unknown
): void {
  if (key === KEYS.settings) writeOne(key, value as Settings);
  else write(key, value as unknown[]);
}
