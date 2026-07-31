import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { ConfigProvider, App as AntApp } from "antd";
import zhCN from "antd/locale/zh_CN";
import App from "./App";
import { WorkbenchProvider } from "./state/WorkbenchContext";
import { AppTheme } from "./components/AppTheme";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
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
        <HashRouter>
          <WorkbenchProvider>
            <AppTheme>
              <App />
            </AppTheme>
          </WorkbenchProvider>
        </HashRouter>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
);
