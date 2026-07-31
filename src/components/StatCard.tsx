import type { ReactNode } from "react";
import { Card } from "antd";

export function StatCard({
  title,
  value,
  icon,
  color = "#10b981",
  suffix,
}: {
  title: string;
  value: ReactNode;
  icon?: ReactNode;
  color?: string;
  suffix?: string;
}) {
  return (
    <Card
      size="small"
      styles={{ body: { display: "flex", alignItems: "center", gap: 14, padding: 18 } }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: `${color}1a`,
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ color: "#8c8c8c", fontSize: 13 }}>{title}</div>
        <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>
          {value}
          {suffix && <span style={{ fontSize: 13, color: "#bfbfbf", marginLeft: 4 }}>{suffix}</span>}
        </div>
      </div>
    </Card>
  );
}
