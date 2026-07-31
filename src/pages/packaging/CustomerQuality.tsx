import { useMemo } from "react";
import { Card, Table, Tag, Progress, Empty } from "antd";
import { useNavigate } from "react-router-dom";
import { useWorkbench } from "../../state/WorkbenchContext";
import { getOrderTimeout } from "../../lib/date";
import { MARKET_LABEL, type Customer, type MarketKey } from "../../types";
import { MARKET_COLOR } from "../../lib/ui";
import { Customers } from "./Customers";

interface QualityRow {
  customer: Customer;
  total: number;
  active: number;
  closed: number;
  overdue: number;
  hasBrandAsset: boolean;
}

/** 客户与质量：客户维度的订单质量概览 + 客户档案管理 */
export function CustomerQuality() {
  const wb = useWorkbench();
  const navigate = useNavigate();

  const rows: QualityRow[] = useMemo(
    () =>
      wb.customers.map((customer) => {
        const orders = wb.orders.filter((o) => o.customerId === customer.id);
        const closed = orders.filter((o) => o.status === "closed").length;
        const overdue = orders.filter((o) => {
          const t = getOrderTimeout(o);
          return t.overdue || t.warn;
        }).length;
        return {
          customer,
          total: orders.length,
          active: orders.length - closed,
          closed,
          overdue,
          hasBrandAsset: wb.brandAssets.some((a) => a.customerId === customer.id),
        };
      }),
    [wb.customers, wb.orders, wb.brandAssets]
  );

  return (
    <div>
      <Card title="客户质量概览" style={{ marginBottom: 16 }}>
        <Table
          rowKey={(r) => r.customer.id}
          size="small"
          dataSource={rows}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无客户数据" /> }}
          scroll={{ x: 720 }}
          columns={[
            {
              title: "客户",
              render: (_: unknown, r: QualityRow) => (
                <a onClick={() => navigate(`/packaging/brand/${r.customer.id}`)}>
                  {r.customer.name}
                </a>
              ),
            },
            {
              title: "市场",
              width: 110,
              render: (_: unknown, r: QualityRow) => (
                <Tag color={MARKET_COLOR[r.customer.market as MarketKey]}>
                  {MARKET_LABEL[r.customer.market as MarketKey]}
                </Tag>
              ),
            },
            { title: "订单总数", dataIndex: "total", width: 90 },
            { title: "进行中", dataIndex: "active", width: 80 },
            {
              title: "结案率",
              width: 160,
              render: (_: unknown, r: QualityRow) => (
                <Progress
                  percent={r.total ? Math.round((r.closed / r.total) * 100) : 0}
                  size="small"
                />
              ),
            },
            {
              title: "超时/待处理",
              dataIndex: "overdue",
              width: 110,
              render: (n: number) =>
                n > 0 ? <Tag color="red">{n} 单</Tag> : <Tag color="green">无</Tag>,
            },
            {
              title: "品牌资料",
              dataIndex: "hasBrandAsset",
              width: 100,
              render: (has: boolean) =>
                has ? <Tag color="purple">已建立</Tag> : <Tag>未建立</Tag>,
            },
          ]}
        />
      </Card>

      {/* 客户档案管理（新增/编辑/删除） */}
      <Customers />
    </div>
  );
}
