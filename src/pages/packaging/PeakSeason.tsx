import { useMemo } from "react";
import { Card, Row, Col, Statistic, Table, Tag, Progress, Empty, Space, Button } from "antd";
import {
  FireOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useWorkbench } from "../../state/WorkbenchContext";
import { PermissionGate } from "../../components/PermissionGate";
import { getOrderTimeout, type OrderTimeout } from "../../lib/date";
import {
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABEL,
  MARKET_LABEL,
  type Order,
  type MarketKey,
} from "../../types";
import { MARKET_COLOR, ORDER_STATUS_COLOR } from "../../lib/ui";

interface QueueRow {
  order: Order;
  timeout: OrderTimeout;
}

/** 旺季模式：多订单并行的高密度总览（负载统计 + 市场分布 + 优先处理队列） */
export function PeakSeason() {
  const wb = useWorkbench();
  const navigate = useNavigate();

  const active = useMemo(() => wb.orders.filter((o) => o.status !== "closed"), [wb.orders]);
  const attention = useMemo<QueueRow[]>(
    () =>
      active
        .map((order) => ({ order, timeout: getOrderTimeout(order) }))
        .sort((a, b) => {
          if (a.timeout.overdue !== b.timeout.overdue) return a.timeout.overdue ? -1 : 1;
          if (a.timeout.warn !== b.timeout.warn) return a.timeout.warn ? -1 : 1;
          return b.timeout.days - a.timeout.days;
        }),
    [active]
  );
  const overdueCount = attention.filter((r) => r.timeout.overdue || r.timeout.warn).length;
  const closedCount = wb.orders.length - active.length;

  // 市场维度负载
  const byMarket = useMemo(() => {
    const map = new Map<MarketKey, number>();
    active.forEach((o) => map.set(o.targetMarket, (map.get(o.targetMarket) ?? 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [active]);
  const maxMarket = byMarket[0]?.[1] ?? 0;

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="并行订单"
              value={active.length}
              prefix={<FireOutlined style={{ color: "#fa541c" }} />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="需关注（超时/待处理）"
              value={overdueCount}
              valueStyle={{ color: overdueCount ? "#ff4d4f" : undefined }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="已结案"
              value={closedCount}
              prefix={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="整体结案率"
              value={wb.orders.length ? Math.round((closedCount / wb.orders.length) * 100) : 0}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="市场负载分布" style={{ height: "100%" }}>
            {byMarket.length === 0 ? (
              <Empty description="暂无进行中订单" />
            ) : (
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                {byMarket.map(([m, n]) => (
                  <div key={m}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 4,
                        fontSize: 13,
                      }}
                    >
                      <Tag color={MARKET_COLOR[m]}>{MARKET_LABEL[m]}</Tag>
                      <span style={{ fontWeight: 600 }}>{n} 单</span>
                    </div>
                    <Progress
                      percent={maxMarket ? Math.round((n / maxMarket) * 100) : 0}
                      showInfo={false}
                      strokeColor={MARKET_COLOR[m]}
                      size="small"
                    />
                  </div>
                ))}
              </Space>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card title="优先处理队列（按紧急程度排序）">
            <Table
              rowKey={(r) => r.order.id}
              size="small"
              dataSource={attention}
              pagination={{ pageSize: 8, hideOnSinglePage: true }}
              locale={{ emptyText: <Empty description="暂无进行中订单" /> }}
              scroll={{ x: 640 }}
              columns={[
                {
                  title: "产品型号",
                  render: (_: unknown, r: QueueRow) => (
                    <a onClick={() => navigate(`/packaging/orders/${r.order.id}`)}>
                      {r.order.productModel}
                    </a>
                  ),
                },
                {
                  title: "市场",
                  width: 100,
                  render: (_: unknown, r: QueueRow) => (
                    <Tag color={MARKET_COLOR[r.order.targetMarket]}>
                      {MARKET_LABEL[r.order.targetMarket]}
                    </Tag>
                  ),
                },
                {
                  title: "状态",
                  width: 120,
                  render: (_: unknown, r: QueueRow) => (
                    <Tag color={ORDER_STATUS_COLOR[r.order.status]}>
                      {ORDER_STATUS_LABEL[r.order.status]}
                    </Tag>
                  ),
                },
                {
                  title: "提醒",
                  render: (_: unknown, r: QueueRow) =>
                    r.timeout.message ? (
                      <span
                        style={{
                          color: r.timeout.overdue
                            ? "#ff4d4f"
                            : r.timeout.warn
                              ? "#fa8c16"
                              : "#8c8c8c",
                        }}
                      >
                        {r.timeout.message}
                      </span>
                    ) : (
                      <span style={{ color: "#bfbfbf" }}>正常</span>
                    ),
                },
                {
                  title: "操作",
                  width: 110,
                  render: (_: unknown, r: QueueRow) => {
                    const isLast =
                      ORDER_STATUS_FLOW.indexOf(r.order.status) >= ORDER_STATUS_FLOW.length - 1;
                    return (
                      <PermissionGate require="edit" fallback={<span>—</span>}>
                        <Button
                          size="small"
                          icon={<ArrowRightOutlined />}
                          disabled={isLast}
                          onClick={() => wb.advanceOrderStatus(r.order.id)}
                        >
                          推进
                        </Button>
                      </PermissionGate>
                    );
                  },
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
