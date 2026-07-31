import { Tooltip } from "antd";
import { formatDate } from "../lib/storage";

interface Phase {
  name: string;
  start: number;
  end: number;
}

/** 自研轻量甘特图（CSS 条形，不引入图表库） */
export function GanttChart({
  phases,
  start,
  end,
}: {
  phases: Phase[];
  start: number;
  end: number;
}) {
  const total = end - start || 1;
  if (!phases.length) {
    return <div style={{ color: "#8c8c8c" }}>暂无阶段划分</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {phases.map((p, i) => {
        const left = ((p.start - start) / total) * 100;
        const width = Math.max(((p.end - p.start) / total) * 100, 2);
        const color = `hsl(${200 + i * 40}, 70%, 55%)`;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 120, flexShrink: 0, fontSize: 13 }}>{p.name}</div>
            <div
              style={{
                position: "relative",
                flex: 1,
                height: 22,
                background: "#f5f5f5",
                borderRadius: 4,
              }}
            >
              <Tooltip title={`${formatDate(p.start)} ~ ${formatDate(p.end)}`}>
                <div
                  style={{
                    position: "absolute",
                    left: `${left}%`,
                    width: `${width}%`,
                    height: "100%",
                    background: color,
                    borderRadius: 4,
                    opacity: 0.85,
                  }}
                />
              </Tooltip>
            </div>
          </div>
        );
      })}
    </div>
  );
}
