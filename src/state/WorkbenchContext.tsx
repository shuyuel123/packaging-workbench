import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  WorkItem,
  Project,
  AISummary,
  Settings,
  ItemKind,
  Priority,
  Status,
  Customer,
  Order,
  OrderStatus,
  Regulation,
  BrandAsset,
  RegulationLibrary,
  WeeklyReport,
  Collection,
  WorkbenchData,
} from "../types";
import { ORDER_STATUS_FLOW } from "../types";
import { loadData, saveData, resetData } from "../lib/repository";
import { uid, now } from "../lib/storage";
import { migrateInlineFilesToIDB, deleteMultipleFilesFromDB } from "../utils/storageService";
import { isToday, isOverdue, getOrderTimeout, weekLabel, startOfWeek } from "../lib/date";

interface NewItemInput {
  kind: ItemKind;
  title: string;
  content?: string;
  tags?: string[];
  priority?: Priority;
  status?: Status;
  projectId?: string | null;
  dueDate?: number | null;
  source?: "inbox" | "project";
}

interface NewProjectInput {
  name: string;
  description?: string;
  stage?: string;
  owner?: string;
  dueDate?: number | null;
  color?: string;
  phases?: Project["phases"];
}

interface WorkbenchContextValue {
  items: WorkItem[];
  projects: Project[];
  summaries: AISummary[];
  collections: Collection[];
  settings: Settings;
  customers: Customer[];
  orders: Order[];
  regulations: Regulation[];
  brandAssets: BrandAsset[];
  regLibs: RegulationLibrary[];
  weeklyReports: WeeklyReport[];
  /** 统一派生的通知/预警数据，供顶部铃铛与超时角标等共享，避免各组件重复计算导致不一致 */
  derived: {
    /** 进入人工复核类状态的订单（审核待办来源） */
    reviewOrders: Order[];
    /** 超时订单（待回传/待审核超时） */
    overdueOrders: Order[];
    /** 预警订单（含 warn，即待审核临界，与超时角标口径一致） */
    warnOrders: Order[];
    /** 未读通知总数 = 审核待办 + 超时订单 */
    unreadNotifications: number;
  };
  // 统计
  stats: {
    inbox: number;
    todo: number;
    doing: number;
    done: number;
    overdue: number;
    todayTodos: number;
    inProgressProjects: number;
    weeklyThisWeek: number;
    overdueOrders: number;
  };
  // 条目 CRUD
  addItem: (input: NewItemInput) => WorkItem;
  updateItem: (id: string, patch: Partial<WorkItem>) => void;
  removeItem: (id: string) => void;
  toggleDone: (id: string) => void;
  moveToProject: (id: string, projectId: string | null) => void;
  // 项目 CRUD
  addProject: (input: NewProjectInput) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  removeProject: (id: string) => void;
  // 摘要
  addSummary: (s: AISummary) => void;
  removeSummary: (id: string) => void;
  // 信息收集
  addCollection: (
    input: Omit<Collection, "id" | "createdAt">
  ) => Collection;
  removeCollection: (id: string) => void;
  // 客户
  addCustomer: (input: Omit<Customer, "id" | "createdAt" | "updatedAt">) => Customer;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  removeCustomer: (id: string) => void;
  // 订单
  addOrder: (input: Omit<Order, "id" | "createdAt" | "updatedAt">) => Order;
  updateOrder: (id: string, patch: Partial<Order>) => void;
  removeOrder: (id: string) => void;
  advanceOrderStatus: (id: string) => void;
  // 品牌资产库
  addBrandAsset: (input: Omit<BrandAsset, "id" | "updatedAt">) => BrandAsset;
  updateBrandAsset: (id: string, patch: Partial<BrandAsset>) => void;
  removeBrandAsset: (id: string) => void;
  // 市场法规库
  addRegLib: (input: Omit<RegulationLibrary, "id" | "updatedAt">) => RegulationLibrary;
  updateRegLib: (id: string, patch: Partial<RegulationLibrary>) => void;
  removeRegLib: (id: string) => void;
  addRegulation: (input: Omit<Regulation, "id" | "updatedAt">) => Regulation;
  updateRegulation: (id: string, patch: Partial<Regulation>) => void;
  removeRegulation: (id: string) => void;
  // 周报
  ensureWeeklyForWeek: (weekStart?: number) => WeeklyReport;
  updateWeekly: (id: string, patch: Partial<WeeklyReport>) => void;
  submitWeekly: (id: string) => void;
  removeWeekly: (id: string) => void;
  // 设置 / 重置
  updateSettings: (patch: Partial<Settings>) => void;
  /** 导出全部数据为 JSON 对象（用于备份下载） */
  exportAll: () => WorkbenchData;
  /** 从 JSON 对象整体恢复数据（单管理员模式，强制 role=admin） */
  importAll: (data: WorkbenchData) => void;
  resetAll: () => void;
}

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null);

const PALETTE = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
];

function buildAutoSummary(items: WorkItem[], weekStart: number): string {
  const done = items.filter(
    (i) => i.status === "done" && i.doneAt && i.doneAt >= weekStart
  );
  if (!done.length) return "本周暂无已完成事项。";
  const lines = done.map((i) => `· ${i.title}`).join("\n");
  return `本周完成 ${done.length} 项：\n${lines}`;
}

/** 进入人工复核类状态的订单需为审核人自动创建待办 */
const REVIEW_STATUSES: OrderStatus[] = ["manual_review", "feedback", "customer_fixed"];
const REVIEW_STATUS_LABEL: Record<string, string> = {
  manual_review: "人工复核中",
  feedback: "客户反馈修改",
  customer_fixed: "客户已修改待确认",
};

/** 纯函数：依据订单状态同步「审核待办」条目（进入则创建，离开则清理） */
function syncReviewTodo(items: WorkItem[], order: Order, t: number): WorkItem[] {
  const review = REVIEW_STATUSES.includes(order.status);
  const existing = items.find(
    (i) => i.orderRef === order.id && i.tags.includes("审核待办")
  );
  if (review && !existing) {
    const label = REVIEW_STATUS_LABEL[order.status] ?? order.status;
    const item: WorkItem = {
      id: uid("item"),
      kind: "task",
      title: `审核待办：${order.productModel}（${label}）`,
      content: `订单进入「${label}」，请人工复核印刷件与 AI 审核问题。`,
      tags: ["审核待办"],
      priority: order.status === "manual_review" ? "high" : "medium",
      status: "todo",
      projectId: null,
      dueDate: null,
      createdAt: t,
      updatedAt: t,
      doneAt: null,
      source: "inbox",
      orderRef: order.id,
    };
    return [item, ...items];
  }
  if (!review && existing) {
    return items.filter((i) => i.id !== existing.id);
  }
  return items;
}

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(loadData);

  useEffect(() => {
    saveData(data);
  }, [data]);

  // 旧数据迁移：将历史 localStorage 中内联的 dataUrl 文件转移到 IndexedDB，并剥离 dataUrl
  useEffect(() => {
    let alive = true;
    migrateInlineFilesToIDB(data)
      .then((changed) => {
        if (changed && alive) saveData(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<WorkbenchContextValue>(() => {
    const addItem: WorkbenchContextValue["addItem"] = (input) => {
      const t = now();
      const item: WorkItem = {
        id: uid("item"),
        kind: input.kind,
        title: input.title,
        content: input.content ?? "",
        tags: input.tags ?? [],
        priority: input.priority ?? "medium",
        status: input.status ?? "todo",
        projectId: input.projectId ?? null,
        dueDate: input.dueDate ?? null,
        createdAt: t,
        updatedAt: t,
        doneAt: null,
        source: input.source ?? "inbox",
      };
      setData((d) => ({ ...d, items: [item, ...d.items] }));
      return item;
    };

    const updateItem: WorkbenchContextValue["updateItem"] = (id, patch) => {
      setData((d) => ({
        ...d,
        items: d.items.map((i) =>
          i.id === id ? { ...i, ...patch, updatedAt: now() } : i
        ),
      }));
    };

    const removeItem: WorkbenchContextValue["removeItem"] = (id) => {
      setData((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }));
    };

    const toggleDone: WorkbenchContextValue["toggleDone"] = (id) => {
      setData((d) => ({
        ...d,
        items: d.items.map((i) =>
          i.id === id
            ? {
                ...i,
                status: i.status === "done" ? "todo" : "done",
                doneAt: i.status === "done" ? null : now(),
                updatedAt: now(),
              }
            : i
        ),
      }));
    };

    const moveToProject: WorkbenchContextValue["moveToProject"] = (
      id,
      projectId
    ) => {
      setData((d) => ({
        ...d,
        items: d.items.map((i) =>
          i.id === id
            ? {
                ...i,
                projectId,
                source: projectId ? "project" : "inbox",
                updatedAt: now(),
              }
            : i
        ),
      }));
    };

    const addProject: WorkbenchContextValue["addProject"] = (input) => {
      const t = now();
      const p: Project = {
        id: uid("proj"),
        name: input.name,
        description: input.description ?? "",
        stage: input.stage ?? "规划中",
        owner: input.owner ?? "我",
        dueDate: input.dueDate ?? null,
        color: input.color ?? PALETTE[Math.floor(Math.random() * PALETTE.length)],
        phases: input.phases ?? [],
        createdAt: t,
        updatedAt: t,
      };
      setData((d) => ({ ...d, projects: [...d.projects, p] }));
      return p;
    };

    const updateProject: WorkbenchContextValue["updateProject"] = (
      id,
      patch
    ) => {
      setData((d) => ({
        ...d,
        projects: d.projects.map((p) =>
          p.id === id ? { ...p, ...patch, updatedAt: now() } : p
        ),
      }));
    };

    const removeProject: WorkbenchContextValue["removeProject"] = (id) => {
      setData((d) => ({
        ...d,
        projects: d.projects.filter((p) => p.id !== id),
        items: d.items.map((i) =>
          i.projectId === id ? { ...i, projectId: null, source: "inbox" } : i
        ),
      }));
    };

    const addSummary: WorkbenchContextValue["addSummary"] = (s) => {
      setData((d) => ({ ...d, summaries: [s, ...d.summaries] }));
    };
    const removeSummary: WorkbenchContextValue["removeSummary"] = (id) => {
      setData((d) => ({
        ...d,
        summaries: d.summaries.filter((s) => s.id !== id),
      }));
    };

    // ---------- 信息收集 ----------
    const addCollection: WorkbenchContextValue["addCollection"] = (input) => {
      const t = now();
      const c: Collection = { ...input, id: uid("col"), createdAt: t };
      setData((d) => ({ ...d, collections: [c, ...d.collections] }));
      return c;
    };
    const removeCollection: WorkbenchContextValue["removeCollection"] = (id) => {
      setData((d) => ({
        ...d,
        collections: d.collections.filter((c) => c.id !== id),
      }));
    };

    // ---------- 客户 ----------
    const addCustomer: WorkbenchContextValue["addCustomer"] = (input) => {
      const t = now();
      const c: Customer = { ...input, id: uid("cust"), createdAt: t, updatedAt: t };
      setData((d) => ({ ...d, customers: [...d.customers, c] }));
      return c;
    };
    const updateCustomer: WorkbenchContextValue["updateCustomer"] = (
      id,
      patch
    ) => {
      setData((d) => ({
        ...d,
        customers: d.customers.map((c) =>
          c.id === id ? { ...c, ...patch, updatedAt: now() } : c
        ),
      }));
    };
    const removeCustomer: WorkbenchContextValue["removeCustomer"] = (id) => {
      setData((d) => ({
        ...d,
        customers: d.customers.filter((c) => c.id !== id),
        orders: d.orders.filter((o) => o.customerId !== id),
      }));
    };

    // ---------- 订单 ----------
    const addOrder: WorkbenchContextValue["addOrder"] = (input) => {
      const t = now();
      const o: Order = { ...input, id: uid("ord"), createdAt: t, updatedAt: t };
      setData((d) => ({ ...d, orders: [...d.orders, o] }));
      return o;
    };
    const updateOrder: WorkbenchContextValue["updateOrder"] = (id, patch) => {
      setData((d) => {
        const t = now();
        let updated: Order | undefined;
        const orders = d.orders.map((o) =>
          o.id === id ? (updated = { ...o, ...patch, updatedAt: t }) : o
        );
        return {
          ...d,
          orders,
          items: updated ? syncReviewTodo(d.items, updated, t) : d.items,
        };
      });
    };
    const removeOrder: WorkbenchContextValue["removeOrder"] = (id) => {
      const cur = data.orders.find((o) => o.id === id);
      const fileIds = cur?.files?.map((f) => f.id) ?? [];
      setData((d) => ({
        ...d,
        orders: d.orders.filter((o) => o.id !== id),
        items: d.items.filter((i) => i.orderRef !== id),
      }));
      if (fileIds.length) deleteMultipleFilesFromDB(fileIds).catch(() => {});
    };
    const advanceOrderStatus: WorkbenchContextValue["advanceOrderStatus"] = (
      id
    ) => {
      setData((d) => {
        const t = now();
        let updated: Order | undefined;
        const orders = d.orders.map((o) => {
          if (o.id !== id) return o;
          const idx = ORDER_STATUS_FLOW.indexOf(o.status);
          const next = ORDER_STATUS_FLOW[idx + 1];
          if (!next) return o;
          updated = { ...o, status: next, updatedAt: t };
          return updated;
        });
        return {
          ...d,
          orders,
          items: updated ? syncReviewTodo(d.items, updated, t) : d.items,
        };
      });
    };

    // ---------- 品牌资产库 ----------
    const addBrandAsset: WorkbenchContextValue["addBrandAsset"] = (input) => {
      const t = now();
      const b: BrandAsset = { ...input, id: uid("brand"), updatedAt: t };
      setData((d) => ({ ...d, brandAssets: [...d.brandAssets, b] }));
      return b;
    };
    const updateBrandAsset: WorkbenchContextValue["updateBrandAsset"] = (
      id,
      patch
    ) => {
      setData((d) => ({
        ...d,
        brandAssets: d.brandAssets.map((b) =>
          b.id === id ? { ...b, ...patch, updatedAt: now() } : b
        ),
      }));
    };
    const removeBrandAsset: WorkbenchContextValue["removeBrandAsset"] = (id) => {
      const cur = data.brandAssets.find((b) => b.id === id);
      const fileIds = cur?.files?.map((f) => f.id) ?? [];
      setData((d) => ({
        ...d,
        brandAssets: d.brandAssets.filter((b) => b.id !== id),
      }));
      if (fileIds.length) deleteMultipleFilesFromDB(fileIds).catch(() => {});
    };

    // ---------- 市场法规库 ----------
    const addRegLib: WorkbenchContextValue["addRegLib"] = (input) => {
      const t = now();
      const r: RegulationLibrary = { ...input, id: uid("reglib"), updatedAt: t };
      setData((d) => ({ ...d, regLibs: [...d.regLibs, r] }));
      return r;
    };
    const updateRegLib: WorkbenchContextValue["updateRegLib"] = (id, patch) => {
      setData((d) => ({
        ...d,
        regLibs: d.regLibs.map((r) =>
          r.id === id ? { ...r, ...patch, updatedAt: now() } : r
        ),
      }));
    };
    const removeRegLib: WorkbenchContextValue["removeRegLib"] = (id) => {
      const cur = data.regLibs.find((r) => r.id === id);
      const fileIds = cur?.files?.map((f) => f.id) ?? [];
      setData((d) => ({ ...d, regLibs: d.regLibs.filter((r) => r.id !== id) }));
      if (fileIds.length) deleteMultipleFilesFromDB(fileIds).catch(() => {});
    };

    // ---------- 区域法规（认证标志/必检项/警示语）----------
    const addRegulation: WorkbenchContextValue["addRegulation"] = (input) => {
      const r: Regulation = { ...input, id: uid("reg") };
      setData((d) => ({ ...d, regulations: [...d.regulations, r] }));
      return r;
    };
    const updateRegulation: WorkbenchContextValue["updateRegulation"] = (id, patch) => {
      setData((d) => ({
        ...d,
        regulations: d.regulations.map((r) =>
          r.id === id ? { ...r, ...patch, updatedAt: now() } : r
        ),
      }));
    };
    const removeRegulation: WorkbenchContextValue["removeRegulation"] = (id) => {
      const cur = data.regulations.find((r) => r.id === id);
      const fileIds = cur?.attachments?.map((a) => a.id) ?? [];
      if (fileIds.length) void deleteMultipleFilesFromDB(fileIds);
      setData((d) => ({ ...d, regulations: d.regulations.filter((r) => r.id !== id) }));
    };

    // ---------- 周报 ----------
    const ensureWeeklyForWeek: WorkbenchContextValue["ensureWeeklyForWeek"] = (
      weekStart = startOfWeek(Date.now())
    ) => {
      const existing = data.weeklyReports.find((r) => r.weekStart === weekStart);
      if (existing) return existing;
      const t = now();
      const report: WeeklyReport = {
        id: uid("wk"),
        weekStart,
        weekLabel: weekLabel(weekStart),
        autoSummary: buildAutoSummary(data.items, weekStart),
        content: "",
        submitted: false,
        createdAt: t,
        updatedAt: t,
      };
      setData((d) => ({ ...d, weeklyReports: [report, ...d.weeklyReports] }));
      return report;
    };
    const updateWeekly: WorkbenchContextValue["updateWeekly"] = (id, patch) => {
      setData((d) => ({
        ...d,
        weeklyReports: d.weeklyReports.map((r) =>
          r.id === id ? { ...r, ...patch, updatedAt: now() } : r
        ),
      }));
    };
    const submitWeekly: WorkbenchContextValue["submitWeekly"] = (id) => {
      setData((d) => ({
        ...d,
        weeklyReports: d.weeklyReports.map((r) =>
          r.id === id ? { ...r, submitted: true, updatedAt: now() } : r
        ),
      }));
    };
    const removeWeekly: WorkbenchContextValue["removeWeekly"] = (id) => {
      setData((d) => ({
        ...d,
        weeklyReports: d.weeklyReports.filter((r) => r.id !== id),
      }));
    };

    const updateSettings: WorkbenchContextValue["updateSettings"] = (patch) => {
      setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
    };
    const exportAll: WorkbenchContextValue["exportAll"] = () => ({
      items: data.items,
      projects: data.projects,
      summaries: data.summaries,
      collections: data.collections,
      settings: data.settings,
      customers: data.customers,
      orders: data.orders,
      regulations: data.regulations,
      brandAssets: data.brandAssets,
      regLibs: data.regLibs,
      weeklyReports: data.weeklyReports,
    });
    const importAll: WorkbenchContextValue["importAll"] = (next) => {
      setData((d) => ({
        ...d,
        ...next,
        settings: { ...d.settings, ...next.settings, role: "admin" },
      }));
    };

    const resetAll = () => setData(resetData());

    // ---------- 派生通知/预警数据（统一计算，供铃铛与超时角标复用）----------
    const derived = {
      reviewOrders: data.orders.filter((o) => REVIEW_STATUSES.includes(o.status)),
      overdueOrders: data.orders.filter((o) => getOrderTimeout(o).overdue),
      warnOrders: data.orders.filter(
        (o) => getOrderTimeout(o).overdue || getOrderTimeout(o).warn
      ),
      get unreadNotifications() {
        return this.reviewOrders.length + this.overdueOrders.length;
      },
    };

    // ---------- 统计 ----------
    const weekStartNow = startOfWeek(Date.now());
    const stats = {
      inbox: data.items.filter((i) => i.source === "inbox").length,
      todo: data.items.filter((i) => i.status === "todo").length,
      doing: data.items.filter((i) => i.status === "doing").length,
      done: data.items.filter((i) => i.status === "done").length,
      overdue: data.items.filter(
        (i) => i.status !== "done" && isOverdue(i.dueDate)
      ).length,
      todayTodos: data.items.filter(
        (i) => i.status !== "done" && isToday(i.dueDate)
      ).length,
      inProgressProjects: data.projects.filter((p) =>
        data.items.some((i) => i.projectId === p.id && i.status !== "done")
      ).length,
      weeklyThisWeek: data.weeklyReports.filter(
        (r) => r.weekStart === weekStartNow
      ).length,
      overdueOrders: derived.overdueOrders.length,
    };

    return {
      items: data.items,
      projects: data.projects,
      summaries: data.summaries,
      collections: data.collections,
      settings: data.settings,
      customers: data.customers,
      orders: data.orders,
      regulations: data.regulations,
      brandAssets: data.brandAssets,
      regLibs: data.regLibs,
      weeklyReports: data.weeklyReports,
      derived,
      stats,
      addItem,
      updateItem,
      removeItem,
      toggleDone,
      moveToProject,
      addProject,
      updateProject,
      removeProject,
      addSummary,
      removeSummary,
      addCollection,
      removeCollection,
      addCustomer,
      updateCustomer,
      removeCustomer,
      addOrder,
      updateOrder,
      removeOrder,
      advanceOrderStatus,
      addBrandAsset,
      updateBrandAsset,
      removeBrandAsset,
      addRegLib,
      updateRegLib,
      removeRegLib,
      addRegulation,
      updateRegulation,
      removeRegulation,
      ensureWeeklyForWeek,
      updateWeekly,
      submitWeekly,
      removeWeekly,
      updateSettings,
      exportAll,
      importAll,
      resetAll,
    };
  }, [data]);

  return (
    <WorkbenchContext.Provider value={value}>
      {children}
    </WorkbenchContext.Provider>
  );
}

export function useWorkbench(): WorkbenchContextValue {
  const ctx = useContext(WorkbenchContext);
  if (!ctx) throw new Error("useWorkbench 必须在 WorkbenchProvider 内使用");
  return ctx;
}
