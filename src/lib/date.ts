import type { Order, OrderStatus } from "../types";

/** 当天 0 点时间戳 */
function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 本周一 0 点时间戳（周一为一周起点） */
export function startOfWeek(ts: number): number {
  const d = new Date(startOfDay(ts));
  const day = d.getDay(); // 0=周日 .. 6=周六
  const diff = (day + 6) % 7; // 距周一的天数
  d.setDate(d.getDate() - diff);
  return d.getTime();
}

export function isToday(ts: number | null): boolean {
  if (!ts) return false;
  return startOfDay(ts) === startOfDay(Date.now());
}

export function isThisWeek(ts: number | null): boolean {
  if (!ts) return false;
  return startOfWeek(ts) === startOfWeek(Date.now());
}

/** 已过期（截止日早于今天且未传 null） */
export function isOverdue(ts: number | null): boolean {
  if (!ts) return false;
  return ts < startOfDay(Date.now());
}

/** a 到 b 的自然日差值（b - a，向上取整） */
export function dayDiff(a: number, b: number): number {
  const ms = startOfDay(b) - startOfDay(a);
  return Math.floor(ms / 86_400_000);
}

/** 形如 2026-W31 的周标签（ISO 周数） */
export function weekLabel(ts: number): string {
  const d = new Date(startOfWeek(ts));
  const year = d.getFullYear();
  const firstDay = new Date(year, 0, 1);
  const days = Math.floor(
    (startOfWeek(ts) - startOfDay(firstDay.getTime())) / 86_400_000
  );
  const week = Math.floor((days + ((firstDay.getDay() + 6) % 7)) / 7) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

// ---------- 订单超时判定 ----------
// 回传阶段：已发待回传 / 已收到文件，超过 7 天标红
const RETURN_STAGE: OrderStatus[] = ["sent_waiting", "received"];
// 审核阶段：AI 审核中 / 人工复核，超过 3 天提醒
const REVIEW_STAGE: OrderStatus[] = ["ai_review", "manual_review"];

export interface OrderTimeout {
  stage: "return" | "review" | null;
  days: number;
  /** 回传 >7 天：标红 */
  overdue: boolean;
  /** 审核 >3 天：提醒 */
  warn: boolean;
  message: string;
}

export function getOrderTimeout(order: Order): OrderTimeout {
  const days = dayDiff(order.updatedAt, Date.now());
  if (RETURN_STAGE.includes(order.status)) {
    const overdue = days > 7;
    return {
      stage: "return",
      days,
      overdue,
      warn: false,
      message: overdue
        ? `回传已超时 ${days} 天（>7天）`
        : `回传已 ${days} 天`,
    };
  }
  if (REVIEW_STAGE.includes(order.status)) {
    const warn = days > 3;
    return {
      stage: "review",
      days,
      overdue: false,
      warn,
      message: warn ? `审核已 ${days} 天未处理（>3天）` : `审核已 ${days} 天`,
    };
  }
  return { stage: null, days, overdue: false, warn: false, message: "" };
}
