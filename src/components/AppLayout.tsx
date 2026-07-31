import { useState } from "react";
import { Layout, Menu, Button, Drawer, Grid, Tag, Badge, Modal, List, Breadcrumb } from "antd";
import {
  DashboardOutlined,
  ProjectOutlined,
  CheckSquareOutlined,
  InboxOutlined,
  CalendarOutlined,
  AppstoreOutlined,
  BookOutlined,
  SettingOutlined,
  MenuOutlined,
  BellOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import { Outlet, useLocation, useNavigate, useMatches } from "react-router-dom";
import { useWorkbench } from "../state/WorkbenchContext";
import { ORDER_STATUS_LABEL } from "../types";
import type { RouteHandle, BreadcrumbCtx } from "../router";

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;

const items = [
  { key: "/", icon: <DashboardOutlined />, label: "工作台" },
  { key: "/projects", icon: <ProjectOutlined />, label: "项目管理" },
  { key: "/todos", icon: <CheckSquareOutlined />, label: "待办管理" },
  { key: "/collect", icon: <InboxOutlined />, label: "信息收集" },
  { key: "/weekly", icon: <CalendarOutlined />, label: "周报中心" },
  {
    key: "/packaging",
    icon: <AppstoreOutlined />,
    label: "包装物料",
  },
  { key: "/packaging/reglib", icon: <BookOutlined />, label: "法规库" },
  { key: "/settings", icon: <SettingOutlined />, label: "设置" },
];

function selectedKey(path: string): string {
  if (path.startsWith("/packaging/reglib")) return "/packaging/reglib";
  if (path.startsWith("/packaging")) return "/packaging";
  if (path.startsWith("/projects")) return "/projects";
  if (path.startsWith("/weekly")) return "/weekly";
  return path;
}

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const wb = useWorkbench();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const sel = selectedKey(location.pathname);
  const openKey = location.pathname.startsWith("/packaging") ? "packaging" : "";

  // 审核待办 + 待处理订单（直接复用 WorkbenchContext 统一派生数据，避免重复计算）
  const reviewOrders = wb.derived.reviewOrders;
  const bellCount = wb.derived.unreadNotifications;
  const custName = (id: string) => wb.customers.find((c) => c.id === id)?.name ?? "";

  // 基于 React Router useMatches + 路由 handle.title 生成面包屑；
  // 动态路由的 title 为函数，由当前全局数据与路由参数反查真实名称
  const breadcrumbCtx: BreadcrumbCtx = { params: {}, wb };
  const crumbs = useMatches()
    .filter((m) => (m.handle as RouteHandle | undefined)?.title)
    .map((m) => {
      const title = (m.handle as RouteHandle).title;
      const resolved =
        typeof title === "function"
          ? title({ ...breadcrumbCtx, params: m.params })
          : title;
      return { path: m.pathname, title: resolved };
    });

  const menu = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[sel]}
      defaultOpenKeys={openKey ? [openKey] : []}
      items={items}
      onClick={({ key }) => {
        if (key.startsWith("/")) {
          navigate(key);
          setDrawerOpen(false);
        }
      }}
    />
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {!isMobile && (
        <Sider width={220} style={{ background: "#001529" }} breakpoint="lg" collapsedWidth={0}>
          <div
            style={{
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: 1,
            }}
          >
            项目工作台
          </div>
          {menu}
        </Sider>
      )}
      {isMobile && (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={220}
          styles={{ body: { padding: 0, background: "#001529" }, header: { background: "#001529" } }}
          title={<span style={{ color: "#fff" }}>项目工作台</span>}
        >
          {menu}
        </Drawer>
      )}
      <Layout style={{ background: "#f0f2f5" }}>
        <Header
          style={{
            background: "#fff",
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isMobile && (
              <Button type="text" icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} />
            )}
            {crumbs.length > 1 ? (
              <Breadcrumb
                items={crumbs.map((c, i) => ({
                  title:
                    i === crumbs.length - 1 ? (
                      c.title
                    ) : (
                      <a onClick={() => navigate(c.path)}>{c.title}</a>
                    ),
                }))}
              />
            ) : (
              <span style={{ fontWeight: 600 }}>{crumbs[0]?.title ?? "工作台"}</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Badge count={bellCount} size="small">
              <Button
                type="text"
                icon={<BellOutlined style={{ fontSize: 18 }} />}
                onClick={() => setBellOpen(true)}
              />
            </Badge>
            <Tag color="gold">管理员</Tag>
          </div>
        </Header>
        <Modal
          title={
            <span>
              <BellOutlined /> 审核提醒（{bellCount}）
            </span>
          }
          open={bellOpen}
          onCancel={() => setBellOpen(false)}
          footer={[
            <Button key="todo" onClick={() => { setBellOpen(false); navigate("/todos"); }}>
              前往待办管理
            </Button>,
            <Button key="ok" type="primary" onClick={() => setBellOpen(false)}>
              知道了
            </Button>,
          ]}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>审核待办（{reviewTodos.length}）</div>
          {reviewTodos.length ? (
            <List
              size="small"
              dataSource={reviewTodos}
              renderItem={(it) => (
                <List.Item
                  actions={[
                    <a key="go" onClick={() => { setBellOpen(false); navigate("/todos"); }}>查看</a>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<RobotOutlined style={{ color: "#1677ff" }} />}
                    title={it.title}
                    description={it.content}
                  />
                </List.Item>
              )}
            />
          ) : (
            <div style={{ color: "#bfbfbf", marginBottom: 12 }}>暂无审核待办</div>
          )}
          <div style={{ fontWeight: 600, margin: "12px 0 8px" }}>审核待处理订单（{reviewOrders.length}）</div>
          {reviewOrders.length ? (
            <List
              size="small"
              dataSource={reviewOrders}
              renderItem={(o) => (
                <List.Item
                  actions={[
                    <a key="go" onClick={() => { setBellOpen(false); navigate(`/packaging/orders/${o.id}`); }}>去审核</a>,
                  ]}
                >
                  <List.Item.Meta
                    title={`${o.productModel} · ${custName(o.customerId)}`}
                    description={
                      <Tag color={o.status === "manual_review" ? "red" : o.status === "feedback" ? "orange" : "blue"}>
                        {ORDER_STATUS_LABEL[o.status]}
                      </Tag>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <div style={{ color: "#bfbfbf" }}>暂无待处理订单</div>
          )}
        </Modal>
        <Content style={{ padding: 16, background: "#f0f2f5" }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
