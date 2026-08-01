import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider, App as AntApp } from "antd";
import zhCN from "antd/locale/zh_CN";
import App from "./App";
import { WorkbenchProvider } from "./state/WorkbenchContext";
import { AppTheme } from "./components/AppTheme";
import { ErrorBoundary } from "./ErrorBoundary";
import "./styles.css";

// 路由由 App 内部的数据路由（createHashRouter + RouterProvider）自行创建，
// 因此这里不再包裹 <HashRouter>；全局 Provider 放在 RouterProvider 之外，
// 路由内的页面依旧能正常读取 WorkbenchContext 与主题配置。
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: "#10b981",
            borderRadius: 8,
            fontSize: 14,
          },
        }}
      >
        <AntApp>
          <WorkbenchProvider>
            <AppTheme>
              <App />
            </AppTheme>
          </WorkbenchProvider>
        </AntApp>
      </ConfigProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
