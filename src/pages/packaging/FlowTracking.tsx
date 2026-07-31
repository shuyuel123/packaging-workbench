import { useMemo, useState } from "react";
import { Card, Table, Tag, Select, Space, Button, Empty } from "antd";
import { ArrowRightOutlined, EyeOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useWorkbench } from "../../state/WorkbenchContext";
import { PermissionGate } from "../../components/PermissionGate";
import { getOrderTimeout } from "../../lib/date";
import { formatDate } from "../../lib/storage";
import {
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABEL,
  MARKET_LABEL,
  type Order,
  type OrderStatus,
  type MarketKey,
} from "../../types";
import { MARKET_COLOR, ORDER_STATUS_COLOR } from "../../lib/ui";

/** 流程跟踪：全订单流程视图，支持按状态/市场筛选与快速推进 */
export function FlowTracking() {
  const wb = useWorkbench();
  const navigate = useNavigate();
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [market, setMarket] = useState<MarketKey | "all">("all");

  const rows = useMemo(
    () =>
      wb.orders.filter(
        (o) =>
          (status === "all" || o.status === status) &&
          (market === "all" || o.targetMarket === market)
      ),
    [wb.orders, status, market]
  );

  // 各状态数量统计（用于顶部流程条）
  const countByStatus = useMemo(() => {
    const map = new Map<OrderStatus, number>();
    ORDER_STATUS_FLOW.forEach((s) => map.set(s, 0));
    wb.orders.forEach((o) => map.set(o.status, (map.get(o.status) ?? 0) + 1));
    return map;
  }, [wb.orders]);

  return (
    <div>
      <Card title="流程分布" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ORDER_STATUS_FLOW.map((s) => {
            const n = countByStatus.get(s) ?? 0;
            const active = status === s;
            return (
              <div
                key={s}
                onClick={() => setStatus(active ? "all" : s)}
                style={{
                  cursor: "pointer",
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: active ? `1px solid ${ORDER_STATUS_COLOR[s]}` : "1px solid #f0f0f0",
                  background: active ? "#f0f7ff" : "#fafafa",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: ORDER_STATUS_COLOR[s],
                    display: "inline-block",
                  }}
                />
                <span style={{ fontSize: 13 }}>{ORDER_STATUS_LABEL[s]}</span>
                <span style={{ fontWeight: 600 }}>{n}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card
        title="订单流程跟踪"
        extra={
          <Space wrap>
            <Select
              size="small"
              style={{ width: 140 }}
              value={market}
              onChange={setMarket}
              options={[
                { value: "all", label: "全部市场" },
                ...(Object.keys(MARKET_LABEL) as MarketKey[]).map((m) => ({
                  value: m,
                  label: MARKET_LABEL[m],
                })),
              ]}
            />
            <Select
              size="small"
              style={{ width: 150 }}
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: "全部状态" },
                ...ORDER_STATUS_FLOW.map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s] })),
              ]}
            />
          </Space>
        }
      >
        <Table
          rowKey="id"
          size="small"
          dataSource={rows}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description="没有符合条件的订单" /> }}
          scroll={{ x: 760 }}
          columns={[
            {
              title: "产品型号",
              dataIndex: "productModel",
              render: (v: string, o: Order) => (
                <a onClick={() => navigate(`/packaging/orders/${o.id}`)}>{v}</a>
              ),
            },
            {
              title: "客户",
              dataIndex: "customerId",
              render: (id: string) => wb.customers.find((c) => c.id === id)?.name ?? "—",
            },
            {
              title: "市场",
              dataIndex: "targetMarket",
              width: 110,
              render: (m: MarketKey) => <Tag color={MARKET_COLOR[m]}>{MARKET_LABEL[m]}</Tag>,
            },
            {
              title: "当前状态",
              dataIndex: "status",
              width: 130,
              render: (s: OrderStatus) => (
                <Tag color={ORDER_STATUS_COLOR[s]}>{ORDER_STATUS_LABEL[s]}</Tag>
              ),
            },
            {
              title: "停留/提醒",
              width: 180,
              render: (_: unknown, o: Order) => {
                const t = getOrderTimeout(o);
                if (!t.message) return <span style={{ color: "#bfbfbf" }}>—</span>;
                return (
                  <span style={{ color: t.overdue ? "#ff4d4f" : t.warn ? "#fa8c16" : "#8c8c8c" }}>
                    {t.message}
                  </span>
                );
              },
            },
            {
              title: "更新时间",
              dataIndex: "updatedAt",
              width: 150,
              render: (v: number) => formatDate(v),
            },
            {
              title: "操作",
              width: 150,
              render: (_: unknown, o: Order) => {
                const isLast = ORDER_STATUS_FLOW.indexOf(o.status) >= ORDER_STATUS_FLOW.length - 1;
                return (
                  <Space>
                    <Button
                      type="text"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => navigate(`/packaging/orders/${o.id}`)}
                    />
                    <PermissionGate require="edit" fallback={null}>
                      <Button
                        size="small"
                        icon={<ArrowRightOutlined />}
                        disabled={isLast}
                        onClick={() => wb.advanceOrderStatus(o.id)}
                      >
                        推进
                      </Button>
                    </PermissionGate>
                  </Space>
                );
              },
            },
          ]}
        />
      </Card>
    </div>
  );
}
