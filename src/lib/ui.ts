import type { MarketKey, OrderStatus } from "../types";

export const MARKET_COLOR: Record<MarketKey, string> = {
  north_america: "#3b82f6",
  latin_america: "#f59e0b",
  europe_oceania: "#8b5cf6",
  middle_east_africa: "#ef4444",
  southeast_asia: "#10b981",
  china: "#e11d48",
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  pending_info: "#94a3b8",
  sent_waiting: "#f59e0b",
  received: "#06b6d4",
  ai_review: "#6366f1",
  manual_review: "#8b5cf6",
  feedback: "#f97316",
  customer_fixed: "#0ea5e9",
  approved: "#10b981",
  standard_fig: "#14b8a6",
  sent_supplier: "#3b82f6",
  sample_confirm: "#ec4899",
  closed: "#64748b",
};

export const PRIORITY_COLOR: Record<string, string> = {
  low: "#94a3b8",
  medium: "#3b82f6",
  high: "#f59e0b",
  urgent: "#ef4444",
};
