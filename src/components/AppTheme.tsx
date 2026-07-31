import type { ReactNode } from "react";
import { ConfigProvider } from "antd";
import { useWorkbench } from "../state/WorkbenchContext";

/** 根据设置中的「密度」动态调整 Ant Design 组件尺寸 */
export function AppTheme({ children }: { children: ReactNode }) {
  const { settings } = useWorkbench();
  return (
    <ConfigProvider componentSize={settings.density === "compact" ? "small" : "middle"}>
      {children}
    </ConfigProvider>
  );
}
