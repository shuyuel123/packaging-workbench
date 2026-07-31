import { useState } from "react";
import { Card, Button, Table, Tag, Modal, Form, Input, Select, DatePicker, Segmented, Space, Popconfirm, message } from "antd";
import { PlusOutlined, DeleteOutlined, RobotOutlined } from "@ant-design/icons";
import { useWorkbench } from "../state/WorkbenchContext";
import { PermissionGate } from "../components/PermissionGate";
import { PriorityTag } from "../components/PriorityTag";
import { formatDate } from "../lib/storage";
import { isToday, isThisWeek, isOverdue } from "../lib/date";
import { PRIORITY_OPTIONS } from "../components/PriorityTag";
import type { WorkItem } from "../types";

type FilterKey = "all" | "today" | "week" | "overdue" | "done" | "review";

export function Todos() {
  const wb = useWorkbench();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const filtered = wb.items.filter((i) => {
    switch (filter) {
      case "today":
        return i.status !== "done" && isToday(i.dueDate);
      case "week":
        return isThisWeek(i.dueDate);
      case "overdue":
        return i.status !== "done" && isOverdue(i.dueDate);
      case "done":
        return i.status === "done";
      case "review":
        return i.tags.includes("审核待办");
      default:
        return true;
    }
  });

  const columns = [
    {
      title: "任务",
      dataIndex: "title",
      render: (t: string, r: WorkItem) => (
        <span>
          {r.tags.includes("审核待办") && (
            <Tag color="blue" icon={<RobotOutlined />} style={{ marginRight: 4 }}>
              审核
            </Tag>
          )}
          <span style={{ textDecoration: r.status === "done" ? "line-through" : "none" }}>{t}</span>
        </span>
      ),
    },
    {
      title: "所属项目",
      dataIndex: "projectId",
      render: (pid: string | null) =>
        pid ? wb.projects.find((p) => p.id === pid)?.name ?? "—" : <Tag>未归类</Tag>,
    },
    { title: "截止", dataIndex: "dueDate", render: (d: number | null) => formatDate(d) },
    { title: "优先级", dataIndex: "priority", render: (p: any) => <PriorityTag priority={p} /> },
    {
      title: "状态",
      dataIndex: "status",
      render: (s: string) => (
        <Tag color={s === "done" ? "green" : s === "doing" ? "blue" : "default"}>{s}</Tag>
      ),
    },
    {
      title: "操作",
      key: "op",
      render: (_: unknown, r: WorkItem) => (
        <Space>
          <Button type="link" onClick={() => wb.toggleDone(r.id)}>
            {r.status === "done" ? "撤销" : "完成"}
          </Button>
          <PermissionGate require="edit" fallback={null}>
            <Popconfirm title="删除该待办？" onConfirm={() => wb.removeItem(r.id)}>
              <Button type="link" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </PermissionGate>
        </Space>
      ),
    },
  ];

  function submit() {
    form.validateFields().then((v) => {
      wb.addItem({
        kind: "task",
        title: v.title,
        content: v.content ?? "",
        priority: v.priority,
        projectId: v.projectId ?? null,
        dueDate: v.dueDate ? v.dueDate.valueOf() : null,
        status: "todo",
        source: v.projectId ? "project" : "inbox",
      });
      message.success("待办已创建");
      setOpen(false);
      form.resetFields();
    });
  }

  return (
    <Card
      title="待办管理"
      extra={
        <PermissionGate require="edit" fallback={<Tag>查看者</Tag>}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
            新建待办
          </Button>
        </PermissionGate>
      }
    >
      <Segmented
        style={{ marginBottom: 16 }}
        value={filter}
        onChange={(v) => setFilter(v as FilterKey)}
        options={[
          { label: `全部 ${wb.items.length}`, value: "all" },
          { label: `今日 ${wb.items.filter((i) => i.status !== "done" && isToday(i.dueDate)).length}`, value: "today" },
          { label: `本周 ${wb.items.filter((i) => isThisWeek(i.dueDate)).length}`, value: "week" },
          { label: `逾期 ${wb.items.filter((i) => i.status !== "done" && isOverdue(i.dueDate)).length}`, value: "overdue" },
          { label: `已完成 ${wb.items.filter((i) => i.status === "done").length}`, value: "done" },
          {
            label: `审核待办 ${wb.items.filter((i) => i.tags.includes("审核待办")).length}`,
            value: "review",
          },
        ]}
      />
      <Table rowKey="id" dataSource={filtered} columns={columns} pagination={{ pageSize: 10 }} />

      <Modal title="新建待办" open={open} onOk={submit} onCancel={() => setOpen(false)} okText="创建">
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="任务名" rules={[{ required: true, message: "请输入任务名" }]}>
            <Input placeholder="如：核对包装法规库" />
          </Form.Item>
          <Form.Item name="content" label="说明">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="medium">
            <Select options={PRIORITY_OPTIONS} />
          </Form.Item>
          <Form.Item name="projectId" label="关联项目">
            <Select
              allowClear
              placeholder="不关联"
              options={wb.projects.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Form.Item>
          <Form.Item name="dueDate" label="截止日期">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
