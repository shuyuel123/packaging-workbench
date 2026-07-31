import { useState } from "react";
import { Card, Button, Table, Tag, Modal, Form, Input, DatePicker, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useWorkbench } from "../state/WorkbenchContext";
import { PermissionGate } from "../components/PermissionGate";
import { ProgressBar } from "../components/ProgressBar";
import { formatDate } from "../lib/storage";
import type { Project } from "../types";

export function Projects() {
  const wb = useWorkbench();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const columns = [
    {
      title: "名称",
      dataIndex: "name",
      render: (name: string, r: Project) => (
        <span>
          <span
            style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: r.color, marginRight: 8 }}
          />
          <a onClick={() => navigate(`/projects/${r.id}`)}>{name}</a>
        </span>
      ),
    },
    { title: "阶段", dataIndex: "stage", render: (s: string) => <Tag>{s}</Tag> },
    { title: "负责人", dataIndex: "owner" },
    {
      title: "截止日期",
      dataIndex: "dueDate",
      render: (d: number | null) => formatDate(d),
    },
    {
      title: "进度",
      key: "progress",
      width: 180,
      render: (_: unknown, r: Project) => {
        const related = wb.items.filter((i) => i.projectId === r.id);
        const done = related.filter((i) => i.status === "done").length;
        const p = related.length ? (done / related.length) * 100 : 0;
        return <ProgressBar percent={p} color={r.color} />;
      },
    },
    {
      title: "操作",
      key: "op",
      render: (_: unknown, r: Project) => (
        <Button type="link" onClick={() => navigate(`/projects/${r.id}`)}>
          查看
        </Button>
      ),
    },
  ];

  function submit() {
    form.validateFields().then((v) => {
      wb.addProject({
        name: v.name,
        description: v.description ?? "",
        stage: v.stage ?? "规划中",
        owner: v.owner ?? "我",
        dueDate: v.dueDate ? v.dueDate.valueOf() : null,
      });
      message.success("项目已创建");
      setOpen(false);
      form.resetFields();
    });
  }

  return (
    <Card
      title="项目管理"
      extra={
        <PermissionGate require="edit" fallback={<Tag>查看者</Tag>}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
            新建项目
          </Button>
        </PermissionGate>
      }
    >
      <Table
        rowKey="id"
        dataSource={wb.projects}
        columns={columns}
        pagination={false}
        onRow={(r) => ({ onClick: () => navigate(`/projects/${r.id}`) })}
      />

      <Modal title="新建项目" open={open} onOk={submit} onCancel={() => setOpen(false)} okText="创建">
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: "请输入名称" }]}>
            <Input placeholder="如：包装物料出海" />
          </Form.Item>
          <Form.Item name="stage" label="阶段">
            <Input placeholder="如：进行中" />
          </Form.Item>
          <Form.Item name="owner" label="负责人">
            <Input placeholder="如：我" />
          </Form.Item>
          <Form.Item name="dueDate" label="截止日期">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
