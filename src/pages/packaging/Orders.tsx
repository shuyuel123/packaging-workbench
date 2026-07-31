import { useState } from "react";
import { Card, Button, Table, Tag, Modal, Form, Input, Select, Space, Popconfirm, message, type TableColumnsType } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useWorkbench } from "../../state/WorkbenchContext";
import { PermissionGate } from "../../components/PermissionGate";
import { MARKET_COLOR, ORDER_STATUS_COLOR } from "../../lib/ui";
import {
  MARKET_LABEL,
  ORDER_STATUS_LABEL,
  PRODUCT_CATEGORY_LABEL,
  type MarketKey,
  type Order,
  type OrderStatus,
  type ProductCategory,
} from "../../types";
import { getOrderTimeout } from "../../lib/date";
import { formatDate } from "../../lib/storage";
import { mkFile } from "../../lib/repository";

export function Orders() {
  const wb = useWorkbench();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [filters, setFilters] = useState<{
    customerId: string | null;
    status: OrderStatus | null;
    market: MarketKey | null;
  }>({ customerId: null, status: null, market: null });

  const data = wb.orders.filter(
    (o) =>
      (!filters.customerId || o.customerId === filters.customerId) &&
      (!filters.status || o.status === filters.status) &&
      (!filters.market || o.targetMarket === filters.market)
  );

  const columns: TableColumnsType<Order> = [
    {
      title: "型号 / 产品",
      dataIndex: "productModel",
      render: (m: string, r: Order) => (
        <Space direction="vertical" size={2}>
          <a onClick={() => navigate(`/packaging/orders/${r.id}`)}>{m}</a>
          {r.spec?.category ? (
            <Tag color="blue" style={{ marginInlineEnd: 0 }}>
              {PRODUCT_CATEGORY_LABEL[r.spec.category as ProductCategory]}
            </Tag>
          ) : null}
        </Space>
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
      render: (m: MarketKey) => <Tag color={MARKET_COLOR[m]}>{MARKET_LABEL[m]}</Tag>,
    },
    {
      title: "状态",
      dataIndex: "status",
      render: (s: OrderStatus) => <Tag color={ORDER_STATUS_COLOR[s]}>{ORDER_STATUS_LABEL[s]}</Tag>,
    },
    {
      title: "超时",
      key: "timeout",
      render: (_: unknown, r: Order) => {
        const t = getOrderTimeout(r);
        if (t.overdue) return <Tag color="red">回传 {t.days}天</Tag>;
        if (t.warn) return <Tag color="orange">审核 {t.days}天</Tag>;
        return <span style={{ color: "#bfbfbf" }}>—</span>;
      },
    },
    { title: "更新", dataIndex: "updatedAt", render: (t: number) => formatDate(t) },
    {
      title: "操作",
      key: "op",
      render: (_: unknown, r: Order) => (
        <Space>
          <Button type="link" onClick={() => navigate(`/packaging/orders/${r.id}`)}>
            详情
          </Button>
          <PermissionGate require="edit" fallback={null}>
            <Popconfirm title="删除订单？" onConfirm={() => wb.removeOrder(r.id)}>
              <Button type="link" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </PermissionGate>
        </Space>
      ),
    },
  ];

  function submit() {
    form.validateFields().then((v) => {
      wb.addOrder({
        customerId: v.customerId,
        productModel: v.productModel,
        targetMarket: v.targetMarket,
        status: "pending_info",
        files: (v.files ? String(v.files).split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : []).map(
          mkFile
        ),
        note: v.note ?? "",
      });
      message.success("订单已创建");
      setOpen(false);
      form.resetFields();
    });
  }

  return (
    <Card
      title="订单管理"
      extra={
        <PermissionGate require="edit" fallback={<Tag>查看者</Tag>}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
            新建订单
          </Button>
        </PermissionGate>
      }
    >
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          allowClear
          placeholder="按客户"
          style={{ width: 160 }}
          value={filters.customerId}
          onChange={(v) => setFilters((f) => ({ ...f, customerId: v }))}
          options={wb.customers.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Select
          allowClear
          placeholder="按状态"
          style={{ width: 160 }}
          value={filters.status}
          onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          options={(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((s) => ({
            value: s,
            label: ORDER_STATUS_LABEL[s],
          }))}
        />
        <Select
          allowClear
          placeholder="按市场"
          style={{ width: 160 }}
          value={filters.market}
          onChange={(v) => setFilters((f) => ({ ...f, market: v }))}
          options={(Object.keys(MARKET_LABEL) as MarketKey[]).map((k) => ({
            value: k,
            label: MARKET_LABEL[k],
          }))}
        />
      </Space>

      <Table rowKey="id" dataSource={data} columns={columns} pagination={{ pageSize: 10 }} />

      <Modal title="新建订单" open={open} onOk={submit} onCancel={() => setOpen(false)} okText="创建">
        <Form form={form} layout="vertical">
          <Form.Item name="customerId" label="客户" rules={[{ required: true }]}>
            <Select options={wb.customers.map((c) => ({ value: c.id, label: c.name }))} />
          </Form.Item>
          <Form.Item name="productModel" label="型号 / 产品" rules={[{ required: true }]}>
            <Input placeholder="如：KFR-35GW 分体空调 / KY-35 移动空调 / DH-20L 除湿机" />
          </Form.Item>
          <Form.Item name="targetMarket" label="目标市场" rules={[{ required: true }]}>
            <Select
              options={(Object.keys(MARKET_LABEL) as MarketKey[]).map((k) => ({
                value: k,
                label: MARKET_LABEL[k],
              }))}
            />
          </Form.Item>
          <Form.Item name="files" label="印刷文件（每行一个文件名）">
            <Input.TextArea rows={2} placeholder={"A100_正面.ai\nA100_背面.pdf"} />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
