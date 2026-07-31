import { useState } from "react";
import { Card, Button, Tag, Space, Input, Empty, message } from "antd";
import { ArrowLeftOutlined, SaveOutlined, FileMarkdownOutlined, FileWordOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { useWorkbench } from "../state/WorkbenchContext";
import { PermissionGate } from "../components/PermissionGate";

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function WeeklyEdit() {
  const { weekStart } = useParams();
  const wb = useWorkbench();
  const navigate = useNavigate();
  const report = wb.weeklyReports.find((r) => r.weekStart === Number(weekStart));

  const [content, setContent] = useState(report?.content ?? "");

  if (!report) {
    return (
      <div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/weekly")}>
          返回
        </Button>
        <Empty description="未找到该周报" style={{ marginTop: 24 }} />
      </div>
    );
  }

  function save() {
    wb.updateWeekly(report!.id, { content });
    message.success("已保存");
  }
  function submit() {
    wb.updateWeekly(report!.id, { content, submitted: true });
    message.success("周报已提交");
  }
  function exportMd() {
    const md = `# 周报 ${report!.weekLabel}\n\n## 本周完成\n${report!.autoSummary}\n\n## 总结\n${
      content || "（无）"
    }\n`;
    download(`${report!.weekLabel}.md`, md, "text/markdown");
  }
  function exportDoc() {
    const html = `<html><head><meta charset="utf-8"><title>周报 ${report!.weekLabel}</title></head><body><h1>周报 ${report!.weekLabel}</h1><h2>本周完成</h2><pre>${report!.autoSummary}</pre><h2>总结</h2><p>${content.replace(
      /\n/g,
      "<br/>"
    )}</p></body></html>`;
    download(`${report!.weekLabel}.doc`, html, "application/msword");
  }

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/weekly")}>
          返回
        </Button>
        <Tag color={report.submitted ? "green" : "orange"}>
          {report.submitted ? "已提交" : "未提交"}
        </Tag>
      </Space>

      <Card title={`本周自动汇总（${report.weekLabel}）`} style={{ marginBottom: 16 }}>
        <pre style={{ whiteSpace: "pre-wrap", margin: 0, color: "#595959" }}>
          {report.autoSummary}
        </pre>
      </Card>

      <Card title="周报内容（可编辑）">
        <Input.TextArea
          rows={10}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="补充本周总结、风险与下周计划…"
        />
        <Space style={{ marginTop: 12 }}>
          <PermissionGate require="edit" fallback={<Tag>查看者仅可导出</Tag>}>
            <Button icon={<SaveOutlined />} onClick={save}>
              保存
            </Button>
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={submit}>
              提交周报
            </Button>
          </PermissionGate>
          <Button icon={<FileMarkdownOutlined />} onClick={exportMd}>
            导出 Markdown
          </Button>
          <Button icon={<FileWordOutlined />} onClick={exportDoc}>
            导出 Word
          </Button>
        </Space>
      </Card>
    </div>
  );
}
