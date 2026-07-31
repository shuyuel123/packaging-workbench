import { useState } from "react";
import { Card, Button, Table, Tag, Modal, Form, Input, Select, Space, Popconfirm, message } from "antd";
import { PlusOutlined, DeleteOutlined, ShoppingOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useWorkbench } from "../../state/WorkbenchContext";
import { PermissionGate } from "../../components/PermissionGate";
import { MARKET_COLOR } from "../../lib/ui";
import { MARKET_LABEL, type MarketKey } from "../../types";

export function Customers() {
  const wb = useWorkbench();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form] = Form.useForm();

  const columns = [
    { title: "客户名称", dataIndex: "name", render: (n: string) => <b>{n}</b> },
    { title: "联系人", dataIndex: "contact" },
    {
      title: "主市场",
      dataIndex: "market",
      render: (m: MarketKey) => (
        <Tag color={MARKET_COLOR[m]}>{MARKET_LABEL[m]}</Tag>
      ),
    },
    {
      title: "订单数",
      key: "count",
      render: (_: unknown, r: any) => wb.orders.filter((o) => o.customerId === r.id).length,
    },
    { title: "备注", dataIndex: "note", ellipsis: true },
    {
      title: "操作",
      key: "op",
      render: (_: unknown, r: any) => (
        <Space>
          <Button
            type="link"
            icon={<ShoppingOutlined />}
            onClick={() => navigate("/packaging/orders")}
          >
            订单
          </Button>
          <PermissionGate require="edit" fallback={null}>
            <Button
              type="link"
              onClick={() => {
                setEditing(r.id);
                form.setFieldsValue(r);
                setOpen(true);
              }}
            >
              编辑
            </Button>
            <Popconfirm title="删除客户及其订单？" onConfirm={() => wb.removeCustomer(r.id)}>
              <Button type="link" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </PermissionGate>
        </Space>
      ),
    },
  ];

  function submit() {
    form.validateFields().then((v) => {
      if (editing) {
        wb.updateCustomer(editing, v);
        message.success("已保存");
      } else {
        wb.addCustomer(v);
        message.success("客户已创建");
      }
      setOpen(false);
      setEditing(null);
      form.resetFields();
    });
  }

  return (
    <Card
      title="客户管理"
      extra={
        <PermissionGate require="edit" fallback={<Tag>查看者</Tag>}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null);
              form.resetFields();
              setOpen(true);
            }}
          >
            新建客户
          </Button>
        </PermissionGate>
      }
    >
      <Table rowKey="id" dataSource={wb.customers} columns={columns} pagination={false} />

      <Modal
        title={editing ? "编辑客户" : "新建客户"}
        open={open}
        onOk={submit}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
        }}
        okText="保存"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="客户名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="contact" label="联系人">
            <Input />
          </Form.Item>
          <Form.Item name="market" label="主市场" rules={[{ required: true }]}>
            <Select
              options={(Object.keys(MARKET_LABEL) as MarketKey[]).map((k) => ({
                value: k,
                label: MARKET_LABEL[k],
              }))}
            />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
