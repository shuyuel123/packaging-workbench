import { useRef } from "react";
import { Button, Empty, Spin, Tag, message } from "antd";
import {
  RobotOutlined,
  UploadOutlined,
  FileTextOutlined,
  WarningOutlined,
  ExportOutlined,
} from "@ant-design/icons";
import type { AiIssue } from "../types";
import { FileChip } from "./FileChip";
import { loadFiles, ACCEPTED_DOC_ACCEPT } from "../lib/fileUpload";
import { deleteStoredFile } from "../utils/storageService";
import { exportReviewToWord, exportReviewToExcel, ReviewExportMeta } from "../lib/exportDoc";

interface AiReviewPanelProps {
  issues: AiIssue[];
  loading?: boolean;
  emptyHint?: string;
  /** 修改某个问题（如补充人工标注附件），透传给父级持久化 */
  onUpdateIssue?: (index: number, patch: Partial<AiIssue>) => void;
  /** 导出相关元数据（订单号/型号/市场/品牌） */
  exportMeta?: ReviewExportMeta;
  /** 是否显示导出按钮 */
  showExport?: boolean;
}

const SEV_COLOR: Record<string, string> = { error: "#cf1322", warn: "#fa8c16", info: "#1677ff" };
const SEV_LABEL: Record<string, string> = { error: "必须修改", warn: "建议修改", info: "提示" };
const SOURCE_LABEL: Record<string, string> = { rule: "规则快检", deep: "深度检查", image: "图像审核" };

export function AiReviewPanel({
  issues,
  loading,
  emptyHint,
  onUpdateIssue,
  exportMeta,
  showExport,
}: AiReviewPanelProps) {
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 24 }}>
        <Spin tip="AI 智能审核中…" />
      </div>
    );
  }

  if (!issues.length) {
    return <Empty description={emptyHint ?? "暂无问题，AI 审核将在此展示"} />;
  }

  const aiAttachments = (it: AiIssue) => (it.attachments ?? []).filter((a) => a.uploadedBy === "AI智能审核");
  const manualAttachments = (it: AiIssue) => (it.attachments ?? []).filter((a) => a.uploadedBy !== "AI智能审核");

  const handleManualUpload = async (index: number, list: FileList | null) => {
    if (!list || !list.length) return;
    const added = await loadFiles(list, {
      onReject: (names) => message.warning(`已跳过不支持的文件：${names.join("、")}`),
    });
    if (!added.length) return;
    const current = issues[index]?.attachments ?? [];
    onUpdateIssue?.(index, { attachments: [...current, ...added] });
    message.success(`已添加 ${added.length} 个补充标注附件`);
  };

  const handleDeleteManual = (index: number, fileId: string) => {
    const current = issues[index]?.attachments ?? [];
    deleteStoredFile(fileId);
    onUpdateIssue?.(index, { attachments: current.filter((f) => f.id !== fileId) });
  };

  return (
    <div>
      {showExport && exportMeta && (
        <div style={{ marginBottom: 12, textAlign: "right" }}>
          <Button
            icon={<ExportOutlined />}
            style={{ marginRight: 8 }}
            onClick={() => exportReviewToWord(issues, exportMeta)}
          >
            导出 Word
          </Button>
          <Button icon={<ExportOutlined />} onClick={() => exportReviewToExcel(issues, exportMeta)}>
            导出 Excel
          </Button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {issues.map((it, i) => (
          <div
            key={i}
            style={{
              border: "1px solid #f0f0f0",
              borderLeft: `4px solid ${SEV_COLOR[it.severity] ?? "#1677ff"}`,
              borderRadius: 10,
              padding: 14,
              background: "#fff",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Tag color={it.severity === "error" ? "error" : it.severity === "warn" ? "warning" : "processing"}>
                {SEV_LABEL[it.severity] ?? it.severity}
              </Tag>
              <span style={{ fontWeight: 600 }}>{it.location}</span>
              {it.source && <Tag>{SOURCE_LABEL[it.source] ?? it.source}</Tag>}
            </div>
            <div style={{ margin: "8px 0 12px", color: "#444", fontSize: 14 }}>
              <WarningOutlined style={{ color: SEV_COLOR[it.severity], marginRight: 6 }} />
              {it.suggestion}
            </div>

            {/* 问题标注附件 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* AI 智能批注 */}
              <div
                style={{
                  background: "linear-gradient(135deg, #e6f0ff 0%, #f3f8ff 100%)",
                  border: "1px solid #bcd6ff",
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <RobotOutlined style={{ color: "#1677ff" }} />
                  <span style={{ fontWeight: 600, color: "#1677ff" }}>AI 智能批注</span>
                  <Tag color="blue" style={{ marginLeft: 4 }}>
                    AI智能审核
                  </Tag>
                  <span style={{ fontSize: 12, color: "#8c8c8c" }}>根据订单印刷件自动生成</span>
                </div>
                {aiAttachments(it).length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {aiAttachments(it).map((f) => (
                      <FileChip key={f.id} file={f} />
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#8c8c8c" }}>本次未生成 AI 批注附件</div>
                )}
              </div>

              {/* 人工补充标注 */}
              <div
                style={{
                  background: "#fafafa",
                  border: "1px solid #efefef",
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <FileTextOutlined style={{ color: "#595959" }} />
                  <span style={{ fontWeight: 600, color: "#595959" }}>人工补充标注</span>
                  {manualAttachments(it).length > 0 && (
                    <Tag color="default">附件 {manualAttachments(it).length}</Tag>
                  )}
                  <div style={{ flex: 1 }} />
                  {onUpdateIssue && (
                    <Button
                      size="small"
                      icon={<UploadOutlined />}
                      onClick={() => fileRefs.current[i]?.click()}
                    >
                      上传补充
                    </Button>
                  )}
                  <input
                    ref={(el) => (fileRefs.current[i] = el)}
                    type="file"
                    multiple
                    accept={ACCEPTED_DOC_ACCEPT}
                    style={{ display: "none" }}
                    onChange={(e) => {
                      handleManualUpload(i, e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>
                {manualAttachments(it).length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {manualAttachments(it).map((f) => (
                      <FileChip key={f.id} file={f} onDelete={(file) => handleDeleteManual(i, file.id)} />
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#bfbfbf" }}>暂无人工补充，可上传 Word/Excel/PDF/图片标注</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
