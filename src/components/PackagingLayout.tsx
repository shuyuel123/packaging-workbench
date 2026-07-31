import { Layout, Menu, Badge, Grid } from "antd";
import {
  ShoppingOutlined,
  NodeIndexOutlined,
  BgColorsOutlined,
  BookOutlined,
  RobotOutlined,
  TeamOutlined,
  BellOutlined,
  FireOutlined,
} from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useWorkbench } from "../state/WorkbenchContext";

const { Sider, Content } = Layout;
const { useBreakpoint } = Grid;

const MODULES = [
  { key: "orders", icon: <ShoppingOutlined />, label: "订单管理" },
  { key: "flow", icon: <NodeIndexOutlined />, label: "全流程跟踪" },
  { key: "brand", icon: <BgColorsOutlined />, label: "客户品牌资产库" },
  { key: "reglib", icon: <BookOutlined />, label: "市场法规库" },
  { key: "ai-review", icon: <RobotOutlined />, label: "AI 审核" },
  { key: "quality", icon: <TeamOutlined />, label: "客户质量画像" },
  { key: "timeout", icon: <BellOutlined />, label: "超时提醒" },
  { key: "peak", icon: <FireOutlined />, label: "旺季看板" },
];

function selectedModule(path: string): string {
  // /packaging/<module>[/...] → 对应子菜单 key（与 MODULES.key 保持一致）
  const seg = path.replace(/^\/packaging\/?/, "").split("/")[0];
  return MODULES.some((m) => m.key === seg) ? seg : "orders";
}

/** 包装物料子系统布局：内部左侧导航（移动端为顶部横向菜单）+ 子路由出口 */
export function PackagingLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { derived } = useWorkbench();

  const items = MODULES.map((m) => ({
    key: m.key,
    icon: m.icon,
    label:
      m.key === "timeout" && derived.warnOrders.length > 0 ? (
        <span>
          {m.label}
          <Badge count={derived.warnOrders.length} size="small" offset={[8, -2]} />
        </span>
      ) : (
        m.label
      ),
  }));

  const menu = (
    <Menu
      mode={isMobile ? "horizontal" : "inline"}
      selectedKeys={[selectedModule(location.pathname)]}
      items={items}
      onClick={({ key }) => navigate(`/packaging/${key}`)}
      style={isMobile ? { marginBottom: 12 } : { height: "100%", borderRight: 0 }}
    />
  );

  if (isMobile) {
    return (
      <div>
        {menu}
        <Outlet />
      </div>
    );
  }

  return (
    <Layout style={{ background: "transparent" }}>
      <Sider
        width={168}
        style={{
          background: "#fff",
          borderRadius: 8,
          overflow: "hidden",
          height: "fit-content",
        }}
      >
        {menu}
      </Sider>
      <Content style={{ paddingLeft: 16, minWidth: 0 }}>
        <Outlet />
      </Content>
    </Layout>
  );
}
