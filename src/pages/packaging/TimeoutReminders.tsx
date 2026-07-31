import { useMemo } from "react";
import { Card, Table, Tag, Button, Space, Empty, Alert } from "antd";
import { ArrowRightOutlined, EyeOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useWorkbench } from "../../state/WorkbenchContext";
import { PermissionGate } from "../../components/PermissionGate";
import { getOrderTimeout, type OrderTimeout } from "../../lib/date";
import { formatDate } from "../../lib/storage";
import {
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABEL,
  MARKET_LABEL,
  type Order,
  type MarketKey,
} from "../../types";
import { MARKET_COLOR, ORDER_STATUS_COLOR } from "../../lib/ui";

interface ReminderRow {
  order: Order;
  timeout: OrderTimeout;
}

/** 超时提醒：回传超 7 天标红、审核超 3 天提醒，按严重程度排序 */
export function TimeoutReminders() {
  const wb = useWorkbench();
  const navigate = useNavigate();

  const rows: ReminderRow[] = useMemo(
    () =>
      wb.orders
        .map((order) => ({ order, timeout: getOrderTimeout(order) }))
        .filter((r) => r.timeout.overdue || r.timeout.warn)
        .sort((a, b) => {
          // 标红（overdue）优先，其次按停留天数降序
          if (a.timeout.overdue !== b.timeout.overdue) return a.timeout.overdue ? -1 : 1;
          return b.timeout.days - a.timeout.days;
        }),
    [wb.orders]
  );

  const redCount = rows.filter((r) => r.timeout.overdue).length;
  const warnCount = rows.length - redCount;

  return (
    <Card title="超时提醒">
      {rows.length === 0 ? (
        <Empty description="太棒了，当前没有超时或待处理的订单" />
      ) : (
        <>
          <Alert
            style={{ marginBottom: 12 }}
            type={redCount ? "error" : "warning"}
            showIcon
            message={`共 ${rows.length} 单需要关注：回传超时 ${redCount} 单（>7天），审核待处理 ${warnCount} 单（>3天）`}
          />
          <Table
            rowKey={(r) => r.order.id}
            size="small"
            dataSource={rows}
            pagination={false}
            scroll={{ x: 760 }}
            columns={[
              {
                title: "级别",
                width: 90,
                render: (_: unknown, r: ReminderRow) =>
                  r.timeout.overdue ? <Tag color="red">超时</Tag> : <Tag color="orange">提醒</Tag>,
              },
              {
                title: "产品型号",
                render: (_: unknown, r: ReminderRow) => (
                  <a onClick={() => navigate(`/packaging/orders/${r.order.id}`)}>
                    {r.order.productModel}
                  </a>
                ),
              },
              {
                title: "客户",
                render: (_: unknown, r: ReminderRow) =>
                  wb.customers.find((c) => c.id === r.order.customerId)?.name ?? "—",
              },
              {
                title: "市场",
                width: 110,
                render: (_: unknown, r: ReminderRow) => (
                  <Tag color={MARKET_COLOR[r.order.targetMarket as MarketKey]}>
                    {MARKET_LABEL[r.order.targetMarket as MarketKey]}
                  </Tag>
                ),
              },
              {
                title: "当前状态",
                width: 130,
                render: (_: unknown, r: ReminderRow) => (
                  <Tag color={ORDER_STATUS_COLOR[r.order.status]}>
                    {ORDER_STATUS_LABEL[r.order.status]}
                  </Tag>
                ),
              },
              {
                title: "提醒内容",
                render: (_: unknown, r: ReminderRow) => (
                  <span style={{ color: r.timeout.overdue ? "#ff4d4f" : "#fa8c16" }}>
                    {r.timeout.message}
                  </span>
                ),
              },
              {
                title: "更新时间",
                width: 150,
                render: (_: unknown, r: ReminderRow) => formatDate(r.order.updatedAt),
              },
              {
                title: "操作",
                width: 150,
                render: (_: unknown, r: ReminderRow) => {
                  const isLast =
                    ORDER_STATUS_FLOW.indexOf(r.order.status) >= ORDER_STATUS_FLOW.length - 1;
                  return (
                    <Space>
                      <Button
                        type="text"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => navigate(`/packaging/orders/${r.order.id}`)}
                      />
                      <PermissionGate require="edit" fallback={null}>
                        <Button
                          size="small"
                          icon={<ArrowRightOutlined />}
                          disabled={isLast}
                          onClick={() => wb.advanceOrderStatus(r.order.id)}
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
        </>
      )}
    </Card>
  );
}
