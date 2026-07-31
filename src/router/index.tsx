import { Navigate } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import type { Params } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import PackagingLayout from "@/components/PackagingLayout";

// 页面组件（路径适配当前项目真实目录结构）
import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import Todos from "@/pages/Todos";
import AIOrganize from "@/pages/AIOrganize";
import Weekly from "@/pages/Weekly";
import WeeklyEdit from "@/pages/WeeklyEdit";
import Orders from "@/pages/packaging/Orders";
import OrderDetail from "@/pages/packaging/OrderDetail";
import FlowTracking from "@/pages/packaging/FlowTracking";
import BrandAssets from "@/pages/packaging/BrandAssets";
import RegulationLibrary from "@/pages/RegulationLibrary"; // 新版（统一入口）
import AiReview from "@/pages/packaging/AiReview";
import CustomerQuality from "@/pages/packaging/CustomerQuality";
import TimeoutReminders from "@/pages/packaging/TimeoutReminders";
import PeakSeason from "@/pages/packaging/PeakSeason";
import Settings from "@/pages/Settings";
import type { WorkbenchContextValue } from "@/state/WorkbenchContext";

// 面包屑上下文：由 AppLayout 注入全局数据与路由参数，供动态路由反查真实名称
export type BreadcrumbCtx = {
  params: Readonly<Params<string>>;
  wb: WorkbenchContextValue;
};

export type RouteHandle = {
  title: string | ((ctx: BreadcrumbCtx) => string);
};

// 路由配置数组（供 App.tsx 的 useRoutes 消费，自动适配 HashRouter）
export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard />, handle: { title: "工作台" } },
      { path: "projects", element: <Projects />, handle: { title: "项目管理" } },
      {
        path: "projects/:id",
        element: <ProjectDetail />,
        handle: {
          title: ({ params, wb }) =>
            wb.projects.find((p) => p.id === params.id)?.name ?? "项目详情",
        },
      },
      { path: "todos", element: <Todos />, handle: { title: "待办管理" } },
      { path: "collect", element: <AIOrganize />, handle: { title: "信息收集" } },
      { path: "weekly", element: <Weekly />, handle: { title: "周报中心" } },
      {
        path: "weekly/:weekStart",
        element: <WeeklyEdit />,
        handle: { title: "周报编辑" },
      },
      // 包装物料子系统（二级导航）
      {
        path: "packaging",
        element: <PackagingLayout />,
        children: [
          { index: true, element: <Navigate to="/packaging/orders" replace /> },
          { path: "orders", element: <Orders />, handle: { title: "订单管理" } },
          {
            path: "orders/:id",
            element: <OrderDetail />,
            handle: {
              title: ({ params, wb }) =>
                wb.orders.find((o) => o.id === params.id)?.orderName ?? "订单详情",
            },
          },
          { path: "flow", element: <FlowTracking />, handle: { title: "流程跟踪" } },
          { path: "brand", element: <BrandAssets />, handle: { title: "品牌资产" } },
          {
            path: "brand/:cid",
            element: <BrandAssets />,
            handle: {
              title: ({ params, wb }) =>
                wb.customers.find((c) => c.id === params.cid)?.name ?? "品牌资产",
            },
          },
          // 法规库：直接使用新版组件，替换旧版
          { path: "reglib", element: <RegulationLibrary />, handle: { title: "法规库" } },
          { path: "ai-review", element: <AiReview />, handle: { title: "AI 审核" } },
          { path: "quality", element: <CustomerQuality />, handle: { title: "客户质量" } },
          { path: "timeout", element: <TimeoutReminders />, handle: { title: "超时提醒" } },
          { path: "peak", element: <PeakSeason />, handle: { title: "旺季排产" } },
        ],
      },
      // 删除独立的 /reglib 路由，统一到 /packaging/reglib
      { path: "settings", element: <Settings />, handle: { title: "设置" } },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
];
