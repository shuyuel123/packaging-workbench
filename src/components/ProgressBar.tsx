export function ProgressBar({
  percent,
  color = "#10b981",
  height = 8,
}: {
  percent: number;
  color?: string;
  height?: number;
}) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      style={{
        background: "#f0f0f0",
        borderRadius: 999,
        height,
        overflow: "hidden",
        width: "100%",
      }}
    >
      <div
        style={{
          width: `${p}%`,
          height: "100%",
          background: color,
          borderRadius: 999,
          transition: "width .3s ease",
        }}
      />
    </div>
  );
}
