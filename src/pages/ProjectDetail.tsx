import { useState } from "react";
import { Card, Button, Descriptions, Table, Tag, Empty, Space, Modal, Form, Input, DatePicker, message } from "antd";
import { ArrowLeftOutlined, EditOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import { useWorkbench } from "../state/WorkbenchContext";
import { PermissionGate } from "../components/PermissionGate";
import { ProgressBar } from "../components/ProgressBar";
import { PriorityTag } from "../components/PriorityTag";
import { GanttChart } from "../components/GanttChart";
import { formatDate } from "../lib/storage";

export function ProjectDetail() {
  const { id } = useParams();
  const wb = useWorkbench();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  if (!id) return <Empty description="缺少项目 ID" />;
  const project = wb.projects.find((p) => p.id === id);
  if (!project) {
    return (
      <div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/projects")}>
          返回
        </Button>
        <Empty description="项目不存在" style={{ marginTop: 24 }} />
      </div>
    );
  }

  const related = wb.items.filter((i) => i.projectId === project.id);
  const done = related.filter((i) => i.status === "done").length;
  const percent = related.length ? (done / related.length) * 100 : 0;
  const spanStart = project.phases.length
    ? Math.min(...project.phases.map((p) => p.start))
    : project.createdAt;
  const spanEnd = project.phases.length
    ? Math.max(...project.phases.map((p) => p.end))
    : project.dueDate ?? project.createdAt;

  const columns = [
    {
      title: "任务",
      dataIndex: "title",
      render: (t: string, r: any) => (
        <span style={{ textDecoration: r.status === "done" ? "line-through" : "none" }}>{t}</span>
      ),
    },
    { title: "优先级", dataIndex: "priority", render: (p: any) => <PriorityTag priority={p} /> },
    {
      title: "状态",
      dataIndex: "status",
      render: (s: string) => <Tag color={s === "done" ? "green" : s === "doing" ? "blue" : "default"}>{s}</Tag>,
    },
    { title: "截止", dataIndex: "dueDate", render: (d: number | null) => formatDate(d) },
    {
      title: "",
      key: "op",
      render: (_: unknown, r: any) => (
        <Button type="link" onClick={() => wb.toggleDone(r.id)}>
          {r.status === "done" ? "撤销" : "完成"}
        </Button>
      ),
    },
  ];

  function openEdit() {
    form.setFieldsValue({
      name: project!.name,
      stage: project!.stage,
      owner: project!.owner,
      dueDate: project!.dueDate ? dayjs(project!.dueDate) : null,
      description: project!.description,
    });
    setOpen(true);
  }
  function submit() {
    form.validateFields().then((v) => {
      wb.updateProject(project!.id, {
        name: v.name,
        stage: v.stage,
        owner: v.owner,
        dueDate: v.dueDate ? v.dueDate.valueOf() : null,
        description: v.description ?? "",
      });
      message.success("已保存");
      setOpen(false);
    });
  }

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/projects")}>
          返回
        </Button>
        <PermissionGate require="edit" fallback={null}>
          <Button icon={<EditOutlined />} onClick={openEdit}>
            编辑
          </Button>
        </PermissionGate>
      </Space>

      <Card title={project.name} style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="阶段">
            <Tag>{project.stage}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="负责人">{project.owner}</Descriptions.Item>
          <Descriptions.Item label="截止">{formatDate(project.dueDate)}</Descriptions.Item>
          <Descriptions.Item label="描述">{project.description || "—"}</Descriptions.Item>
        </Descriptions>
        <div style={{ marginTop: 12 }}>
          <Space style={{ marginBottom: 6 }}>
            <span style={{ color: "#8c8c8c" }}>进度</span>
            <span style={{ fontWeight: 600 }}>{Math.round(percent)}%</span>
          </Space>
          <ProgressBar percent={percent} color={project.color} />
        </div>
      </Card>

      <Card title="阶段甘特图" style={{ marginBottom: 16 }}>
        <GanttChart phases={project.phases} start={spanStart} end={spanEnd} />
      </Card>

      <Card title={`关联待办（${related.length}）`}>
        <Table rowKey="id" dataSource={related} columns={columns} pagination={false} />
      </Card>

      <Modal title="编辑项目" open={open} onOk={submit} onCancel={() => setOpen(false)} okText="保存">
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="stage" label="阶段">
            <Input />
          </Form.Item>
          <Form.Item name="owner" label="负责人">
            <Input />
          </Form.Item>
          <Form.Item name="dueDate" label="截止日期">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
