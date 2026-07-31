import { useState } from "react";
import {
  Card,
  Button,
  Input,
  Select,
  Table,
  Tag,
  Checkbox,
  Space,
  message,
  Empty,
  Popconfirm,
  Spin,
} from "antd";
import { ThunderboltOutlined, DeleteOutlined, ImportOutlined } from "@ant-design/icons";
import { useWorkbench } from "../state/WorkbenchContext";
import { PermissionGate } from "../components/PermissionGate";
import { PRIORITY_OPTIONS } from "../components/PriorityTag";
import { getAIService } from "../services/aiService";
import { formatDate, relativeTime } from "../lib/storage";
import type { ParsedTodo, Priority } from "../types";

export function AIOrganize() {
  const wb = useWorkbench();
  const [text, setText] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedTodo[]>([]);
  const [loading, setLoading] = useState(false);

  async function parse() {
    if (!text.trim()) {
      message.warning("请先粘贴待解析的文本");
      return;
    }
    setLoading(true);
    try {
      const ai = getAIService(
        wb.settings.aiProvider,
        wb.settings.apiKey,
        wb.settings.apiBase,
        wb.settings.aiModel || undefined
      );
      const res = await ai.parseTextToTodos(text, projectId);
      setParsed(res.map((r) => ({ ...r, checked: true })));
    } catch (e) {
      message.error("解析失败：" + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function update(idx: number, patch: Partial<ParsedTodo>) {
    setParsed((arr) => arr.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }

  function importSelected() {
    const sel = parsed.filter((p) => p.checked);
    if (!sel.length) {
      message.warning("请勾选要导入的待办");
      return;
    }
    sel.forEach((p) => {
      wb.addItem({
        kind: "task",
        title: p.title,
        content: p.source,
        tags: p.assignee ? [p.assignee] : [],
        priority: p.priority,
        projectId: projectId,
        dueDate: p.dueDate,
        status: "todo",
        source: projectId ? "project" : "inbox",
      });
    });
    wb.addCollection({ text, projectId, todos: parsed });
    message.success(`已导入 ${sel.length} 条待办`);
    setParsed([]);
    setText("");
  }

  const columns = [
    {
      title: "导入",
      key: "checked",
      width: 60,
      render: (_: unknown, r: ParsedTodo, i: number) => (
        <Checkbox
          checked={r.checked}
          onChange={(e) => update(i, { checked: e.target.checked })}
        />
      ),
    },
    {
      title: "任务名",
      key: "title",
      render: (_: unknown, r: ParsedTodo, i: number) => (
        <Input value={r.title} onChange={(e) => update(i, { title: e.target.value })} />
      ),
    },
    {
      title: "负责人",
      key: "assignee",
      width: 140,
      render: (_: unknown, r: ParsedTodo, i: number) => (
        <Input
          value={r.assignee}
          placeholder="未指定"
          onChange={(e) => update(i, { assignee: e.target.value })}
        />
      ),
    },
    {
      title: "优先级",
      key: "priority",
      width: 110,
      render: (_: unknown, r: ParsedTodo, i: number) => (
        <Select
          value={r.priority}
          style={{ width: "100%" }}
          options={PRIORITY_OPTIONS}
          onChange={(v) => update(i, { priority: v as Priority })}
        />
      ),
    },
    {
      title: "截止",
      key: "due",
      width: 120,
      render: (_: unknown, r: ParsedTodo) => (
        <span style={{ color: "#8c8c8c" }}>{r.dueDate ? formatDate(r.dueDate) : "—"}</span>
      ),
    },
  ];

  const history = [...wb.collections].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div>
      <Card title="信息收集（AI 解析为待办）" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <Input.TextArea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="粘贴会议纪要 / 需求碎片 / 待办清单，每行一条，例如：&#10;跟进包装法规库录入 @我 截止:2026-08-01&#10;整理周报 负责人:小李"
          />
          <Space>
            <Select
              allowClear
              style={{ width: 220 }}
              placeholder="关联项目（可选）"
              value={projectId}
              onChange={setProjectId}
              options={wb.projects.map((p) => ({ value: p.id, label: p.name }))}
            />
            <PermissionGate require="edit" fallback={<Tag>查看者仅可解析</Tag>}>
              <Button type="primary" icon={<ThunderboltOutlined />} loading={loading} onClick={parse}>
                AI 解析为待办
              </Button>
            </PermissionGate>
            {parsed.length > 0 && (
              <Button icon={<ImportOutlined />} onClick={importSelected}>
                导入勾选项
              </Button>
            )}
          </Space>
        </Space>
      </Card>

      {loading && (
        <div style={{ textAlign: "center", padding: 24 }}>
          <Spin tip="AI 正在解析…" />
        </div>
      )}

      {!loading && parsed.length > 0 && (
        <Card title="解析结果（可编辑后导入）" style={{ marginBottom: 16 }}>
          <Table rowKey={(_, i) => String(i)} dataSource={parsed} columns={columns} pagination={false} />
        </Card>
      )}

      <Card title="历史收集记录">
        {history.length === 0 ? (
          <Empty description="暂无收集记录" />
        ) : (
          <Space direction="vertical" style={{ width: "100%" }}>
            {history.map((c) => (
              <div
                key={c.id}
                style={{ borderBottom: "1px solid #f5f5f5", padding: "10px 0", display: "flex", justifyContent: "space-between", gap: 12 }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    {c.projectId ? wb.projects.find((p) => p.id === c.projectId)?.name : "未关联项目"}
                    <Tag style={{ marginLeft: 8 }}>{c.todos.length} 条待办</Tag>
                  </div>
                  <div
                    style={{
                      color: "#8c8c8c",
                      fontSize: 13,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {c.text}
                  </div>
                  <div style={{ color: "#bfbfbf", fontSize: 12 }}>{relativeTime(c.createdAt)}</div>
                </div>
                <Popconfirm title="删除该记录？" onConfirm={() => wb.removeCollection(c.id)}>
                  <Button danger type="text" icon={<DeleteOutlined />} />
                </Popconfirm>
              </div>
            ))}
          </Space>
        )}
      </Card>
    </div>
  );
}
