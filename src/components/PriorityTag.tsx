import { Tag } from "antd";
import type { Priority } from "../types";

const MAP: Record<Priority, { color: string; label: string }> = {
  low: { color: "default", label: "低" },
  medium: { color: "blue", label: "中" },
  high: { color: "orange", label: "高" },
  urgent: { color: "red", label: "紧急" },
};

export function PriorityTag({ priority }: { priority: Priority }) {
  const m = MAP[priority];
  return <Tag color={m.color}>{m.label}</Tag>;
}

export const PRIORITY_OPTIONS = (["low", "medium", "high", "urgent"] as Priority[]).map(
  (p) => ({ value: p, label: MAP[p].label })
);
